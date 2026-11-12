export type TabType = 'home' | 'assistant' | 'schedule' | 'alarms' | 'settings';

export interface NavigationItem {
  id: TabType;
  label: string;
  badgeCount?: number;
}
