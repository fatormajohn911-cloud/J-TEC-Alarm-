import React from 'react';
import { Alarm } from '../../types/alarm';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { Edit2, Trash2, Volume2, BellRing, AlarmClock } from 'lucide-react';
import { AiIcon } from '../common/AiIcon';

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
      className={`relative overflow-clip rounded-[24px] border transition-all duration-200 touch-pan-y ${
        alarm.enabled
          ? 'bg-white border-gray-100 shadow-[0_4px_20px_rgba(30,27,75,0.06)]'
          : 'bg-[#F9FAFB] border-gray-100 opacity-70'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Top row: Time + Toggle Switch */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                alarm.enabled ? 'bg-[#9C1C7C]/15 text-[#9C1C7C]' : 'bg-gray-100 text-gray-400'
              }`}
            >
              <AlarmClock className="h-6 w-6 stroke-[2]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`font-mono-numbers text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    alarm.enabled ? 'text-[#9C1C7C]' : 'text-[#6B7280]'
                  }`}
                >
                  {displayHours}:{mStr}
                </span>
                {!timeFormat24h && (
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9C1C7C]">
                    {period}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[#1E1B4B] truncate mt-0.5">
                {alarm.label || 'Alarm'}
              </h3>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ToggleSwitch
              checked={alarm.enabled}
              onChange={() => onToggle(alarm.id)}
              label={`Toggle ${alarm.label || 'alarm'}`}
            />
          </div>
        </div>

        {/* Repeat Days Row */}
        <div className="mt-4 flex items-center gap-1.5">
          {isOneTime ? (
            <span className="text-xs text-[#6B7280] font-medium">Plays once</span>
          ) : (
            DAYS_SHORT.map((dayLabel, index) => {
              const isSelected = alarm.days.includes(index);
              return (
                <span
                  key={index}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isSelected
                      ? alarm.enabled
                        ? 'bg-[#3B3D78] text-white shadow-xs'
                        : 'bg-gray-200 text-gray-500'
                      : 'text-gray-400 bg-gray-50'
                  }`}
                >
                  {dayLabel}
                </span>
              );
            })
          )}
        </div>

        {/* Bottom Unboxed Metadata & Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex items-center gap-1">
              <Volume2 className="h-3.5 w-3.5 text-gray-400" />
              {alarm.volume}%
            </span>
            <span>·</span>
            <span>Snooze {alarm.snoozeIntervalMinutes}m</span>
            {alarm.aiBriefing && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-[#9C1C7C] font-semibold">
                  <AiIcon className="h-3.5 w-3.5" />
                  <span>
                    AI Briefing · {alarm.briefingReady ? (
                      <span className="text-emerald-600">Ready</span>
                    ) : (
                      <span className="text-[#6B7280] font-medium">Will prepare before alarm</span>
                    )}
                  </span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTestRing(alarm)}
              title="Test Ring"
              className="flex min-h-[36px] items-center gap-1 rounded-xl bg-[#F3F3F5] hover:bg-gray-200 px-2.5 py-1 text-xs font-bold text-[#3B3D78] transition-colors"
            >
              <BellRing className="h-3.5 w-3.5 text-[#9C1C7C]" />
              <span>Test</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(alarm)}
              aria-label="Edit alarm"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-gray-500 hover:text-[#1E1B4B] hover:bg-gray-100 transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(alarm.id)}
              aria-label="Delete alarm"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
