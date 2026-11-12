import React, { useState, useEffect } from 'react';
import { Alarm } from '../types/alarm';
import { alarmAudio } from '../services/nativeAlarmPlugin';
import { Sparkles, BellOff, Clock, Volume2, ArrowLeft } from 'lucide-react';

interface AlarmRingingScreenProps {
  alarm: Alarm;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

export const AlarmRingingScreen: React.FC<AlarmRingingScreenProps> = ({
  alarm,
  onDismiss,
  onSnooze,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [snoozeSecondsLeft, setSnoozeSecondsLeft] = useState<number | null>(null);
  const [briefingStep, setBriefingStep] = useState(0);

  useEffect(() => {
    // Start peaceful ringtone loop using Web Audio API
    alarmAudio.startAlarmLoop(alarm.soundId, alarm.volume);

    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const briefingTimer = setInterval(() => {
      setBriefingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 2400);

    return () => {
      alarmAudio.stopAlarmLoop();
      clearInterval(clockTimer);
      clearInterval(briefingTimer);
    };
  }, [alarm.soundId, alarm.volume]);

  const handleSnooze = () => {
    alarmAudio.stopAlarmLoop();
    onSnooze(alarm.snoozeIntervalMinutes);
  };

  const handleDismiss = () => {
    alarmAudio.stopAlarmLoop();
    onDismiss();
  };

  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

  const briefingLines = [
    "Good morning. It is time to begin your day with intention and clarity.",
    "Today's forecast: 18°C, calm morning breeze, clean sunrise.",
    "First routine at 07:00 AM: Hydration & Sunlight Protocol.",
    "Your schedule is organized. Have a focused and productive day ahead.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-zinc-950 p-6 sm:p-10 select-none overflow-hidden">
      {/* Background ambient pulsing radial glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40"
        aria-hidden="true"
      >
        <div className="h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" />
      </div>

      {/* Top Bar: Return to App test control & Status */}
      <div className="relative z-10 flex items-center justify-between">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-zinc-900/80 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Ringing Mode</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/60 border border-purple-800/40 px-3 py-1.5 rounded-full">
          <Volume2 className="h-3.5 w-3.5 animate-bounce" />
          <span>Alarm Active</span>
        </div>
      </div>

      {/* Center Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto">
        {/* Alarm Label */}
        <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-purple-400">
          {alarm.label || 'Wake Up Alarm'}
        </span>

        {/* Massive Glowing Digital Clock */}
        <div className="mt-2 flex items-baseline justify-center font-mono-numbers">
          <span className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-tighter text-white drop-shadow-[0_4px_30px_rgba(168,85,247,0.3)]">
            {hours}:{minutes}
          </span>
          <span className="ml-3 text-2xl sm:text-3xl text-zinc-400 font-mono-numbers">
            :{seconds}
          </span>
        </div>

        {/* Animated Sound-Wave Frequency Bars */}
        <div className="mt-8 flex items-center justify-center gap-1.5 h-14" aria-label="Audio Visualizer">
          {[16, 28, 48, 36, 56, 42, 60, 32, 50, 24, 40, 20].map((height, i) => (
            <div
              key={i}
              style={{
                height: `${height}px`,
                animationDelay: `${i * 120}ms`,
                animationDuration: '1.4s',
              }}
              className="w-1.5 sm:w-2 rounded-full bg-gradient-to-t from-purple-600 to-violet-300 animate-pulse"
            />
          ))}
        </div>

        {/* AI Voice Message Area */}
        {alarm.aiBriefing && (
          <div className="mt-8 max-w-md rounded-2xl border border-purple-900/60 bg-zinc-900/80 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Sparkles className="h-4 w-4 text-purple-400 animate-spin" />
              <span>AI Wake Morning Intelligence</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-zinc-200 leading-relaxed min-h-[48px]">
              "{briefingLines[briefingStep]}"
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls: Snooze and Dismiss */}
      <div className="relative z-10 mx-auto w-full max-w-md space-y-3 pb-safe">
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full min-h-[56px] rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <BellOff className="h-5 w-5" />
          <span>Dismiss Alarm</span>
        </button>

        {/* Snooze Button */}
        <button
          type="button"
          onClick={handleSnooze}
          className="w-full min-h-[48px] rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-300 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Clock className="h-4 w-4 text-purple-400" />
          <span>Snooze for {alarm.snoozeIntervalMinutes} Minutes</span>
        </button>
      </div>
    </div>
  );
};
