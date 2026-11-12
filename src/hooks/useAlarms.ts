import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alarm, NextAlarmInfo } from '../types/alarm';
import { storageService } from '../services/storageService';
import { NativeAlarm } from '../services/nativeAlarmPlugin';

export function calculateNextAlarm(alarms: Alarm[]): NextAlarmInfo {
  const activeAlarms = alarms.filter((a) => a.enabled);
  if (activeAlarms.length === 0) {
    return {
      alarm: null,
      timeFormatted: 'No active alarms',
      countdownText: 'All alarms disabled',
    };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sun ... 6 = Sat
  const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();

  let minDiffMinutes = Infinity;
  let targetAlarm: Alarm | null = null;

  for (const alarm of activeAlarms) {
    const [h, m] = alarm.time.split(':').map(Number);
    const alarmMinutesTotal = h * 60 + m;

    if (!alarm.days || alarm.days.length === 0) {
      // Once alarm
      let diff = alarmMinutesTotal - currentMinutesTotal;
      if (diff <= 0) {
        diff += 24 * 60; // Next day
      }
      if (diff < minDiffMinutes) {
        minDiffMinutes = diff;
        targetAlarm = alarm;
      }
    } else {
      // Repeating alarm on specific days
      for (const day of alarm.days) {
        let dayDiff = day - currentDay;
        if (dayDiff < 0) {
          dayDiff += 7;
        }

        let diff = dayDiff * 24 * 60 + (alarmMinutesTotal - currentMinutesTotal);
        if (diff <= 0) {
          diff += 7 * 24 * 60; // Next week
        }

        if (diff < minDiffMinutes) {
          minDiffMinutes = diff;
          targetAlarm = alarm;
        }
      }
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
          return { ...a, enabled: nextState };
        }
        return a;
      });
      return updated;
    });
  }, []);

  const addAlarm = useCallback(async (alarmData: Omit<Alarm, 'id' | 'createdAt'>) => {
    const newAlarm: Alarm = {
      ...alarmData,
      id: `alarm_${Date.now()}`,
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
    setAlarms((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (updated.enabled) {
      await NativeAlarm.schedule({
        id: updated.id,
        time: updated.time,
        days: updated.days,
        label: updated.label,
        soundId: updated.soundId,
        volume: updated.volume,
        vibrate: updated.vibrate,
        snoozeIntervalMinutes: updated.snoozeIntervalMinutes,
        snoozeLimit: updated.snoozeLimit,
        aiBriefing: updated.aiBriefing,
        aiVoiceStyle: updated.aiVoiceStyle,
      }).catch(console.error);
    } else {
      await NativeAlarm.cancel(updated.id).catch(console.error);
    }
  }, []);

  const deleteAlarm = useCallback(async (id: string) => {
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
  };
}
