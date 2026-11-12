import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alarm, NextAlarmInfo } from '../types/alarm';
import { storageService } from '../services/storageService';
import {
  NativeAlarm,
  setWebPreparedBriefing,
  clearWebPreparedBriefing,
} from '../services/nativeAlarmPlugin';
import { generateMorningBriefing } from '../services/geminiText';
import { getOrGenerateVoiceBlob, stripMarkdownForSpeech } from '../services/geminiVoice';

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

export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>(() => storageService.getAlarms());

  useEffect(() => {
    storageService.saveAlarms(alarms);
  }, [alarms]);

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

        const status = await NativeAlarm.getBriefingStatus(alarm.id).catch(() => ({
          ready: false,
        }));

        if (status.ready) {
          if (!alarm.briefingReady) {
            changed = true;
            return { ...alarm, briefingReady: true };
          }
          return alarm;
        }

        // In web preview (non-native), prepare offline briefing ~60 minutes before alarm
        if (!NativeAlarm.isNative() && typeof navigator !== 'undefined' && navigator.onLine) {
          const diffMins = getNextAlarmDiffMinutes(alarm);
          if (diffMins <= 60) {
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

              const persona = alarm.aiVoiceStyle || settings.aiVoiceStyle || 'warm';
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
              // Skip silently if keys unavailable or offline
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
            }).catch(console.error);
          } else {
            NativeAlarm.cancel(a.id).catch(console.error);
          }
          return { ...a, enabled: nextState, briefingReady: nextState ? a.briefingReady : false };
        }
        return a;
      });
      return updated;
    });
  }, []);

  const addAlarm = useCallback(async (alarmData: Omit<Alarm, 'id' | 'createdAt'>) => {
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
      }).catch(console.error);
    }
    return newAlarm;
  }, []);

  const updateAlarm = useCallback(async (updated: Alarm) => {
    clearWebPreparedBriefing(updated.id);
    const sanitized = { ...updated, briefingReady: false };
    setAlarms((prev) => prev.map((a) => (a.id === sanitized.id ? sanitized : a)));
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
      }).catch(console.error);
    } else {
      await NativeAlarm.cancel(sanitized.id).catch(console.error);
    }
  }, []);

  const deleteAlarm = useCallback(async (id: string) => {
    clearWebPreparedBriefing(id);
    await NativeAlarm.cancel(id).catch(console.error);
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
  };
}
