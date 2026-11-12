import React from 'react';
import { TabType } from '../../navigation/navigationTypes';
import { Bell, Sparkles, SlidersHorizontal, AlarmClockCheck } from 'lucide-react';

interface AppHeaderProps {
  currentTab: TabType;
  onNavigate: (tab: TabType) => void;
  onOpenNotifications: () => void;
  onTriggerTestAlarm: () => void;
  unreadCount?: number;
}

const TAB_TITLES: Record<TabType, { title: string; subtitle: string }> = {
  home: { title: 'AI Wake', subtitle: 'Personal Wake Assistant' },
  assistant: { title: 'AI Assistant', subtitle: 'Voice & Schedule Intelligence' },
  schedule: { title: 'Daily Schedule', subtitle: 'Routines & Wake Alignment' },
  alarms: { title: 'Alarms', subtitle: 'Precision Android Schedules' },
  settings: { title: 'Settings', subtitle: 'Preferences & Native Engine' },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onNavigate,
  onOpenNotifications,
  onTriggerTestAlarm,
  unreadCount = 2,
}) => {
  const info = TAB_TITLES[currentTab];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md pt-safe">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Contextual Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-400 shadow-inner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                {info.title}
              </span>
              {currentTab !== 'home' && (
                <span className="text-xs font-normal text-zinc-400 hidden sm:inline">
                  · AI Wake
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
              {info.subtitle}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Ringing Experience Test */}
          <button
            type="button"
            onClick={onTriggerTestAlarm}
            title="Simulate full-screen alarm ringing screen"
            aria-label="Simulate full-screen alarm ringing screen"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-2.5 sm:px-3 text-xs font-medium text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <AlarmClockCheck className="h-4 w-4 sm:mr-1.5 shrink-0" />
            <span className="hidden sm:inline">Test Ring</span>
          </button>

          {/* Notifications Button */}
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="View system notifications"
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2 rounded-full bg-purple-500" />
            )}
          </button>

          {/* Settings shortcut if not currently on settings */}
          {currentTab !== 'settings' && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              aria-label="Open settings"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
