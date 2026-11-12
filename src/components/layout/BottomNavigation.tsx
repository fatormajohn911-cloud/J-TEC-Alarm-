import React from 'react';
import { PageType } from '../../navigation/navigationTypes';
import { AlarmClock, Calendar, Settings, Plus } from 'lucide-react';
import { AiIcon } from '../common/AiIcon';

interface BottomNavigationProps {
  onNavigate: (page: PageType) => void;
  onOpenNewAlarm: () => void;
  alarmCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  onNavigate,
  onOpenNewAlarm,
  alarmCount,
}) => {
  return (
    <nav
      role="navigation"
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(30,27,75,0.08)] border-t border-gray-100 pb-safe transition-all w-full max-w-full overflow-x-hidden"
    >
      <div className="mx-auto flex h-20 max-w-md items-center justify-between px-4 sm:max-w-lg md:max-w-xl">
        {/* Tab 1: Alarms */}
        <button
          type="button"
          onClick={() => onNavigate('alarms')}
          className="group flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center text-[#6B7280] hover:text-[#3B3D78] transition-colors"
        >
          <div className="relative">
            <AlarmClock className="h-5 w-5 transition-transform group-hover:scale-105" />
            {typeof alarmCount === 'number' && alarmCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#9C1C7C] px-1 text-[10px] font-bold text-white shadow-sm">
                {alarmCount}
              </span>
            )}
          </div>
          <span className="mt-1 text-[11px] font-medium tracking-tight">Alarms</span>
        </button>

        {/* Tab 2: AI Assistant */}
        <button
          type="button"
          onClick={() => onNavigate('assistant')}
          className="group flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center text-[#6B7280] hover:text-[#3B3D78] transition-colors"
        >
          <AiIcon className="h-5 w-5 transition-transform group-hover:scale-105" />
          <span className="mt-1 text-[11px] font-medium tracking-tight">AI Assistant</span>
        </button>

        {/* Center Raised Button: New Alarm (+) */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            onClick={onOpenNewAlarm}
            aria-label="New Alarm"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#3B3D78] hover:bg-[#2E2F6B] text-white shadow-[0_8px_20px_rgba(59,61,120,0.45)] border-4 border-white transition-all transform active:scale-95 hover:scale-105"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
          <span className="mt-1 text-[11px] font-semibold text-[#1E1B4B]">New Alarm</span>
        </div>

        {/* Tab 3: Schedule */}
        <button
          type="button"
          onClick={() => onNavigate('schedule')}
          className="group flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center text-[#6B7280] hover:text-[#3B3D78] transition-colors"
        >
          <Calendar className="h-5 w-5 transition-transform group-hover:scale-105" />
          <span className="mt-1 text-[11px] font-medium tracking-tight">Schedule</span>
        </button>

        {/* Tab 4: Settings */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="group flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center text-[#6B7280] hover:text-[#3B3D78] transition-colors"
        >
          <Settings className="h-5 w-5 transition-transform group-hover:scale-105" />
          <span className="mt-1 text-[11px] font-medium tracking-tight">Settings</span>
        </button>
      </div>
    </nav>
  );
};
