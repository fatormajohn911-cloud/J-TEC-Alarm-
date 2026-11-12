import React, { useState } from 'react';
import { Alarm, AVAILABLE_SOUNDS } from '../../types/alarm';
import { alarmAudio } from '../../services/nativeAlarmPlugin';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { X, Play, Square, Sparkles, Volume2, Clock, Check } from 'lucide-react';

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

export const AlarmFormModal: React.FC<AlarmFormModalProps> = ({
  isOpen,
  initialAlarm,
  timeFormat24h = false,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialAlarm);

  const [hours, setHours] = useState(() => {
    if (initialAlarm) {
      return initialAlarm.time.split(':')[0];
    }
    return '07';
  });

  const [minutes, setMinutes] = useState(() => {
    if (initialAlarm) {
      return initialAlarm.time.split(':')[1];
    }
    return '00';
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

  const toggleDay = (dayIndex: number) => {
    if (days.includes(dayIndex)) {
      setDays(days.filter((d) => d !== dayIndex));
    } else {
      setDays([...days, dayIndex].sort());
    }
  };

  const setWeekdayPreset = () => setDays([1, 2, 3, 4, 5]);
  const setWeekendPreset = () => setDays([0, 6]);
  const setEverydayPreset = () => setDays([0, 1, 2, 3, 4, 5, 6]);
  const setOncePreset = () => setDays([]);

  const handleTestSound = (idToTest: string) => {
    setIsPlayingSound(true);
    alarmAudio.playTone(idToTest, volume);
    setTimeout(() => setIsPlayingSound(false), 2600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedHours = hours.padStart(2, '0');
    const formattedMinutes = minutes.padStart(2, '0');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              {isEditing ? 'Edit Alarm' : 'Set New Alarm'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Time Dial / Stepper */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <label className="text-xs font-medium text-zinc-400">Select Time</label>
            <div className="mt-2 flex items-center gap-3 font-mono-numbers">
              {/* Hour input */}
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => {
                    const val = e.target.value.slice(-2);
                    setHours(val);
                  }}
                  className="w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-3xl font-bold text-zinc-100 focus:border-purple-500 focus:outline-none"
                  aria-label="Hours (0-23)"
                />
                <span className="mt-1 text-[11px] text-zinc-400 font-sans">Hour</span>
              </div>

              <span className="text-3xl font-light text-purple-400">:</span>

              {/* Minute input */}
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => {
                    const val = e.target.value.slice(-2);
                    setMinutes(val);
                  }}
                  className="w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-3xl font-bold text-zinc-100 focus:border-purple-500 focus:outline-none"
                  aria-label="Minutes (0-59)"
                />
                <span className="mt-1 text-[11px] text-zinc-400 font-sans">Minute</span>
              </div>
            </div>
          </div>

          {/* Alarm Label */}
          <div>
            <label htmlFor="alarm-label" className="text-xs font-medium text-zinc-300">
              Alarm Name
            </label>
            <input
              id="alarm-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Morning Awakening, Gym Session"
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Repeat Days */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">Repeat Days</label>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <button
                  type="button"
                  onClick={setWeekdayPreset}
                  className="hover:text-purple-300 underline underline-offset-2"
                >
                  Weekdays
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={setWeekendPreset}
                  className="hover:text-purple-300 underline underline-offset-2"
                >
                  Weekend
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={setOncePreset}
                  className="hover:text-purple-300 underline underline-offset-2"
                >
                  Once
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-7 gap-1.5">
              {DAYS.map((d) => {
                const isSelected = days.includes(d.index);
                return (
                  <button
                    key={d.index}
                    type="button"
                    onClick={() => toggleDay(d.index)}
                    aria-label={`Toggle ${d.label}`}
                    aria-pressed={isSelected}
                    className={`flex h-11 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-950/70 text-purple-200 shadow-sm'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>{d.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alarm Sound Selection */}
          <div>
            <label className="text-xs font-medium text-zinc-300">Ringtone Sound</label>
            <div className="mt-2 space-y-2">
              {AVAILABLE_SOUNDS.map((sound) => {
                const isSelected = soundId === sound.id;
                return (
                  <div
                    key={sound.id}
                    onClick={() => setSoundId(sound.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-purple-500/80 bg-purple-950/30 text-zinc-100'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-purple-400 bg-purple-600 text-white'
                            : 'border-zinc-600'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">{sound.name}</div>
                        <div className="text-[11px] text-zinc-400">{sound.description}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestSound(sound.id);
                      }}
                      title="Preview Sound"
                      aria-label={`Preview ${sound.name}`}
                      className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-purple-400 hover:bg-purple-900/40 hover:text-white transition-colors"
                    >
                      {isPlayingSound ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume slider */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
                Volume
              </span>
              <span className="font-mono-numbers text-zinc-400">{volume}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Snooze & Vibrate Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <label htmlFor="snooze-interval" className="text-xs font-medium text-zinc-300">
                Snooze Duration
              </label>
              <select
                id="snooze-interval"
                value={snoozeIntervalMinutes}
                onChange={(e) => setSnoozeIntervalMinutes(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 focus:border-purple-500 focus:outline-none"
              >
                <option value={5}>5 minutes</option>
                <option value={9}>9 minutes (classic)</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <span className="text-xs font-medium text-zinc-300">Vibrate</span>
              <ToggleSwitch checked={vibrate} onChange={setVibrate} label="Vibrate" />
            </div>
          </div>

          {/* AI Morning Briefing Section */}
          <div className="rounded-2xl border border-purple-900/50 bg-purple-950/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <div>
                  <h4 className="text-xs font-semibold text-zinc-100">AI Morning Briefing</h4>
                  <p className="text-[11px] text-zinc-400">
                    Spoken weather, agenda & encouragement upon wake-up
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={aiBriefing}
                onChange={setAiBriefing}
                label="AI Morning Briefing"
              />
            </div>

            {aiBriefing && (
              <div className="mt-3 pt-3 border-t border-purple-900/40">
                <label className="text-[11px] font-medium text-zinc-400">Voice Style Persona</label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(['warm', 'coach', 'executive'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setAiVoiceStyle(style)}
                      className={`min-h-[44px] rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                        aiVoiceStyle === style
                          ? 'border-purple-500 bg-purple-900/50 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 px-6 text-xs font-semibold text-white shadow-lg shadow-purple-600/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              {isEditing ? 'Save Changes' : 'Create Alarm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
