import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Alarm } from '../types/alarm';
import { alarmAudio } from '../services/nativeAlarmPlugin';
import { hapticsService } from '../services/hapticsService';
import { BellOff, Clock, Volume2, ArrowRight } from 'lucide-react';
import { AiIcon } from '../components/common/AiIcon';

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
  const [briefingStep, setBriefingStep] = useState(0);

  // Slide to dismiss motion value
  const dragX = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [maxDragDistance, setMaxDragDistance] = useState(240);

  useEffect(() => {
    if (trackRef.current) {
      setMaxDragDistance(trackRef.current.offsetWidth - 64);
    }
  }, []);

  const sliderOpacity = useTransform(dragX, [0, maxDragDistance], [1, 0.2]);

  useEffect(() => {
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
    hapticsService.medium();
    alarmAudio.stopAlarmLoop();
    onSnooze(alarm.snoozeIntervalMinutes);
  };

  const handleDismiss = () => {
    hapticsService.success();
    alarmAudio.stopAlarmLoop();
    onDismiss();
  };

  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

  const briefingLines = [
    "Good morning. It is time to begin your day with clarity and intention.",
    "Today's forecast: 18°C, calm morning breeze, clear sunrise.",
    "First routine at 07:00 AM: Hydration & Sunlight Protocol.",
    "All alarms and schedule items synchronized. Have a wonderful day.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#1E1B4B] via-[#2E2F6B] to-[#1E1B4B] text-white p-6 sm:p-10 select-none overflow-hidden pt-safe pb-safe">
      {/* Background ambient pulsing radial glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30"
        aria-hidden="true"
      >
        <div className="h-[460px] w-[460px] rounded-full bg-[#9C1C7C]/40 blur-[130px] animate-pulse" />
      </div>

      {/* Top Status */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-[#9C1C7C] bg-white px-3.5 py-1.5 rounded-full shadow-md">
          <Volume2 className="h-3.5 w-3.5 animate-bounce" />
          <span>Alarm Active</span>
        </div>

        <span className="text-xs font-semibold text-purple-200 uppercase tracking-widest">
          AI Wake
        </span>
      </div>

      {/* Center Hero Clock & Label */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto">
        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-purple-200">
          {alarm.label || 'Wake Up Alarm'}
        </span>

        {/* Huge Time */}
        <div className="mt-2 flex items-baseline justify-center font-mono-numbers">
          <span className="text-7xl sm:text-8xl md:text-9xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_30px_rgba(156,28,124,0.35)]">
            {hours}:{minutes}
          </span>
          <span className="ml-3 text-2xl sm:text-3xl text-purple-200 font-mono-numbers font-medium">
            :{seconds}
          </span>
        </div>

        {/* Subtle Multi-Bar Soundwave Pulse */}
        <div className="mt-8 flex items-center justify-center gap-1.5 h-12" aria-label="Audio Wave">
          {[16, 28, 48, 36, 56, 42, 60, 32, 50, 24, 40, 20].map((height, i) => (
            <div
              key={i}
              style={{
                height: `${height}px`,
                animationDelay: `${i * 110}ms`,
                animationDuration: '1.2s',
              }}
              className="w-1.5 sm:w-2 rounded-full bg-gradient-to-t from-[#9C1C7C] via-[#B0207F] to-[#12A6A0] animate-pulse"
            />
          ))}
        </div>

        {/* AI Briefing Speech Area */}
        {alarm.aiBriefing && (
          <div className="mt-8 max-w-md rounded-[28px] bg-white/10 border border-white/20 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F5B800]">
              <AiIcon className="h-4 w-4 animate-pulse" />
              <span>AI Wake Morning Intelligence</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-white/95 leading-relaxed min-h-[44px]">
              "{briefingLines[briefingStep]}"
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls: SLIDE-TO-DISMISS + BIG SNOOZE */}
      <div className="relative z-10 mx-auto w-full max-w-md space-y-3.5 pb-2">
        {/* Slide-to-Dismiss Track */}
        <div
          ref={trackRef}
          className="relative h-16 w-full rounded-full bg-white/20 backdrop-blur-md border border-white/20 p-1 flex items-center overflow-hidden"
        >
          {/* Centered Guide Text */}
          <motion.div
            style={{ opacity: sliderOpacity }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
              Slide to dismiss →
            </span>
          </motion.div>

          {/* Draggable Knob */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: maxDragDistance }}
            dragElastic={0.08}
            dragSnapToOrigin={false}
            style={{ x: dragX }}
            onDragEnd={(_, info) => {
              if (info.offset.x > maxDragDistance * 0.7) {
                handleDismiss();
              } else {
                dragX.set(0);
              }
            }}
            className="flex h-14 w-14 cursor-grab active:cursor-grabbing items-center justify-center rounded-full bg-white text-[#1E1B4B] shadow-xl"
          >
            <ArrowRight className="h-6 w-6 text-[#9C1C7C] stroke-[2.5]" />
          </motion.div>
        </div>

        {/* Big Snooze Button */}
        <button
          type="button"
          onClick={handleSnooze}
          className="w-full min-h-[52px] rounded-2xl bg-white/15 hover:bg-white/25 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all backdrop-blur-md border border-white/20"
        >
          <Clock className="h-4 w-4 text-[#F5B800]" />
          <span>Snooze for {alarm.snoozeIntervalMinutes} min</span>
        </button>
      </div>
    </div>
  );
};
