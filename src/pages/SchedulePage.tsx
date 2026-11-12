import React, { useState } from 'react';
import { ScheduleRoutine } from '../types/schedule';
import { AddRoutineModal } from '../components/schedule/AddRoutineModal';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Sparkles,
  Sun,
  Briefcase,
  Heart,
  Moon,
  ListTodo,
} from 'lucide-react';

interface SchedulePageProps {
  routines: ScheduleRoutine[];
  selectedDay: number;
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'morning_routine':
        return <Sun className="h-4 w-4 text-amber-400" />;
      case 'health':
        return <Heart className="h-4 w-4 text-rose-400" />;
      case 'work':
        return <Briefcase className="h-4 w-4 text-blue-400" />;
      case 'evening':
        return <Moon className="h-4 w-4 text-indigo-400" />;
      default:
        return <ListTodo className="h-4 w-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header with Add Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Daily Routine Planner
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Synchronize tasks and protocols with your wake-up rhythm
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Routine</span>
        </button>
      </div>

      {/* 2. Horizontal Day Selector */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
        <div className="grid grid-cols-7 gap-1">
          {DAYS_NAV.map((item) => {
            const isSelected = selectedDay === item.dayIndex;
            return (
              <button
                key={item.dayIndex}
                type="button"
                onClick={() => onSelectDay(item.dayIndex)}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md font-bold'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 font-medium'
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider">{item.label}</span>
                <span className="text-sm font-mono-numbers">{item.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Daily Summary Stats (Zero-Pill Compliance) */}
      <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span>{dayRoutines.length} Planned Events</span>
          <span aria-hidden="true">·</span>
          <span>{totalMinutes} Total Minutes</span>
        </div>
        <div>
          <span className="text-purple-300 font-medium font-mono-numbers">
            {completedCount} of {dayRoutines.length} Completed
          </span>
        </div>
      </div>

      {/* 4. Routine Timeline List */}
      <div className="space-y-3">
        {dayRoutines.length > 0 ? (
          dayRoutines.map((routine) => (
            <div
              key={routine.id}
              className={`flex items-start justify-between rounded-2xl border p-4 transition-all ${
                routine.completed
                  ? 'border-zinc-800 bg-zinc-950/40 opacity-70'
                  : 'border-zinc-800/90 bg-zinc-900/80 hover:border-zinc-700 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <button
                  type="button"
                  onClick={() => onToggleRoutine(routine.id)}
                  aria-label={`Toggle completion of ${routine.title}`}
                  className="mt-0.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-500 hover:text-purple-400"
                >
                  {routine.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-zinc-600" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(routine.category)}
                    <h3
                      className={`text-sm font-semibold ${
                        routine.completed ? 'line-through text-zinc-400' : 'text-zinc-100'
                      }`}
                    >
                      {routine.title}
                    </h3>
                  </div>

                  {routine.notes && (
                    <p className="mt-1 text-xs text-zinc-400 max-w-sm sm:max-w-md">
                      {routine.notes}
                    </p>
                  )}

                  {/* Clean unboxed metadata with separators */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    <span className="font-mono-numbers font-medium">{routine.time}</span>
                    <span aria-hidden="true">·</span>
                    <span>{routine.durationMinutes} min</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{routine.category.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDeleteRoutine(routine.id)}
                aria-label="Delete routine"
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 p-10 text-center">
            <Calendar className="h-10 w-10 text-zinc-600 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-300">
              No routines scheduled for this day
            </h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-xs">
              Establish a morning routine or link health habits to your waking schedule.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 text-xs font-semibold text-white shadow-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Routine</span>
            </button>
          </div>
        )}
      </div>

      {/* Routine Dialog Modal */}
      <AddRoutineModal
        isOpen={isAddModalOpen}
        selectedDay={selectedDay}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddRoutine}
      />
    </div>
  );
};
