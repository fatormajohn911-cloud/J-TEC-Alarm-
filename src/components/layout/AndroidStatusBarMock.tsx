import React from 'react';
import { Wifi, Signal, BatteryMedium } from 'lucide-react';
import { useClock } from '../../hooks/useClock';

interface AndroidStatusBarMockProps {
  timeFormat24h?: boolean;
}

export const AndroidStatusBarMock: React.FC<AndroidStatusBarMockProps> = ({
  timeFormat24h = false,
}) => {
  const { hours, minutes } = useClock(timeFormat24h);

  return (
    <div className="flex h-7 w-full select-none items-center justify-between px-5 text-[12px] font-medium text-zinc-300">
      {/* Time */}
      <div className="flex items-center gap-1 font-mono-numbers">
        <span>{hours}:{minutes}</span>
      </div>

      {/* Center Camera Punch-hole indicator */}
      <div className="h-3.5 w-3.5 rounded-full bg-black border border-zinc-800 shadow-inner" />

      {/* Right Icons: Wifi, Signal, Battery */}
      <div className="flex items-center gap-2">
        <Signal className="h-3 w-3 text-zinc-300" />
        <Wifi className="h-3 w-3 text-zinc-300" />
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] font-mono-numbers">94%</span>
          <BatteryMedium className="h-3.5 w-3.5 text-zinc-300" />
        </div>
      </div>
    </div>
  );
};
