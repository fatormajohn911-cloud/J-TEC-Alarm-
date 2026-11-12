import { Alarm } from '../types/alarm';
import { ScheduleRoutine } from '../types/schedule';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';
import { ChatMessage } from '../types/assistant';

const ALARMS_KEY = 'ai_wake_alarms_v1';
const SCHEDULE_KEY = 'ai_wake_schedule_v1';
const SETTINGS_KEY = 'ai_wake_settings_v1';
const CHAT_KEY = 'ai_wake_chat_v2';
const WEATHER_CITY_KEY = 'ai_wake_weather_city_v1';

const INITIAL_ALARMS: Alarm[] = [
  {
    id: 'alarm_1',
    time: '06:45',
    label: 'Weekday Morning Launch',
    days: [1, 2, 3, 4, 5], // Mon - Fri
    enabled: true,
    soundId: 'aurora',
    volume: 85,
    vibrate: true,
    snoozeIntervalMinutes: 9,
    snoozeLimit: 3,
    aiBriefing: true,
    aiVoiceStyle: 'warm',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'alarm_2',
    time: '08:30',
    label: 'Weekend Gentle Awake',
    days: [0, 6], // Sun, Sat
    enabled: true,
    soundId: 'zen_harp',
    volume: 70,
    vibrate: false,
    snoozeIntervalMinutes: 10,
    snoozeLimit: 2,
    aiBriefing: true,
    aiVoiceStyle: 'warm',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'alarm_3',
    time: '14:15',
    label: 'Afternoon Recharge (25m)',
    days: [], // Once
    enabled: false,
    soundId: 'lofi_wake',
    volume: 65,
    vibrate: true,
    snoozeIntervalMinutes: 5,
    snoozeLimit: 1,
    aiBriefing: false,
    aiVoiceStyle: 'coach',
    createdAt: Date.now() - 43200000,
  },
];

const INITIAL_ROUTINES: ScheduleRoutine[] = [
  {
    id: 'routine_1',
    title: 'Hydration & Sunlight Protocol',
    time: '07:00',
    durationMinutes: 15,
    category: 'morning_routine',
    completed: false,
    dayOfWeek: 1, // Mon
    notes: '500ml water with electrolytes + 10 mins direct morning sunlight',
  },
  {
    id: 'routine_2',
    title: 'Mobility & Gentle Stretching',
    time: '07:20',
    durationMinutes: 20,
    category: 'health',
    completed: false,
    dayOfWeek: 1,
    notes: 'Spine decompression, hips and thoracic mobility',
  },
  {
    id: 'routine_3',
    title: 'High-Priority Focus Block',
    time: '09:00',
    durationMinutes: 90,
    category: 'work',
    completed: false,
    dayOfWeek: 1,
    notes: 'No communications; strategic deep engineering focus',
  },
  {
    id: 'routine_4',
    title: 'Midday Walk & Reset',
    time: '12:30',
    durationMinutes: 30,
    category: 'health',
    completed: false,
    dayOfWeek: 1,
    notes: 'Zone 2 outdoor walking cadence',
  },
  {
    id: 'routine_5',
    title: 'Evening Digital Sunset',
    time: '21:30',
    durationMinutes: 45,
    category: 'evening',
    completed: false,
    dayOfWeek: 1,
    notes: 'Dim blue lighting, reading fiction book',
  },
];

export const storageService = {
  getAlarms(): Alarm[] {
    try {
      const data = localStorage.getItem(ALARMS_KEY);
      if (!data) {
        localStorage.setItem(ALARMS_KEY, JSON.stringify(INITIAL_ALARMS));
        return INITIAL_ALARMS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_ALARMS;
    }
  },

  saveAlarms(alarms: Alarm[]): void {
    try {
      localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
    } catch (err) {
      console.error('Error saving alarms to localStorage', err);
    }
  },

  getSchedule(): ScheduleRoutine[] {
    try {
      const data = localStorage.getItem(SCHEDULE_KEY);
      if (!data) {
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(INITIAL_ROUTINES));
        return INITIAL_ROUTINES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_ROUTINES;
    }
  },

  saveSchedule(routines: ScheduleRoutine[]): void {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(routines));
    } catch (err) {
      console.error('Error saving schedule to localStorage', err);
    }
  },

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error('Error saving settings to localStorage', err);
    }
  },

  getChatHistory(): ChatMessage[] {
    try {
      const data = localStorage.getItem(CHAT_KEY);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveChatHistory(messages: ChatMessage[]): void {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error('Error saving chat history to localStorage', err);
    }
  },

  clearChatHistory(): void {
    try {
      localStorage.removeItem(CHAT_KEY);
    } catch (err) {
      console.error('Error clearing chat history from localStorage', err);
    }
  },

  getWeatherCity(): string | null {
    try {
      return localStorage.getItem(WEATHER_CITY_KEY);
    } catch {
      return null;
    }
  },

  saveWeatherCity(city: string): void {
    try {
      localStorage.setItem(WEATHER_CITY_KEY, city);
    } catch (err) {
      console.error('Error saving weather city to localStorage', err);
    }
  },

  clearAllData(): void {
    localStorage.removeItem(ALARMS_KEY);
    localStorage.removeItem(SCHEDULE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(CHAT_KEY);
    localStorage.removeItem(WEATHER_CITY_KEY);
    localStorage.removeItem('ai_wake_chat_v1');
  },
};
