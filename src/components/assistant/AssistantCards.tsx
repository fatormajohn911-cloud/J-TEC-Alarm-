import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AssistantActionResult,
  AssistantProposal,
  ProposedAlarmData,
  ProposedRoutineItem,
} from '../../types/assistant';
import {
  formatDaysLabel,
  formatTimeDisplay,
  formatTotalDuration,
} from '../../services/assistantService';
import { hapticsService } from '../../services/hapticsService';
import {
  AlarmClock,
  Calendar,
  Check,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SNOOZE_OPTIONS = [5, 9, 10, 15];

function getCategoryDotColor(category: string): string {
  switch (category) {
    case 'morning_routine':
      return 'bg-[#F5B800]';
    case 'health':
      return 'bg-[#9C1C7C]';
    case 'work':
      return 'bg-[#3B3D78]';
    case 'evening':
      return 'bg-[#12A6A0]';
    default:
      return 'bg-[#F57C1F]';
  }
}

/**
 * Strips leftover markdown symbols (*, #, `, bullet markers) while rendering **bold** safely as font-semibold.
 */
export const FormattedPlainText: React.FC<{ text: string }> = ({ text }) => {
  const cleanedLines = text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[-*•◦]\s+/, '')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/[*#`]/g, (ch, offset, str) => {
          // Preserve ** pairs for bold rendering below; strip single * / # / `
          if (ch === '*') {
            if (str[offset + 1] === '*' || str[offset - 1] === '*') {
              return '*';
            }
          }
          return '';
        })
    )
    .join('\n')
    .trim();

  // Convert **bold** segments safely without leaving raw asterisks
  const parts = cleanedLines.split(/(\*\*[^*]+\*\*)/g);

  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <span key={idx} className="font-semibold">
              {part.slice(2, -2).replace(/\*/g, '')}
            </span>
          );
        }
        return <React.Fragment key={idx}>{part.replace(/\*/g, '')}</React.Fragment>;
      })}
    </p>
  );
};

interface ActionResultCardProps {
  action: AssistantActionResult;
  onUndo: (action: AssistantActionResult) => void;
  onViewAlarm: (alarmId: string) => void;
  onViewSchedule: (dayOfWeek?: number) => void;
}

