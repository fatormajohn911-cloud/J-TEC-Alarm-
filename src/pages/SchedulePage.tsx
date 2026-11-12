import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScheduleRoutine } from '../types/schedule';
import { AddRoutineModal } from '../components/schedule/AddRoutineModal';
import { PageHeader } from '../components/layout/PageHeader';
import { hapticsService } from '../services/hapticsService';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Sun,
  Briefcase,
  Heart,
  Moon,
  ListTodo,
} from 'lucide-react';

interface SchedulePageProps {
  routines: ScheduleRoutine[];
  selectedDay: number;
  onBack: () => void;
  onSelectDay: (day: number) => void;
  onToggleRoutine: (id: string) => void;
  onAddRoutine: (routine: Omit<ScheduleRoutine, 'id'>) => void;
  onDeleteRoutine: (id: string) => void;
}

const DAYS_NAV = [
  { dayIndex: 0, label: 'Sun', short: 'S' },
  { dayIndex: 1, label: 'Mon', short: 'M' },
  { dayIndex: 2, label: 'Tue', short: 'T' },
  { dayIndex: 3, label: 'Wed', short: 'W' },
  { dayIndex: 4, label: 'Thu', short: 'T' },
  { dayIndex: 5, label: 'Fri', short: 'F' },
  { dayIndex: 6, label: 'Sat', short: 'S' },
];

