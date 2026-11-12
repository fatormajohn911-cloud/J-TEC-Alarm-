import React from 'react';
import { Alarm } from '../../types/alarm';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { Edit2, Trash2, Volume2, Sparkles, Play, BellRing } from 'lucide-react';

interface AlarmCardProps {
  alarm: Alarm;
  timeFormat24h?: boolean;
  onToggle: (id: string) => void;
  onEdit: (alarm: Alarm) => void;
  onDelete: (id: string) => void;
  onTestRing: (alarm: Alarm) => void;
}

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const AlarmCard: React.FC<AlarmCardProps> = ({
  alarm,
  timeFormat24h = false,
  onToggle,
  onEdit,
  onDelete,
  onTestRing,
}) => {
  const [hStr, mStr] = alarm.time.split(':');
  const hNum = parseInt(hStr, 10);
  const period = hNum >= 12 ? 'PM' : 'AM';
  const displayHours = timeFormat24h ? hStr : (hNum % 12 || 12).toString().padStart(2, '0');

  const isOneTime = !alarm.days || alarm.days.length === 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
        alarm.enabled
          ? 'bg-zinc-900/90 border-zinc-700/80 shadow-lg shadow-purple-950/10'
          : 'bg-zinc-900/40 border-zinc-800/60 opacity-75'
      }`}
    >
      <div className="p-5">
        {/* Top row: Time + Toggle Switch */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono-numbers text-3xl sm:text-4xl font-bold tracking-tight ${
                alarm.enabled ? 'text-zinc-50' : 'text-zinc-400'
              }`}
            >
              {displayHours}:{mStr}
            </span>
            {!timeFormat24h && (
              <span
                className={`text-xs sm:text-sm font-semibold tracking-wider ${
                  alarm.enabled ? 'text-purple-400' : 'text-zinc-400'
                }`}
              >
                {period}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ToggleSwitch
              checked={alarm.enabled}
              onChange={() => onToggle(alarm.id)}
              label={`Toggle ${alarm.label || 'alarm'}`}
            />
          </div>
        </div>

        {/* Middle row: Label */}
        <div className="mt-2">
          <h3
            className={`text-sm sm:text-base font-semibold truncate ${
              alarm.enabled ? 'text-zinc-200' : 'text-zinc-400'
            }`}
          >
            {alarm.label || 'Alarm'}
          </h3>
        </div>

        {/* Repeat Days Row */}
        <div className="mt-3 flex items-center gap-1.5 sm:gap-2">
          {isOneTime ? (
            <span className="text-xs text-zinc-400 font-medium">Plays once</span>
          ) : (
            DAYS_SHORT.map((dayLabel, index) => {
              const isSelected = alarm.days.includes(index);
              return (
                <span
                  key={index}
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
                    isSelected
                      ? alarm.enabled
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                        : 'bg-zinc-800 text-zinc-400'
                      : 'text-zinc-600'
                  }`}
                >
                  {dayLabel}
                </span>
              );
            })
          )}
        </div>

        {/* Bottom Unboxed Metadata (Zero-Pill Compliance) */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1">
            <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>Vol {alarm.volume}%</span>
          </div>

          <span aria-hidden="true">·</span>
          <span>Snooze {alarm.snoozeIntervalMinutes}m</span>

          {alarm.aiBriefing && (
            <>
              <span aria-hidden="true">·</span>
              <div className="flex items-center gap-1 text-purple-300">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>AI Briefing</span>
              </div>
            </>
          )}

          {/* Action buttons on the right */}
          <div className="ml-auto flex items-center gap-1 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => onTestRing(alarm)}
              title="Test Ring this alarm"
              aria-label="Test Ring this alarm"
              className="flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 transition-colors"
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Test</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(alarm)}
              aria-label="Edit alarm"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(alarm.id)}
              aria-label="Delete alarm"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
