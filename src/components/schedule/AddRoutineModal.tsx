import React, { useState } from 'react';
import { ScheduleRoutine, ScheduleCategory } from '../../types/schedule';
import { X, Calendar, Clock, Plus } from 'lucide-react';

interface AddRoutineModalProps {
  isOpen: boolean;
  selectedDay: number;
  onClose: () => void;
  onAdd: (routine: Omit<ScheduleRoutine, 'id'>) => void;
}

const CATEGORIES: { id: ScheduleCategory; label: string }[] = [
  { id: 'morning_routine', label: 'Morning Routine' },
  { id: 'health', label: 'Health & Wellness' },
  { id: 'work', label: 'Deep Work' },
  { id: 'evening', label: 'Evening Wind-down' },
  { id: 'task', label: 'General Task' },
];

export const AddRoutineModal: React.FC<AddRoutineModalProps> = ({
  isOpen,
  selectedDay,
  onClose,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:30');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [category, setCategory] = useState<ScheduleCategory>('morning_routine');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      time,
      durationMinutes,
      category,
      completed: false,
      dayOfWeek: selectedDay,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-bold text-zinc-100">Add Schedule Routine</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="routine-title" className="text-xs font-medium text-zinc-300">
              Routine / Task Title
            </label>
            <input
              id="routine-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Hydration, 30m Mobility"
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="routine-time" className="text-xs font-medium text-zinc-300">
                Start Time
              </label>
              <input
                id="routine-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="routine-duration" className="text-xs font-medium text-zinc-300">
                Duration (min)
              </label>
              <input
                id="routine-duration"
                type="number"
                min="5"
                max="240"
                step="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
                className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">Category</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-xl border p-2 text-xs font-medium text-left transition-colors ${
                    category === c.id
                      ? 'border-purple-500 bg-purple-950/40 text-purple-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="routine-notes" className="text-xs font-medium text-zinc-300">
              Protocol Notes (Optional)
            </label>
            <textarea
              id="routine-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Drink 500ml water, light stretches"
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 px-5 text-xs font-semibold text-white shadow-md transition-colors"
            >
              Add Routine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