export const SchedulePage: React.FC<SchedulePageProps> = ({
  routines,
  selectedDay,
  onBack,
  onSelectDay,
  onToggleRoutine,
  onAddRoutine,
  onDeleteRoutine,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const dayRoutines = routines
    .filter((r) => r.dayOfWeek === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  const totalMinutes = dayRoutines.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  const completedCount = dayRoutines.filter((r) => r.completed).length;
  const progressRatio = dayRoutines.length > 0 ? completedCount / dayRoutines.length : 0;

  const getCategoryVisual = (category: string) => {
    switch (category) {
      case 'morning_routine':
        return { icon: Sun, color: 'bg-[#F5B800]/20 text-[#F5B800]' };
      case 'health':
        return { icon: Heart, color: 'bg-[#9C1C7C]/15 text-[#9C1C7C]' };
      case 'work':
        return { icon: Briefcase, color: 'bg-[#3B3D78]/15 text-[#3B3D78]' };
      case 'evening':
        return { icon: Moon, color: 'bg-[#12A6A0]/15 text-[#12A6A0]' };
      default:
        return { icon: ListTodo, color: 'bg-[#F57C1F]/15 text-[#F57C1F]' };
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white text-[#1E1B4B] flex flex-col">
      {/* Top Bar with Back Arrow */}
      <PageHeader
        title="Schedule"
        subtitle={`${dayRoutines.length} routines · ${totalMinutes}m planned`}
        onBack={onBack}
        rightAction={
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              setIsAddModalOpen(true);
            }}
            className="flex h-10 items-center gap-1 rounded-full bg-white text-[#3B3D78] px-3.5 py-1 text-xs font-bold shadow-sm hover:bg-gray-100 transition-colors"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add</span>
          </button>
        }
      />

      <div className="mx-auto w-full max-w-xl px-4 py-5 space-y-4 flex-1">
        {/* Horizontal Day Selector */}
        <div className="rounded-[24px] bg-[#F3F3F5] p-2">
          <div className="grid grid-cols-7 gap-1">
            {DAYS_NAV.map((item) => {
              const isSelected = selectedDay === item.dayIndex;
              return (
                <button
                  key={item.dayIndex}
                  type="button"
                  onClick={() => {
                    hapticsService.selection();
                    onSelectDay(item.dayIndex);
                  }}
                  className={`flex min-h-[50px] flex-col items-center justify-center rounded-2xl transition-all ${
                    isSelected
                      ? 'bg-[#3B3D78] text-white shadow-md font-bold scale-102'
                      : 'text-[#6B7280] hover:text-[#1E1B4B] font-semibold'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
                  <span className="text-sm font-mono-numbers">{item.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress & Summary Bar with SVG Circular Ring & Normal Font Done Count */}
        <div className="flex items-center justify-between p-4 rounded-[24px] bg-[#F3F3F5] border border-gray-100">
          <div className="flex items-center gap-3">
            {/* SVG Progress Ring */}
            <div className="relative h-10 w-10 flex items-center justify-center">
              <svg className="h-10 w-10 transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  className="stroke-gray-300"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  className="stroke-[#9C1C7C] transition-all duration-300"
                  strokeWidth="3.5"
                  strokeDasharray={`${progressRatio * 88} 88`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-[#1E1B4B] font-sans">
                {Math.round(progressRatio * 100)}%
              </span>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#1E1B4B]">Daily Wake Protocol</h3>
              <p className="text-[11px] text-[#6B7280]">
                {dayRoutines.length} items planned today
              </p>
            </div>
          </div>

          <div className="text-right">
            {/* Normal font, NOT monospace */}
            <span className="text-xs font-extrabold text-[#9C1C7C] font-sans">
              {completedCount} of {dayRoutines.length} done
            </span>
          </div>
        </div>

        {/* Routine Timeline List */}
        <div className="space-y-3 pb-24">
          {dayRoutines.length > 0 ? (
            dayRoutines.map((routine) => {
              const { icon: CatIcon, color: catColor } = getCategoryVisual(routine.category);
              return (
                <div
                  key={routine.id}
                  onClick={() => {
                    hapticsService.light();
                    onToggleRoutine(routine.id);
                  }}
                  className={`flex cursor-pointer items-start justify-between rounded-[24px] border p-4 transition-all ${
                    routine.completed
                      ? 'border-gray-100 bg-[#F9FAFB] opacity-65'
                      : 'border-gray-100 bg-white shadow-[0_4px_16px_rgba(30,27,75,0.05)] hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Completion Checkmark */}
                    <button
                      type="button"
                      aria-label={`Toggle completion of ${routine.title}`}
                      className="mt-1 flex h-6 w-6 items-center justify-center text-gray-400 hover:text-[#9C1C7C] transition-colors"
                    >
                      {routine.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 fill-emerald-50" />
                      ) : (
                        <Circle className="h-6 w-6 text-gray-300" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-lg ${catColor}`}
                        >
                          <CatIcon className="h-3.5 w-3.5" />
                        </div>
                        <h3
                          className={`text-sm font-bold ${
                            routine.completed ? 'line-through text-[#6B7280]' : 'text-[#1E1B4B]'
                          }`}
                        >
                          {routine.title}
                        </h3>
                      </div>

                      {routine.notes && (
                        <p className="mt-1 text-xs text-[#6B7280] max-w-sm">
                          {routine.notes}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-xs font-medium text-[#6B7280]">
                        <span className="font-mono-numbers font-bold text-[#9C1C7C]">
                          {routine.time}
                        </span>
                        <span>·</span>
                        <span>{routine.durationMinutes} min</span>
                        <span>·</span>
                        <span className="capitalize">{routine.category.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticsService.medium();
                      onDeleteRoutine(routine.id);
                    }}
                    aria-label="Delete routine"
                    className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-gray-200 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#12A6A0]/10 text-[#12A6A0] mb-3">
                <Calendar className="h-8 w-8 stroke-[2]" />
              </div>
              <h3 className="text-base font-bold text-[#1E1B4B]">No routines for this day</h3>
              <p className="mt-1 text-xs text-[#6B7280] max-w-xs">
                Establish morning routines or link habits to your wake-up time.
              </p>
              <button
                type="button"
                onClick={() => {
                  hapticsService.light();
                  setIsAddModalOpen(true);
                }}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] px-5 text-xs font-bold text-white shadow-md transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add First Routine</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AddRoutineModal
        isOpen={isAddModalOpen}
        selectedDay={selectedDay}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddRoutine}
      />
    </div>
  );
};
