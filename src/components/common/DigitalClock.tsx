import React from 'react';
import { useClock } from '../../hooks/useClock';

interface DigitalClockProps {
  timeFormat24h?: boolean;
  showSeconds?: boolean;
  size?: 'large' | 'compact';
}

export const DigitalClock: React.FC<DigitalClockProps> = ({
  timeFormat24h = false,
  showSeconds = true,
  size = 'large',
}) => {
  const { hours, minutes, seconds, period, dateFormatted, greeting } = useClock(timeFormat24h);

  if (size === 'compact') {
    return (
      <div className="flex items-baseline gap-1.5 font-mono-numbers text-xl font-bold tracking-tight text-zinc-100">
        <span>{hours}</span>
        <span className="text-purple-400/80 animate-pulse">:</span>
        <span>{minutes}</span>
        {!timeFormat24h && (
          <span className="ml-1 text-xs font-sans font-medium text-zinc-400">
            {period}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
      {/* Subtle ambient violet radial gradient behind the clock */}
      <div
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-48 bg-purple-600/10 blur-3xl rounded-full"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Subtle greeting & unboxed date */}
        <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-zinc-400">
          <span>{greeting}</span>
          <span aria-hidden="true" className="text-zinc-600">·</span>
          <span>{dateFormatted}</span>
        </div>

        {/* Hero Clock Numbers */}
        <div className="mt-4 flex items-center justify-center font-mono-numbers">
          <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-zinc-50 drop-shadow-[0_2px_12px_rgba(255,255,255,0.08)]">
            {hours}
          </div>
          <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-purple-400/80 animate-pulse">
            :
          </div>
          <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-zinc-50 drop-shadow-[0_2px_12px_rgba(255,255,255,0.08)]">
            {minutes}
          </div>

          {/* Seconds & AM/PM cluster */}
          <div className="ml-3 sm:ml-4 flex flex-col items-start justify-center gap-0.5 self-center">
            {!timeFormat24h && (
              <span className="text-xs sm:text-sm font-semibold tracking-wider text-purple-400 font-sans">
                {period}
              </span>
            )}
            {showSeconds && (
              <span className="text-sm sm:text-base font-semibold text-zinc-400 font-mono-numbers">
                :{seconds}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
