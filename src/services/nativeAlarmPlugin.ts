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

export interface PermissionStatus {
  exactAlarm: boolean;
  batteryExempt: boolean;
  notifications: boolean;
  fullScreenIntent: boolean;
}

export interface AlarmPluginInterface {
  scheduleAlarm(options: ScheduleAlarmOptions): Promise<{ success: boolean; scheduledTimeMillis?: number }>;
  cancelAlarm(options: { id: string }): Promise<{ success: boolean }>;
  getScheduledAlarms(): Promise<{ alarms: Alarm[] }>;
  checkPermissions(): Promise<PermissionStatus>;
  requestExactAlarmPermission(): Promise<{ granted: boolean }>;
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

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Harp arpeggio: C4, E4, G4, B4, C5
      const notes = [261.63, 329.63, 392.00, 493.88, 523.25];
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
      // Progressive energetic pulse
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Aurora Sunrise (default): serene ambient chords (A4, C#5, E5, G#5)
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
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playTone(soundId, volume);
    this.loopInterval = window.setInterval(() => {
      if (this.isPlaying) {
        this.playTone(soundId, volume);
      }
    }, 2800);
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

/**
 * Fallback Web Implementation of the Alarm Plugin when running in browser preview.
 * Strictly adheres to architectural clarity: marks whether native Android AlarmManager
 * is available or running in web preview mode.
 */
class AlarmPluginWeb implements AlarmPluginInterface {
  async scheduleAlarm(options: ScheduleAlarmOptions): Promise<{ success: boolean; scheduledTimeMillis?: number }> {
    console.info('[AI Wake Web Bridge] Staging alarm via Web Adapter:', options.id, options.time);
    return { success: true, scheduledTimeMillis: Date.now() + 3600000 };
  }

  async cancelAlarm(options: { id: string }): Promise<{ success: boolean }> {
    console.info('[AI Wake Web Bridge] Cancelling alarm:', options.id);
    return { success: true };
  }

  async getScheduledAlarms(): Promise<{ alarms: Alarm[] }> {
    return { alarms: [] };
  }

  async checkPermissions(): Promise<PermissionStatus> {
    return {
      exactAlarm: true,
      batteryExempt: true,
      notifications: typeof Notification !== 'undefined' && Notification.permission === 'granted',
      fullScreenIntent: true,
    };
  }

  async requestExactAlarmPermission(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async requestBatteryOptimizationExemption(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async testTriggerAlarm(options: { id: string }): Promise<{ success: boolean }> {
    console.info('[AI Wake Web Bridge] Test triggering alarm:', options.id);
    return { success: true };
  }
}

// Register with Capacitor native plugins
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

  async checkPermissions(): Promise<PermissionStatus> {
    return NativeAlarmPluginProxy.checkPermissions();
  },

  async requestExactAlarm() {
    return NativeAlarmPluginProxy.requestExactAlarmPermission();
  },

  async requestBatteryExempt() {
    return NativeAlarmPluginProxy.requestBatteryOptimizationExemption();
  },

  async triggerTest(id: string) {
    return NativeAlarmPluginProxy.testTriggerAlarm({ id });
  },
};
