import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Alarm, NextAlarmInfo } from '../types/alarm';
import { storageService } from '../services/storageService';
import {
  NativeAlarm,
  setWebPreparedBriefing,
  clearWebPreparedBriefing,
} from '../services/nativeAlarmPlugin';
import { generateMorningBriefing } from '../services/geminiText';
import {
  getOrGenerateVoiceBlob,
  stripMarkdownForSpeech,
} from '../services/geminiVoice';

const BRIEFING_RETRY_COOLDOWN_MS = 15 * 60 * 1000;
const webBriefingAttemptTimestamps = new Map<string, number>();
const webBriefingInFlight = new Set<string>();

interface PendingWebSnooze {
  alarm: Alarm;
  triggerAt: number;
}

function showWebAlarmNotification(alarm: Alarm) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return;
  }
  if (Notification.permission !== 'granted') return;

  const title = alarm.label || 'AI Wake Alarm';
  const body = `Alarm ringing · ${alarm.time}`;
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body,
            icon: './icons/icon-192.png',
            tag: `aiwake_${alarm.id}`,
            requireInteraction: true,
          });
        })
        .catch(() => {
          new Notification(title, { body, icon: './icons/icon-192.png' });
        });
    } else {
      new Notification(title, { body, icon: './icons/icon-192.png' });
    }
  } catch {
    // ignore browser notification errors
  }
}

function getNextAlarmDiffMinutes(alarm: Alarm): number {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();
  const [h, m] = alarm.time.split(':').map(Number);
  const alarmMinutesTotal = h * 60 + m;

  if (!alarm.days || alarm.days.length === 0) {
    let diff = alarmMinutesTotal - currentMinutesTotal;
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }

  let minDiff = Infinity;
  for (const day of alarm.days) {
    let dayDiff = day - currentDay;
    if (dayDiff < 0) dayDiff += 7;
    let diff = dayDiff * 24 * 60 + (alarmMinutesTotal - currentMinutesTotal);
    if (diff <= 0) diff += 7 * 24 * 60;
    if (diff < minDiff) minDiff = diff;
  }
  return minDiff;
}

export function calculateNextAlarm(alarms: Alarm[]): NextAlarmInfo {
  const activeAlarms = alarms.filter((a) => a.enabled);
  if (activeAlarms.length === 0) {
    return {
      alarm: null,
      timeFormatted: 'No active alarms',
      countdownText: 'All alarms disabled',
    };
  }

  let minDiffMinutes = Infinity;
  let targetAlarm: Alarm | null = null;

  for (const alarm of activeAlarms) {
    const diff = getNextAlarmDiffMinutes(alarm);
    if (diff < minDiffMinutes) {
      minDiffMinutes = diff;
      targetAlarm = alarm;
    }
  }

  if (!targetAlarm || minDiffMinutes === Infinity) {
    return {
      alarm: null,
      timeFormatted: 'No upcoming alarms',
      countdownText: 'All alarms inactive',
    };
  }

  const hoursLeft = Math.floor(minDiffMinutes / 60);
  const minsLeft = minDiffMinutes % 60;

  let countdownText = '';
  if (hoursLeft === 0) {
    countdownText = `Rings in ${minsLeft}m`;
  } else if (minsLeft === 0) {
    countdownText = `Rings in ${hoursLeft}h`;
  } else {
    countdownText = `Rings in ${hoursLeft}h ${minsLeft}m`;
  }

  const [th, tm] = targetAlarm.time.split(':').map(Number);
  const period = th >= 12 ? 'PM' : 'AM';
  const displayHours = th % 12 || 12;
  const timeFormatted = `${displayHours}:${tm.toString().padStart(2, '0')} ${period}`;

  return {
    alarm: targetAlarm,
    timeFormatted,
    countdownText,
  };
}

