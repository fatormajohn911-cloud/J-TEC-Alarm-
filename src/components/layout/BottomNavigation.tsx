import React from 'react';
import { TabType } from '../../navigation/navigationTypes';
import { Home, Sparkles, Calendar, AlarmClock, Settings } from 'lucide-react';

interface BottomNavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  alarmCount?: number;
}

interface NavConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const NAV_ITEMS: NavConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'alarms', label: 'Alarms', icon: AlarmClock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onTabChange,
  alarmCount,
}) => {
  return (
    <nav
      role="navigation"
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl pb-safe transition-all"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2 sm:max-w-lg md:max-w-2xl">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const count = item.id === 'alarms' ? alarmCount : undefined;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center rounded-2xl py-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                isActive ? 'text-purple-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {/* Active subtle pill indicator highlight above/behind */}
              {isActive && (
                <span
                  className="absolute top-1 h-0.5 w-6 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                  aria-hidden="true"
                />
              )}

              <div className="relative flex items-center justify-center">
                <Icon
                  className={`h-5 w-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 text-purple-400' : 'group-hover:scale-105'
                  }`}
                />
                {typeof count === 'number' && count > 0 && (
                  <span className="absolute -top-1 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white shadow-sm">
                    {count}
                  </span>
                )}
              </div>

              <span
                className={`mt-1 text-[11px] tracking-tight whitespace-nowrap transition-colors ${
                  isActive ? 'font-semibold text-zinc-100' : 'font-medium text-zinc-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
