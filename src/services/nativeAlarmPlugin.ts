import { registerPlugin, Capacitor } from '@capacitor/core';
import { Alarm } from '../types/alarm';

export interface ScheduleAlarmOptions {
  id: string;
  time: string; // "HH:MM"
  days: number[]; // e.g. [1,2,3,4,5]
  label: string;
  soundId: string;
  volume: number;
  vibrate: boolean;
  snoozeIntervalMinutes: number;
  snoozeLimit: number;
  aiBriefing: boolean;
  aiVoiceStyle?: string;
}

export interface BriefingContextPayload {
  userName: string;
  routines: Array<{
    time: string;
    title: string;
    durationMinutes: number;
    dayOfWeek: number;
  }>;
  serverUrl: string;
  includeWeather: boolean;
  includeCalendar: boolean;
  includeMotivation: boolean;
  voiceStyle: string;
}

export interface PermissionStatus {
  exactAlarm: boolean;
  batteryExempt: boolean;
  notifications: boolean;
  fullScreenIntent: boolean;
}

export interface AlarmPluginInterface {
  scheduleAlarm(options: ScheduleAlarmOptions): Promise<{
    success: boolean;
    scheduledTimeMillis?: number;
    briefingReady?: boolean;
  }>;
  cancelAlarm(options: { id: string }): Promise<{ success: boolean }>;
  getScheduledAlarms(): Promise<{ alarms: Alarm[] }>;
  getBriefingStatus(options: { id: string }): Promise<{ ready: boolean }>;
  syncBriefingContext(options: BriefingContextPayload): Promise<{ success: boolean }>;
  checkPermissions(): Promise<PermissionStatus>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  requestExactAlarmPermission(): Promise<{ granted: boolean }>;
  requestFullScreenIntentPermission(): Promise<{ granted: boolean }>;
  requestBatteryOptimizationExemption(): Promise<{ granted: boolean }>;
  testTriggerAlarm(options: { id: string }): Promise<{ success: boolean }>;
}

/**
 * Web audio synthesizer for playing peaceful, high-fidelity alarm chimes
 * without external audio file dependency issues.
 */
class AlarmAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private loopInterval: number | null = null;
  private loopSoundId = 'aurora';
  private loopVolume = 85;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(soundId: string, volume: number = 80) {
    this.initCtx();
    if (!this.ctx) return;

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime((volume / 100) * 0.35, this.ctx.currentTime);
    masterGain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;

    if (soundId === 'zen_harp') {
      const notes = [261.63, 329.63, 392.0, 493.88, 523.25];
      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const noteGain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        noteGain.gain.setValueAtTime(0.001, now + i * 0.12);
        noteGain.gain.exponentialRampToValueAtTime(0.6, now + i * 0.12 + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 1.2);
        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 1.3);
      });
    } else if (soundId === 'pulse') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      const freqs = [440, 554.37, 659.25, 830.61];
      freqs.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const filter = this.ctx!.createBiquadFilter();
        const noteGain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);

        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.4, now + 0.6);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 2.5);
      });
    }
  }

  startAlarmLoop(soundId: string, volume: number = 85) {
    this.loopSoundId = soundId;
    this.loopVolume = volume;
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playTone(this.loopSoundId, this.loopVolume);
    this.loopInterval = window.setInterval(() => {
      if (this.isPlaying) {
        this.playTone(this.loopSoundId, this.loopVolume);
      }
    }, 2800);
  }

  setLoopVolume(volume: number) {
    this.loopVolume = Math.max(0, Math.min(100, volume));
  }

  stopAlarmLoop() {
    this.isPlaying = false;
    if (this.loopInterval !== null) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }
}

export const alarmAudio = new AlarmAudioEngine();

const WEB_BRIEFING_READY_PREFIX = 'ai_wake_briefing_ready_';
const WEB_BRIEFING_TEXT_PREFIX = 'ai_wake_briefing_text_';

export function getWebPreparedBriefingText(alarmId: string): string | null {
  try {
    return localStorage.getItem(`${WEB_BRIEFING_TEXT_PREFIX}${alarmId}`);
  } catch {
    return null;
  }
}

