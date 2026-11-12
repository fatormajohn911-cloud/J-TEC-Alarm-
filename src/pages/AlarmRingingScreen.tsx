import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Alarm } from '../types/alarm';
import { ScheduleRoutine } from '../types/schedule';
import { AppSettings } from '../types/settings';
import { alarmAudio } from '../services/nativeAlarmPlugin';
import { generateMorningBriefing } from '../services/geminiText';
import {
  speakText,
  stopVoicePlayback,
  stripMarkdownForSpeech,
} from '../services/geminiVoice';
import { hapticsService } from '../services/hapticsService';
import { Clock, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { AiIcon } from '../components/common/AiIcon';

interface AlarmRingingScreenProps {
  alarm: Alarm;
  settings?: AppSettings;
  routines?: ScheduleRoutine[];
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

export const AlarmRingingScreen: React.FC<AlarmRingingScreenProps> = ({
  alarm,
  settings,
  routines = [],
  onDismiss,
  onSnooze,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [briefingText, setBriefingText] = useState<string>(
    `Good morning${settings?.userName ? `, ${settings.userName}` : ''}. Preparing your morning briefing...`
  );
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false);

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

    return () => {
      alarmAudio.stopAlarmLoop();
      stopVoicePlayback();
      clearInterval(clockTimer);
    };
  }, [alarm.soundId, alarm.volume]);

  // Ringtone starts immediately; after ~5 seconds, duck ringtone and play prepared briefing
  useEffect(() => {
    if (!alarm.aiBriefing) return;

    let cancelled = false;
    const todayIndex = new Date().getDay();
    const todayRoutines = routines
      .filter((r) => r.dayOfWeek === todayIndex)
      .sort((a, b) => a.time.localeCompare(b.time));

    const persona = alarm.aiVoiceStyle || settings?.aiVoiceStyle || 'warm';
    const speechRate = settings?.speechRate ?? 1.0;
    const fullVolume = alarm.volume ?? 85;
    const duckedVolume = Math.max(10, Math.round(fullVolume * 0.18));

    const timerId = window.setTimeout(async () => {
      if (cancelled) return;

      // Prefer offline pre-prepared briefing text if available (no network dependency at ring time)
      let text = '';
      try {
        text = localStorage.getItem(`ai_wake_briefing_text_${alarm.id}`) || '';
      } catch {
        text = '';
      }

      if (!text && navigator.onLine) {
        try {
          text = await generateMorningBriefing({
            userName: settings?.userName || 'Friend',
            alarmLabel: alarm.label || 'Morning Wake',
            currentDateTime: new Date().toLocaleString(),
            routines: todayRoutines.map((r) => ({
              time: r.time,
              title: r.title,
              durationMinutes: r.durationMinutes,
            })),
            includeWeather: settings?.aiBriefingWeather ?? true,
            includeCalendar: settings?.aiBriefingCalendar ?? true,
            includeMotivation: settings?.aiBriefingMotivation ?? true,
            voiceStyle: persona,
          });
        } catch {
          text = '';
        }
      }

      if (!text) {
        const firstRoutine = todayRoutines[0];
        text = `Good morning${settings?.userName ? `, ${settings.userName}` : ''}. ${
          firstRoutine
            ? `Your first routine today is ${firstRoutine.title} at ${firstRoutine.time}.`
            : 'Have a focused and energizing start to your day.'
        }`;
      }

      if (cancelled || !text) return;
      const cleanText = stripMarkdownForSpeech(text);
      setBriefingText(cleanText);

      try {
        alarmAudio.setLoopVolume(duckedVolume);
        setIsSpeakingVoice(true);
        await speakText({
          text: cleanText,
          persona,
          speechRate,
          playbackId: `ringing_${alarm.id}`,
          onEnded: () => {
            alarmAudio.setLoopVolume(fullVolume);
            if (!cancelled) setIsSpeakingVoice(false);
          },
        });
      } catch {
        // Silent fallback: restore ringtone volume and continue ringing uninterrupted
        alarmAudio.setLoopVolume(fullVolume);
        if (!cancelled) setIsSpeakingVoice(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      alarmAudio.setLoopVolume(fullVolume);
      stopVoicePlayback();
    };
  }, [alarm, settings, routines]);

  const handleToggleSpeak = async () => {
    hapticsService.light();
    if (isSpeakingVoice) {
      stopVoicePlayback();
      setIsSpeakingVoice(false);
      return;
    }

    const persona = alarm.aiVoiceStyle || settings?.aiVoiceStyle || 'warm';
    const speechRate = settings?.speechRate ?? 1.0;
    try {
      setIsSpeakingVoice(true);
      await speakText({
        text: briefingText,
        persona,
        speechRate,
        onEnded: () => setIsSpeakingVoice(false),
      });
    } catch {
      setIsSpeakingVoice(false);
    }
  };

  const handleSnooze = () => {
    hapticsService.medium();
    alarmAudio.stopAlarmLoop();
    stopVoicePlayback();
    onSnooze(alarm.snoozeIntervalMinutes);
  };

  const handleDismiss = () => {
    hapticsService.success();
    alarmAudio.stopAlarmLoop();
    stopVoicePlayback();
    onDismiss();
  };

  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

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
          <div className="mt-8 w-full max-w-md rounded-[28px] bg-white/10 border border-white/20 p-5 shadow-2xl backdrop-blur-md text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F5B800]">
                <AiIcon className="h-4 w-4 animate-pulse" />
                <span>AI Wake Morning Intelligence</span>
              </div>
              <button
                type="button"
                onClick={handleToggleSpeak}
                aria-label={isSpeakingVoice ? 'Stop voice briefing' : 'Play voice briefing'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                {isSpeakingVoice ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-white/95 leading-relaxed min-h-[44px]">
              "{briefingText}"
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
