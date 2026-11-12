export interface Alarm {
  id: string;
  time: string; // HH:MM in 24h internal format e.g. "07:00"
  label: string;
  days: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat; empty = once
  enabled: boolean;
  soundId: string;
  volume: number; // 0 to 100
  vibrate: boolean;
  snoozeIntervalMinutes: number;
  snoozeLimit: number;
  snoozeCount?: number;
  aiBriefing: boolean;
  aiVoiceStyle?: 'warm' | 'coach' | 'executive';
  briefingReady?: boolean;
  createdAt: number;
}

export interface AlarmSound {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_SOUNDS: AlarmSound[] = [
  { id: 'aurora', name: 'Aurora Sunrise', description: 'Gentle ambient chords with soft morning chimes' },
  { id: 'zen_harp', name: 'Zen Harp & Strings', description: 'Gradually ascending acoustic harp melodies' },
  { id: 'birds', name: 'Alpine Forest Birds', description: 'Real birdsong recorded in high-altitude pines' },
  { id: 'pulse', name: 'Kinetic Digital Pulse', description: 'Progressive electronic chime designed for deep sleepers' },
  { id: 'lofi_wake', name: 'Warm Lo-Fi Rhythm', description: 'Subtle bass and chill vintage electric piano' },
];

export interface NextAlarmInfo {
  alarm: Alarm | null;
  timeFormatted: string;
  countdownText: string;
}