export function setWebPreparedBriefing(alarmId: string, text: string): void {
  try {
    localStorage.setItem(`${WEB_BRIEFING_READY_PREFIX}${alarmId}`, '1');
    localStorage.setItem(`${WEB_BRIEFING_TEXT_PREFIX}${alarmId}`, text);
  } catch {
    // ignore storage errors
  }
}

export function clearWebPreparedBriefing(alarmId: string): void {
  try {
    localStorage.removeItem(`${WEB_BRIEFING_READY_PREFIX}${alarmId}`);
    localStorage.removeItem(`${WEB_BRIEFING_TEXT_PREFIX}${alarmId}`);
  } catch {
    // ignore
  }
}

/**
 * Web Adapter Implementation of the Alarm Plugin when running in browser preview.
 */
class AlarmPluginWeb implements AlarmPluginInterface {
  async scheduleAlarm(options: ScheduleAlarmOptions): Promise<{
    success: boolean;
    scheduledTimeMillis?: number;
    briefingReady?: boolean;
  }> {
    let briefingReady = false;
    try {
      briefingReady = localStorage.getItem(`${WEB_BRIEFING_READY_PREFIX}${options.id}`) === '1';
    } catch {
      briefingReady = false;
    }
    return {
      success: true,
      scheduledTimeMillis: Date.now() + 3600000,
      briefingReady,
    };
  }

  async cancelAlarm(options: { id: string }): Promise<{ success: boolean }> {
    clearWebPreparedBriefing(options.id);
    return { success: true };
  }

  async getScheduledAlarms(): Promise<{ alarms: Alarm[] }> {
    return { alarms: [] };
  }

  async getBriefingStatus(options: { id: string }): Promise<{ ready: boolean }> {
    try {
      return { ready: localStorage.getItem(`${WEB_BRIEFING_READY_PREFIX}${options.id}`) === '1' };
    } catch {
      return { ready: false };
    }
  }

  async syncBriefingContext(options: BriefingContextPayload): Promise<{ success: boolean }> {
    try {
      localStorage.setItem('ai_wake_native_briefing_ctx', JSON.stringify(options));
    } catch {
      // ignore
    }
    return { success: true };
  }

  async checkPermissions(): Promise<PermissionStatus> {
    const notifications =
      typeof Notification !== 'undefined' ? Notification.permission === 'granted' : true;
    return {
      exactAlarm: true,
      batteryExempt: true,
      notifications,
      fullScreenIntent: true,
    };
  }

  async requestNotificationPermission(): Promise<{ granted: boolean }> {
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      try {
        const res = await Notification.requestPermission();
        return { granted: res === 'granted' };
      } catch {
        return { granted: false };
      }
    }
    return { granted: true };
  }

  async requestExactAlarmPermission(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async requestFullScreenIntentPermission(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async requestBatteryOptimizationExemption(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async testTriggerAlarm(_options: { id: string }): Promise<{ success: boolean }> {
    return { success: true };
  }
}

const NativeAlarmPluginProxy = registerPlugin<AlarmPluginInterface>('AlarmPlugin', {
  web: () => new AlarmPluginWeb(),
});

export const NativeAlarm = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  async schedule(options: ScheduleAlarmOptions) {
    return NativeAlarmPluginProxy.scheduleAlarm(options);
  },

  async cancel(id: string) {
    return NativeAlarmPluginProxy.cancelAlarm({ id });
  },

  async getBriefingStatus(id: string): Promise<{ ready: boolean }> {
    return NativeAlarmPluginProxy.getBriefingStatus({ id });
  },

  async syncBriefingContext(payload: BriefingContextPayload) {
    return NativeAlarmPluginProxy.syncBriefingContext(payload);
  },

  async checkPermissions(): Promise<PermissionStatus> {
    return NativeAlarmPluginProxy.checkPermissions();
  },

  async requestNotification() {
    return NativeAlarmPluginProxy.requestNotificationPermission();
  },

  async requestExactAlarm() {
    return NativeAlarmPluginProxy.requestExactAlarmPermission();
  },

  async requestFullScreenIntent() {
    return NativeAlarmPluginProxy.requestFullScreenIntentPermission();
  },

  async requestBatteryExempt() {
    return NativeAlarmPluginProxy.requestBatteryOptimizationExemption();
  },

  async triggerTest(id: string) {
    return NativeAlarmPluginProxy.testTriggerAlarm({ id });
  },
};
