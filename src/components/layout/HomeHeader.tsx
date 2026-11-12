import React from 'react';
import { Bell, ChevronDown } from 'lucide-react';

interface HomeHeaderProps {
  userName?: string;
  onOpenNotifications: () => void;
  unreadCount?: number;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName = 'Alex',
  onOpenNotifications,
  unreadCount = 2,
}) => {
  return (
    <div className="w-full bg-gradient-to-r from-[#3F4080] via-[#353676] to-[#2E2F6B] text-white pt-safe px-5 pb-16">
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between">
        {/* Left: Greeting + dropdown chevron */}
        <button
          type="button"
          aria-label="User profile selector"
          className="flex items-center gap-1.5 text-left group"
        >
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-purple-200 transition-colors">
            Hi, {userName}
          </span>
          <ChevronDown className="h-5 w-5 text-white/80 group-hover:text-white transition-transform group-hover:translate-y-0.5" />
        </button>

        {/* Right: Notification bell with notification dot */}
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors"
        >
          <Bell className="h-5 w-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5 rounded-full bg-[#9C1C7C] ring-2 ring-[#353676]" />
          )}
        </button>
      </div>
    </div>
  );
};