export const ActionResultCard: React.FC<ActionResultCardProps> = ({
  action,
  onUndo,
  onViewAlarm,
  onViewSchedule,
}) => {
  const isRoutine =
    action.type === 'add_routine' || action.type === 'delete_routine';
  const isDeleted =
    action.type === 'delete_alarm' || action.type === 'delete_routine';
  const Icon = isRoutine ? Calendar : isDeleted ? Trash2 : AlarmClock;
  const canView =
    !action.undone &&
    !isDeleted &&
    (Boolean(action.alarmId) || action.routineDay !== undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`touch-pan-y rounded-2xl border bg-white px-3.5 py-2.5 shadow-xs transition-opacity ${
        action.undone ? 'border-gray-100 opacity-65' : 'border-gray-200/80'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            action.undone
              ? 'bg-gray-100 text-gray-400'
              : isDeleted
              ? 'bg-red-50 text-red-500'
              : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {!action.undone && (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            )}
            <span className="text-xs font-bold text-[#1E1B4B] leading-snug break-words">
              {action.title}
            </span>
          </div>
          {action.subtitle && (
            <div className="mt-0.5 text-[11px] text-[#6B7280] leading-snug break-words">
              {action.subtitle}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {action.undone ? (
              <span className="text-[11px] font-bold text-[#6B7280]">
                Undone
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onUndo(action)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F3F3F5] hover:bg-gray-200 px-2.5 py-1 text-[11px] font-bold text-[#6B7280] hover:text-[#1E1B4B] transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Undo</span>
                </button>
                {canView && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticsService.light();
                      if (action.alarmId) {
                        onViewAlarm(action.alarmId);
                      } else if (action.routineDay !== undefined) {
                        onViewSchedule(action.routineDay);
                      }
                    }}
                    className="rounded-lg bg-[#3B3D78]/10 hover:bg-[#3B3D78]/20 px-2.5 py-1 text-[11px] font-bold text-[#3B3D78] transition-colors"
                  >
                    View
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface ProposalCardProps {
  proposal: AssistantProposal;
  timeFormat24h: boolean;
  onApproveAlarm: (proposalId: string, data: ProposedAlarmData) => void;
  onApproveRoutinePlan: (proposalId: string, items: ProposedRoutineItem[]) => void;
  onApproveDelete: (proposalId: string) => void;
  onCancelProposal: (proposalId: string) => void;
  onUpdateProposalItems: (proposalId: string, items: ProposedRoutineItem[]) => void;
  onUndoAction: (action: AssistantActionResult) => void;
  onViewAlarm: (alarmId: string) => void;
  onViewSchedule: (dayOfWeek?: number) => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  timeFormat24h,
  onApproveAlarm,
  onApproveRoutinePlan,
  onApproveDelete,
  onCancelProposal,
  onUpdateProposalItems,
  onUndoAction,
  onViewAlarm,
  onViewSchedule,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Local editable alarm state when editing an alarm proposal
  const [draftAlarm, setDraftAlarm] = useState<ProposedAlarmData | undefined>(
    proposal.alarmData
  );
  // Local editable routine items when editing a routine plan
  const [draftRoutines, setDraftRoutines] = useState<ProposedRoutineItem[]>(
    proposal.routineItems || []
  );

  // Sync when proposal items change (e.g. item tapped to remove)
  React.useEffect(() => {
    setDraftRoutines(proposal.routineItems || []);
  }, [proposal.routineItems]);

  React.useEffect(() => {
    setDraftAlarm(proposal.alarmData);
  }, [proposal.alarmData]);

  // Approved state -> render crisp success ActionResultCard
  if (proposal.status === 'approved' && proposal.appliedAction) {
    return (
      <ActionResultCard
        action={proposal.appliedAction}
        onUndo={onUndoAction}
        onViewAlarm={onViewAlarm}
        onViewSchedule={onViewSchedule}
      />
    );
  }

  // Cancelled state -> subtle muted card
  if (proposal.status === 'cancelled') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-gray-100 bg-[#F9FAFB] px-3.5 py-2.5 text-[11px] font-semibold text-[#6B7280]"
      >
        {proposal.kind === 'delete_proposal' ? 'Kept unchanged' : 'Cancelled'}
      </motion.div>
    );
  }

  // 1. ALARM PROPOSAL CARD
  if (proposal.kind === 'alarm_proposal' && draftAlarm) {
    const timeText = formatTimeDisplay(draftAlarm.time, timeFormat24h);
    const isUpdate = draftAlarm.mode === 'update' || draftAlarm.mode === 'toggle';

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="touch-pan-y rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm"
      >
        {!isEditing ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono-numbers text-2xl font-extrabold tracking-tight text-[#1E1B4B]">
                  {timeText}
                </div>
                <div className="mt-1 text-xs font-bold text-[#1E1B4B] leading-snug break-words">
                  {draftAlarm.label}
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3B3D78]/10 text-[#3B3D78]">
                <AlarmClock className="h-4 w-4" />
              </div>
            </div>

            {/* Repeat days as small chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {DAY_LABELS.map((letter, idx) => {
                const active = draftAlarm.days.includes(idx);
                return (
                  <span
                    key={idx}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-[#3B3D78] text-white'
                        : 'bg-[#F3F3F5] text-gray-400'
                    }`}
                  >
                    {letter}
                  </span>
                );
              })}
              {draftAlarm.days.length === 0 && (
                <span className="ml-1.5 rounded-full bg-[#F3F3F5] px-2 py-0.5 text-[10px] font-bold text-[#6B7280]">
                  Once
                </span>
              )}
            </div>

            {/* Snooze & Briefing metadata */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#6B7280]">
              <span>{draftAlarm.snoozeIntervalMinutes}m snooze</span>
              <span>·</span>
              <span>
                {draftAlarm.aiBriefing ? 'AI Briefing On' : 'Briefing Off'}
              </span>
              {draftAlarm.mode === 'toggle' && (
                <>
                  <span>·</span>
                  <span>{draftAlarm.enabled ? 'Turn On' : 'Turn Off'}</span>
                </>
              )}
            </div>

            {/* Buttons: [Set Alarm] [Edit] [Cancel] */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticsService.success();
                  onApproveAlarm(proposal.id, draftAlarm);
                }}
                className="flex-1 min-w-[100px] min-h-[38px] rounded-xl bg-[#3B3D78] hover:bg-[#2E2F6B] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors active:scale-98"
              >
                {isUpdate ? 'Apply Change' : 'Set Alarm'}
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticsService.light();
                  setIsEditing(true);
                }}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#1E1B4B] transition-colors"
              >
                <Pencil className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticsService.light();
                  onCancelProposal(proposal.id);
                }}
                className="min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#6B7280] hover:bg-gray-100 hover:text-[#1E1B4B] transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          /* Inline Alarm Editor */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#3B3D78]">Edit Alarm Proposal</span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-[#6B7280] hover:text-[#1E1B4B]"
              >
                Done
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-[#6B7280] block mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={draftAlarm.time}
                  onChange={(e) =>
                    setDraftAlarm({ ...draftAlarm, time: e.target.value || '07:00' })
                  }
                  className="w-full rounded-xl bg-[#F3F3F5] px-3 py-2 text-xs font-mono-numbers font-bold text-[#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#3B3D78]/30"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6B7280] block mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={draftAlarm.label}
                  onChange={(e) =>
                    setDraftAlarm({ ...draftAlarm, label: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#F3F3F5] px-3 py-2 text-xs font-semibold text-[#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#3B3D78]/30"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#6B7280] block mb-1">
                Repeat Days
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((letter, idx) => {
                  const active = draftAlarm.days.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const nextDays = active
                          ? draftAlarm.days.filter((d) => d !== idx)
                          : [...draftAlarm.days, idx].sort((a, b) => a - b);
                        setDraftAlarm({ ...draftAlarm, days: nextDays });
                      }}
                      className={`h-7 w-7 rounded-full text-[11px] font-bold transition-colors ${
                        active
                          ? 'bg-[#3B3D78] text-white'
                          : 'bg-[#F3F3F5] text-[#6B7280]'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {SNOOZE_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() =>
                      setDraftAlarm({ ...draftAlarm, snoozeIntervalMinutes: mins })
                    }
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                      draftAlarm.snoozeIntervalMinutes === mins
                        ? 'bg-[#9C1C7C] text-white'
                        : 'bg-[#F3F3F5] text-[#6B7280]'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setDraftAlarm({
                    ...draftAlarm,
                    aiBriefing: !draftAlarm.aiBriefing,
                  })
                }
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  draftAlarm.aiBriefing
                    ? 'bg-[#3B3D78]/10 text-[#3B3D78]'
                    : 'bg-[#F3F3F5] text-[#6B7280]'
                }`}
              >
                {draftAlarm.aiBriefing ? 'Briefing On' : 'Briefing Off'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticsService.success();
                setIsEditing(false);
                onApproveAlarm(proposal.id, {
                  ...draftAlarm,
                  label: draftAlarm.label.trim() || 'Alarm',
                });
              }}
              className="w-full min-h-[38px] rounded-xl bg-[#3B3D78] hover:bg-[#2E2F6B] py-2 text-xs font-bold text-white transition-colors"
            >
              {isUpdate ? 'Save & Apply' : 'Set Alarm'}
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // 2. SCHEDULE / ROUTINE PLAN CARD
  if (proposal.kind === 'routine_plan') {
    const items = isEditing ? draftRoutines : proposal.routineItems || [];
    const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);

    const handleRemoveItem = (itemId: string) => {
      hapticsService.light();
      const next = items.filter((i) => i.id !== itemId);
      setDraftRoutines(next);
      onUpdateProposalItems(proposal.id, next);
      if (next.length === 0) {
        onCancelProposal(proposal.id);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="touch-pan-y rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm"
      >
        {/* Top Summary Header */}
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-[#1E1B4B] leading-snug break-words">
              Schedule Plan
            </div>
            <div className="mt-0.5 text-[11px] font-bold text-[#9C1C7C] leading-snug break-words">
              {items.length} {items.length === 1 ? 'task' : 'tasks'} ·{' '}
              {formatTotalDuration(totalMinutes)}
            </div>
          </div>
          {!isEditing && (
            <span className="text-[10px] font-semibold text-[#6B7280] shrink-0">
              Tap item to remove
            </span>
          )}
        </div>

        {/* Vertical Timeline */}
        {!isEditing ? (
          <div className="mt-3 space-y-2.5">
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;
              const daysText = formatDaysLabel(item.days);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  title="Tap to remove item"
                  className="group flex w-full items-start gap-2.5 text-left rounded-xl p-1 -mx-1 hover:bg-red-50/50 transition-colors"
                >
                  {/* Time on left */}
                  <span className="w-16 shrink-0 pt-0.5 text-[11px] font-mono-numbers font-bold text-[#6B7280]">
                    {formatTimeDisplay(item.time, timeFormat24h)}
                  </span>

                  {/* Timeline dot + connector */}
                  <div className="flex flex-col items-center self-stretch pt-1.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${getCategoryDotColor(
                        item.category
                      )}`}
                    />
                    {!isLast && (
                      <span className="mt-1 w-px flex-1 bg-gray-200 min-h-[14px]" />
                    )}
                  </div>

                  {/* Title + Duration (wraps naturally, never truncated) */}
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="text-xs font-bold text-[#1E1B4B] leading-snug break-words group-hover:text-red-700">
                      {item.title}{' '}
                      <span className="font-semibold text-[#6B7280]">
                        · {item.durationMinutes}m
                      </span>
                    </div>
                    {item.days.length > 1 && (
                      <div className="mt-0.5 text-[10px] font-semibold text-[#6B7280] leading-snug break-words">
                        {daysText}
                      </div>
                    )}
                  </div>

                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-red-500 transition-colors" />
                </button>
              );
            })}
          </div>
        ) : (
          /* Inline Schedule Editor */
          <div className="mt-3 space-y-2.5">
            {draftRoutines.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-[#F3F3F5] p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={item.time}
                    onChange={(e) =>
                      setDraftRoutines((prev) =>
                        prev.map((r) =>
                          r.id === item.id
                            ? { ...r, time: e.target.value || '08:00' }
                            : r
                        )
                      )
                    }
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-mono-numbers font-bold text-[#1E1B4B]"
                  />
                  <input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={item.durationMinutes}
                    onChange={(e) =>
                      setDraftRoutines((prev) =>
                        prev.map((r) =>
                          r.id === item.id
                            ? {
                                ...r,
                                durationMinutes: Math.max(
                                  5,
                                  parseInt(e.target.value, 10) || 15
                                ),
                              }
                            : r
                        )
                      )
                    }
                    className="w-16 rounded-lg bg-white px-2 py-1 text-[11px] font-mono-numbers font-bold text-[#1E1B4B]"
                  />
                  <span className="text-[10px] font-bold text-[#6B7280]">min</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    aria-label="Remove item"
                    className="ml-auto text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) =>
                    setDraftRoutines((prev) =>
                      prev.map((r) =>
                        r.id === item.id ? { ...r, title: e.target.value } : r
                      )
                    )
                  }
                  className="w-full rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E1B4B]"
                />
              </div>
            ))}
          </div>
        )}

        {/* Buttons: [Approve & Add All] [Edit] [Cancel] */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => {
              hapticsService.success();
              const sanitized = items.map((r) => ({
                ...r,
                title: r.title.trim() || 'Daily Routine',
              }));
              setIsEditing(false);
              onApproveRoutinePlan(proposal.id, sanitized);
            }}
            className="flex-1 min-w-[125px] min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#3B3D78] hover:bg-[#2E2F6B] disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors active:scale-98"
          >
            <Check className="h-3.5 w-3.5" />
            <span>
              {items.length > 1 ? 'Approve & Add All' : 'Approve & Add'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              if (isEditing) {
                onUpdateProposalItems(proposal.id, draftRoutines);
              }
              setIsEditing((v) => !v);
            }}
            className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#1E1B4B] transition-colors"
          >
            <Pencil className="h-3 w-3" />
            <span>{isEditing ? 'Done' : 'Edit'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              onCancelProposal(proposal.id);
            }}
            className="min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#6B7280] hover:bg-gray-100 hover:text-[#1E1B4B] transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    );
  }

  // 3. DELETE PROPOSAL CARD
  if (proposal.kind === 'delete_proposal' && proposal.deleteData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="touch-pan-y rounded-2xl border border-red-200/80 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[#1E1B4B] leading-snug break-words">
              {proposal.deleteData.title}
            </div>
            <div className="mt-0.5 text-[11px] text-[#6B7280] leading-snug break-words">
              {proposal.deleteData.subtitle}
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticsService.medium();
              onApproveDelete(proposal.id);
            }}
            className="flex-1 min-h-[38px] rounded-xl bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              onCancelProposal(proposal.id);
            }}
            className="flex-1 min-h-[38px] rounded-xl bg-[#F3F3F5] hover:bg-gray-200 px-3 py-1.5 text-xs font-bold text-[#1E1B4B] transition-colors"
          >
            Keep
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
};
