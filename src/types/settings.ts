export interface AppSettings {
  timeFormat24h: boolean;
  showSeconds: boolean;
  hapticFeedback: boolean;
  defaultSnoozeMinutes: number;
  snoozeLimit: number;
  aiVoiceStyle: 'warm' | 'coach' | 'executive';
  aiBriefingWeather: boolean;
  aiBriefingCalendar: boolean;
  aiBriefingNews: boolean;
  aiBriefingMotivation: boolean;
  speechRate: number; // 0.8 - 1.2
  // Android native permissions
  exactAlarmPermission: boolean;
  batteryOptimizationExempt: boolean;
  notificationPermission: boolean;
  fullScreenIntentPermission: boolean;
  // User personalization
  userName: string;
  onboardingCompleted: boolean;
  // UI Display mode
  deviceFrameMockup: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Alex',
  onboardingCompleted: false,
  timeFormat24h: false,
  showSeconds: true,
  hapticFeedback: true,
  defaultSnoozeMinutes: 9,
  snoozeLimit: 3,
  aiVoiceStyle: 'warm',
  aiBriefingWeather: true,
  aiBriefingCalendar: true,
  aiBriefingNews: false,
  aiBriefingMotivation: true,
  speechRate: 1.0,
  exactAlarmPermission: true,
  batteryOptimizationExempt: true,
  notificationPermission: true,
  fullScreenIntentPermission: true,
  deviceFrameMockup: false,
};
