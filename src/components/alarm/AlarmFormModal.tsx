import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Alarm, AVAILABLE_SOUNDS } from '../../types/alarm';
import { alarmAudio } from '../../services/nativeAlarmPlugin';
import { hapticsService } from '../../services/hapticsService';
import { ToggleSwitch } from '../common/ToggleSwitch';
import {
  X,
  Play,
  Square,
  Volume2,
  Clock,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { AiIcon } from '../common/AiIcon';

interface AlarmFormModalProps {
  isOpen: boolean;
  initialAlarm?: Alarm | null;
  timeFormat24h?: boolean;
  onClose: () => void;
  onSave: (alarm: Omit<Alarm, 'id' | 'createdAt'> | Alarm) => void;
}

const DAYS = [
  { index: 0, label: 'Sun', short: 'S' },
  { index: 1, label: 'Mon', short: 'M' },
  { index: 2, label: 'Tue', short: 'T' },
  { index: 3, label: 'Wed', short: 'W' },
  { index: 4, label: 'Thu', short: 'T' },
  { index: 5, label: 'Fri', short: 'F' },
  { index: 6, label: 'Sat', short: 'S' },
];

const SNOOZE_CHIPS = [5, 9, 10, 15];

export const AlarmFormModal: React.FC<AlarmFormModalProps> = ({
  isOpen,
  initialAlarm,
  timeFormat24h = false,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialAlarm);

  // Parse initial hours & minutes
  const [hourNum, setHourNum] = useState<number>(() => {
    if (initialAlarm) {
      return parseInt(initialAlarm.time.split(':')[0], 10);
    }
    return 7;
  });

  const [minNum, setMinNum] = useState<number>(() => {
    if (initialAlarm) {
      return parseInt(initialAlarm.time.split(':')[1], 10);
    }
    return 0;
  });

  const [label, setLabel] = useState(() => initialAlarm?.label || 'Morning Awakening');
  const [days, setDays] = useState<number[]>(() => initialAlarm?.days || [1, 2, 3, 4, 5]);
  const [soundId, setSoundId] = useState(() => initialAlarm?.soundId || 'aurora');
  const [volume, setVolume] = useState(() => initialAlarm?.volume ?? 85);
  const [vibrate, setVibrate] = useState(() => initialAlarm?.vibrate ?? true);
  const [snoozeIntervalMinutes, setSnoozeIntervalMinutes] = useState(
    () => initialAlarm?.snoozeIntervalMinutes ?? 9
  );
  const [snoozeLimit, setSnoozeLimit] = useState(() => initialAlarm?.snoozeLimit ?? 3);
  const [aiBriefing, setAiBriefing] = useState(() => initialAlarm?.aiBriefing ?? true);
  const [aiVoiceStyle, setAiVoiceStyle] = useState<'warm' | 'coach' | 'executive'>(
    () => initialAlarm?.aiVoiceStyle ?? 'warm'
  );

  const [isPlayingSound, setIsPlayingSound] = useState(false);

  if (!isOpen) return null;

  // Wheel step helpers
  const adjustHour = (delta: number) => {
    hapticsService.selection();
    setHourNum((prev) => (prev + delta + 24) % 24);
  };

  const adjustMinute = (delta: number) => {
    hapticsService.selection();
    setMinNum((prev) => (prev + delta + 60) % 60);
  };

  const toggleDay = (dayIndex: number) => {
    hapticsService.light();
    if (days.includes(dayIndex)) {
      setDays(days.filter((d) => d !== dayIndex));
    } else {
      setDays([...days, dayIndex].sort());
    }
  };

  const setWeekdayPreset = () => {
    hapticsService.light();
    setDays([1, 2, 3, 4, 5]);
  };
  const setWeekendPreset = () => {
    hapticsService.light();
    setDays([0, 6]);
  };
  const setEverydayPreset = () => {
    hapticsService.light();
    setDays([0, 1, 2, 3, 4, 5, 6]);
  };
  const setOncePreset = () => {
    hapticsService.light();
    setDays([]);
  };

  const handleTestSound = (idToTest: string) => {
    hapticsService.light();
    setIsPlayingSound(true);
    alarmAudio.playTone(idToTest, volume);
    setTimeout(() => setIsPlayingSound(false), 2400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    hapticsService.success();

    const formattedHours = hourNum.toString().padStart(2, '0');
    const formattedMinutes = minNum.toString().padStart(2, '0');
    const timeString = `${formattedHours}:${formattedMinutes}`;

    if (initialAlarm) {
      onSave({
        ...initialAlarm,
        time: timeString,
        label: label.trim() || 'Alarm',
        days,
        soundId,
        volume,
        vibrate,
        snoozeIntervalMinutes,
        snoozeLimit,
        aiBriefing,
        aiVoiceStyle,
      });
    } else {
      onSave({
        time: timeString,
        label: label.trim() || 'Alarm',
        days,
        enabled: true,
        soundId,
        volume,
        vibrate,
        snoozeIntervalMinutes,
        snoozeLimit,
        aiBriefing,
        aiVoiceStyle,
      });
    }
    onClose();
  };

  // 12h display helpers
  const period = hourNum >= 12 ? 'PM' : 'AM';
  const display12Hour = hourNum % 12 || 12;

  const toggleAmPm = () => {
    hapticsService.selection();
    setHourNum((prev) => (prev >= 12 ? prev - 12 : prev + 12));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative z-10 w-full max-w-[480px] rounded-t-[32px] bg-white shadow-2xl border-t border-gray-100 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Grab bar */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9C1C7C]/10 text-[#9C1C7C]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E1B4B]">
                {isEditing ? 'Edit Alarm' : 'Set New Alarm'}
              </h2>
              <p className="text-xs text-[#6B7280]">Precise waking & morning briefing</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* 1. BIG WHEEL TIME PICKER (Never clipped, 12h/24h aware) */}
          <div className="rounded-[28px] bg-[#F3F3F5] p-5 flex flex-col items-center justify-center border border-gray-100">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
              Alarm Time
            </span>

            <div className="flex items-center justify-center gap-3 font-mono-numbers">
              {/* Hour Wheel Stepper */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => adjustHour(1)}
                  aria-label="Increment hour"
                  className="flex h-9 w-14 items-center justify-center rounded-xl bg-white hover:bg-gray-200 text-[#3B3D78] shadow-xs active:scale-95"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>

                <div className="my-1.5 flex h-16 w-20 items-center justify-center rounded-2xl bg-white text-4xl sm:text-5xl font-extrabold text-[#1E1B4B] shadow-sm">
                  {timeFormat24h
                    ? hourNum.toString().padStart(2, '0')
                    : display12Hour.toString().padStart(2, '0')}
                </div>

                <button
                  type="button"
                  onClick={() => adjustHour(-1)}
                  aria-label="Decrement hour"
                  className="flex h-9 w-14 items-center justify-center rounded-xl bg-white hover:bg-gray-200 text-[#3B3D78] shadow-xs active:scale-95"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              <span className="text-3xl font-extrabold text-[#9C1C7C] pb-2">:</span>

              {/* Minute Wheel Stepper */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => adjustMinute(5)}
                  aria-label="Increment 5 minutes"
                  className="flex h-9 w-14 items-center justify-center rounded-xl bg-white hover:bg-gray-200 text-[#3B3D78] shadow-xs active:scale-95"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>

                <div className="my-1.5 flex h-16 w-20 items-center justify-center rounded-2xl bg-white text-4xl sm:text-5xl font-extrabold text-[#1E1B4B] shadow-sm">
                  {minNum.toString().padStart(2, '0')}
                </div>

                <button
                  type="button"
                  onClick={() => adjustMinute(-5)}
                  aria-label="Decrement 5 minutes"
                  className="flex h-9 w-14 items-center justify-center rounded-xl bg-white hover:bg-gray-200 text-[#3B3D78] shadow-xs active:scale-95"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              {/* AM/PM Switcher if in 12h format */}
              {!timeFormat24h && (
                <div className="flex flex-col gap-1.5 ml-1 self-center">
                  <button
                    type="button"
                    onClick={toggleAmPm}
                    className={`h-10 px-3 rounded-xl font-bold text-xs uppercase transition-all shadow-xs ${
                      period === 'AM'
                        ? 'bg-[#3B3D78] text-white shadow-sm'
                        : 'bg-white text-gray-400 hover:text-[#1E1B4B]'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={toggleAmPm}
                    className={`h-10 px-3 rounded-xl font-bold text-xs uppercase transition-all shadow-xs ${
                      period === 'PM'
                        ? 'bg-[#3B3D78] text-white shadow-sm'
                        : 'bg-white text-gray-400 hover:text-[#1E1B4B]'
                    }`}
                  >
                    PM
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Label Input */}
          <div>
            <label htmlFor="alarm-label-input" className="text-xs font-bold text-[#1E1B4B] block mb-1">
              Alarm Label
            </label>
            <input
              id="alarm-label-input"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Weekday Awakening, Morning Run"
              className="w-full rounded-2xl bg-[#F3F3F5] px-4 py-3 text-sm text-[#1E1B4B] placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#9C1C7C] focus:outline-none transition-all"
            />
          </div>

          {/* 2. REPEAT: DAY CHIPS PLUS SHORTCUTS BELOW */}
          <div>
            <label className="text-xs font-bold text-[#1E1B4B] block mb-2">Repeat Days</label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d) => {
                const isSelected = days.includes(d.index);
                return (
                  <button
                    key={d.index}
                    type="button"
                    onClick={() => toggleDay(d.index)}
                    aria-label={`Toggle ${d.label}`}
                    aria-pressed={isSelected}
                    className={`min-h-[48px] rounded-2xl text-xs font-bold flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#3B3D78] text-white shadow-sm scale-102'
                        : 'bg-[#F3F3F5] text-[#6B7280] hover:bg-gray-200'
                    }`}
                  >
                    <span>{d.short}</span>
                  </button>
                );
              })}
            </div>

            {/* Shortcuts row below it */}
            <div className="mt-2.5 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={setWeekdayPreset}
                className="rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#3B3D78] transition-colors"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={setWeekendPreset}
                className="rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#3B3D78] transition-colors"
              >
                Weekends
              </button>
              <button
                type="button"
                onClick={setEverydayPreset}
                className="rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#3B3D78] transition-colors"
              >
                Every day
              </button>
              <button
                type="button"
                onClick={setOncePreset}
                className="rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#3B3D78] transition-colors"
              >
                Once
              </button>
            </div>
          </div>

          {/* 3. SNOOZE AS SELECTABLE CHIPS (Instead of dropdown!) */}
          <div>
            <label className="text-xs font-bold text-[#1E1B4B] block mb-2">Snooze Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {SNOOZE_CHIPS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    hapticsService.light();
                    setSnoozeIntervalMinutes(mins);
                  }}
                  className={`min-h-[46px] rounded-2xl flex items-center justify-center font-bold text-xs transition-all ${
                    snoozeIntervalMinutes === mins
                      ? 'bg-[#9C1C7C] text-white shadow-sm scale-102'
                      : 'bg-[#F3F3F5] text-[#1E1B4B] hover:bg-gray-200'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* 4. SOUND LIST WITH PREVIEW PLAY BUTTONS, VOLUME SLIDER, AND VIBRATE TOGGLE */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#1E1B4B] block">Alarm Sound</label>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {AVAILABLE_SOUNDS.map((sound) => {
                const isSelected = soundId === sound.id;
                return (
                  <div
                    key={sound.id}
                    onClick={() => {
                      hapticsService.light();
                      setSoundId(sound.id);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl p-3 transition-colors ${
                      isSelected
                        ? 'bg-[#9C1C7C]/10 border border-[#9C1C7C]/30 text-[#1E1B4B]'
                        : 'bg-[#F3F3F5] text-[#6B7280] hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          isSelected ? 'bg-[#9C1C7C] text-white' : 'border-2 border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1E1B4B]">{sound.name}</div>
                        <div className="text-[11px] text-[#6B7280]">{sound.description}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestSound(sound.id);
                      }}
                      title="Preview Sound"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#9C1C7C] shadow-xs hover:scale-105"
                    >
                      {isPlayingSound ? (
                        <Square className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Volume slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-[#1E1B4B] flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4 text-[#9C1C7C]" />
                  Volume
                </span>
                <span className="font-mono-numbers font-bold text-[#9C1C7C]">{volume}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="w-full accent-[#9C1C7C]"
              />
            </div>

            {/* Vibrate Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5]">
              <span className="text-xs font-bold text-[#1E1B4B]">Vibration Feedback</span>
              <ToggleSwitch
                checked={vibrate}
                onChange={(v) => {
                  hapticsService.light();
                  setVibrate(v);
                }}
                label="Vibrate"
              />
            </div>
          </div>

          {/* AI Morning Briefing Toggle */}
          <div className="p-3.5 rounded-2xl bg-[#9C1C7C]/5 border border-[#9C1C7C]/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AiIcon className="h-5 w-5 text-[#9C1C7C]" />
              <div>
                <h4 className="text-xs font-bold text-[#1E1B4B]">AI Morning Briefing</h4>
                <p className="text-[11px] text-[#6B7280]">Spoken weather, agenda & encouragement</p>
              </div>
            </div>
            <ToggleSwitch
              checked={aiBriefing}
              onChange={(v) => {
                hapticsService.light();
                setAiBriefing(v);
              }}
              label="AI Morning Briefing"
            />
          </div>
        </form>

        {/* 5. STICKY BOTTOM "SAVE ALARM" BUTTON (Always visible) */}
        <div className="border-t border-gray-100 bg-white p-4 pb-safe flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[50px] rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 text-xs font-bold text-[#6B7280] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-[2] min-h-[50px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] text-white font-extrabold text-xs shadow-lg shadow-indigo-900/25 transition-all active:scale-98"
          >
            {isEditing ? 'Save Alarm Changes' : 'Set Alarm'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