export function useAlarms(onWebAlarmTrigger?: (alarm: Alarm) => void) {
  const [alarms, setAlarms] = useState<Alarm[]>(() => storageService.getAlarms());
  const onWebTriggerRef = useRef(onWebAlarmTrigger);
  onWebTriggerRef.current = onWebAlarmTrigger;

  const lastTriggeredMinuteRef = useRef<Map<string, string>>(new Map());
  const pendingSnoozesRef = useRef<PendingWebSnooze[]>([]);
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;

  useEffect(() => {
    storageService.saveAlarms(alarms);
  }, [alarms]);

  // Web fallback alarm ticker: checks enabled alarms and snoozes every second while open
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const tick = () => {
      const now = new Date();
      const nowMs = now.getTime();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const hhmm = `${hh}:${mm}`;
      const dayIdx = now.getDay();
      const minuteStamp = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hhmm}`;

      // 1. Check any due web snoozes
      if (pendingSnoozesRef.current.length > 0) {
        const remaining: PendingWebSnooze[] = [];
        for (const item of pendingSnoozesRef.current) {
          if (nowMs >= item.triggerAt) {
            showWebAlarmNotification(item.alarm);
            onWebTriggerRef.current?.(item.alarm);
          } else {
            remaining.push(item);
          }
        }
        pendingSnoozesRef.current = remaining;
      }

      // 2. Check regular scheduled alarms
      for (const alarm of alarmsRef.current) {
        if (!alarm.enabled) continue;
        if (alarm.time !== hhmm) continue;
        const matchesDay =
          alarm.days.length === 0 || alarm.days.includes(dayIdx);
        if (!matchesDay) continue;

        if (lastTriggeredMinuteRef.current.get(alarm.id) === minuteStamp) {
          continue;
        }
        lastTriggeredMinuteRef.current.set(alarm.id, minuteStamp);

        showWebAlarmNotification(alarm);
        onWebTriggerRef.current?.(alarm);

        // Auto-disable one-time alarms once they fire on web
        if (alarm.days.length === 0) {
          setAlarms((prev) =>
            prev.map((a) =>
              a.id === alarm.id ? { ...a, enabled: false } : a
            )
          );
        }
      }
    };

    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const scheduleWebSnooze = useCallback((alarm: Alarm, minutes: number) => {
    if (Capacitor.isNativePlatform()) return;
    const safeMinutes = Math.max(1, minutes || 5);
    pendingSnoozesRef.current.push({
      alarm,
      triggerAt: Date.now() + safeMinutes * 60_000,
    });
  }, []);

  // Periodically check briefing readiness (native filesDir or web IndexedDB/localStorage)
  // and pre-prepare offline audio ~60m before ring when online.
  const refreshBriefingStatuses = useCallback(async () => {
    const current = storageService.getAlarms();
    let changed = false;

    const updated = await Promise.all(
      current.map(async (alarm) => {
        if (!alarm.enabled || !alarm.aiBriefing) {
          if (alarm.briefingReady) {
            changed = true;
            return { ...alarm, briefingReady: false };
          }
          return alarm;
        }

        const status = await NativeAlarm.getBriefingStatus(alarm.id).catch(
          () => ({
            ready: false,
          })
        );

        if (status.ready) {
          if (!alarm.briefingReady) {
            changed = true;
            return { ...alarm, briefingReady: true };
          }
          return alarm;
        }

        // In web preview (non-native), prepare offline briefing ~60 minutes before alarm
        if (
          !NativeAlarm.isNative() &&
          typeof navigator !== 'undefined' &&
          navigator.onLine
        ) {
          const diffMins = getNextAlarmDiffMinutes(alarm);
          const lastAttempt = webBriefingAttemptTimestamps.get(alarm.id) || 0;
          const canAttempt =
            diffMins <= 60 &&
            !webBriefingInFlight.has(alarm.id) &&
            Date.now() - lastAttempt >= BRIEFING_RETRY_COOLDOWN_MS;

          if (canAttempt) {
            webBriefingInFlight.add(alarm.id);
            webBriefingAttemptTimestamps.set(alarm.id, Date.now());
            try {
              const settings = storageService.getSettings();
              const routines = storageService.getSchedule();
              const todayDow = new Date().getDay();
              const todayRoutines = routines
                .filter((r) => r.dayOfWeek === todayDow)
                .map((r) => ({
                  time: r.time,
                  title: r.title,
                  durationMinutes: r.durationMinutes,
                }));

              const persona =
                alarm.aiVoiceStyle || settings.aiVoiceStyle || 'warm';
              const rawText = await generateMorningBriefing({
                userName: settings.userName || 'Friend',
                alarmLabel: alarm.label || 'Morning Wake',
                currentDateTime: new Date().toLocaleString(),
                routines: todayRoutines,
                includeWeather: settings.aiBriefingWeather,
                includeCalendar: settings.aiBriefingCalendar,
                includeMotivation: settings.aiBriefingMotivation,
                voiceStyle: persona,
              });
              const cleanText = stripMarkdownForSpeech(rawText);
              await getOrGenerateVoiceBlob(cleanText, persona);
              setWebPreparedBriefing(alarm.id, cleanText);
              changed = true;
              return { ...alarm, briefingReady: true };
            } catch {
              // Cooldown prevents hammering quota if keys are missing or rate-limited
            } finally {
              webBriefingInFlight.delete(alarm.id);
            }
          }
        }

        return alarm;
      })
    );

    if (changed) {
      setAlarms(updated);
    }
  }, []);

  useEffect(() => {
    refreshBriefingStatuses();
    const interval = window.setInterval(refreshBriefingStatuses, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshBriefingStatuses]);

  const nextAlarmInfo = useMemo(() => calculateNextAlarm(alarms), [alarms]);

  const toggleAlarm = useCallback(async (id: string) => {
    setAlarms((prev) => {
      const updated = prev.map((a) => {
        if (a.id === id) {
          const nextState = !a.enabled;
          if (nextState) {
            NativeAlarm.schedule({
              id: a.id,
              time: a.time,
              days: a.days,
              label: a.label,
              soundId: a.soundId,
              volume: a.volume,
              vibrate: a.vibrate,
              snoozeIntervalMinutes: a.snoozeIntervalMinutes,
              snoozeLimit: a.snoozeLimit,
              aiBriefing: a.aiBriefing,
              aiVoiceStyle: a.aiVoiceStyle,
            }).catch(() => {});
          } else {
            NativeAlarm.cancel(a.id).catch(() => {});
          }
          return {
            ...a,
            enabled: nextState,
            briefingReady: nextState ? a.briefingReady : false,
          };
        }
        return a;
      });
      return updated;
    });
  }, []);

  const addAlarm = useCallback(
    async (alarmData: Omit<Alarm, 'id' | 'createdAt'>) => {
      const newAlarm: Alarm = {
        ...alarmData,
        id: `alarm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        briefingReady: false,
        createdAt: Date.now(),
      };
      setAlarms((prev) => [newAlarm, ...prev]);
      if (newAlarm.enabled) {
        await NativeAlarm.schedule({
          id: newAlarm.id,
          time: newAlarm.time,
          days: newAlarm.days,
          label: newAlarm.label,
          soundId: newAlarm.soundId,
          volume: newAlarm.volume,
          vibrate: newAlarm.vibrate,
          snoozeIntervalMinutes: newAlarm.snoozeIntervalMinutes,
          snoozeLimit: newAlarm.snoozeLimit,
          aiBriefing: newAlarm.aiBriefing,
          aiVoiceStyle: newAlarm.aiVoiceStyle,
        }).catch(() => {});
      }
      return newAlarm;
    },
    []
  );

  const updateAlarm = useCallback(async (updated: Alarm) => {
    clearWebPreparedBriefing(updated.id);
    const sanitized = { ...updated, briefingReady: false };
    setAlarms((prev) =>
      prev.map((a) => (a.id === sanitized.id ? sanitized : a))
    );
    if (sanitized.enabled) {
      await NativeAlarm.schedule({
        id: sanitized.id,
        time: sanitized.time,
        days: sanitized.days,
        label: sanitized.label,
        soundId: sanitized.soundId,
        volume: sanitized.volume,
        vibrate: sanitized.vibrate,
        snoozeIntervalMinutes: sanitized.snoozeIntervalMinutes,
        snoozeLimit: sanitized.snoozeLimit,
        aiBriefing: sanitized.aiBriefing,
        aiVoiceStyle: sanitized.aiVoiceStyle,
      }).catch(() => {});
    } else {
      await NativeAlarm.cancel(sanitized.id).catch(() => {});
    }
  }, []);

  const deleteAlarm = useCallback(async (id: string) => {
    clearWebPreparedBriefing(id);
    pendingSnoozesRef.current = pendingSnoozesRef.current.filter(
      (item) => item.alarm.id !== id
    );
    await NativeAlarm.cancel(id).catch(() => {});
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    alarms,
    nextAlarmInfo,
    toggleAlarm,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    refreshBriefingStatuses,
    scheduleWebSnooze,
  };
}
