export type PageType = 'home' | 'alarms' | 'assistant' | 'schedule' | 'settings';
export type TabType = PageType;

export interface NavigationItem {
  id: PageType;
  label: string;
  badgeCount?: number;
}
