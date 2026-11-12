import React, { useState } from 'react';
import { ScheduleRoutine, ScheduleCategory } from '../../types/schedule';
import { X, Calendar } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#12A6A0]/15 text-[#12A6A0]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E1B4B]">Add Schedule Routine</h2>
              <p className="text-xs text-[#6B7280]">Link habits with waking schedule</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="routine-title-input" className="text-xs font-bold text-[#1E1B4B]">
              Routine Title
            </label>
            <input
              id="routine-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Hydration & Sunlight"
              className="mt-1.5 w-full rounded-2xl bg-[#F3F3F5] border-none px-4 py-3 text-sm text-[#1E1B4B] placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#9C1C7C] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="routine-start-time" className="text-xs font-bold text-[#1E1B4B]">
                Start Time
              </label>
              <input
                id="routine-start-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 w-full rounded-2xl bg-[#F3F3F5] border-none px-3.5 py-2.5 text-sm text-[#1E1B4B] focus:bg-white focus:ring-2 focus:ring-[#9C1C7C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="routine-duration-mins" className="text-xs font-bold text-[#1E1B4B]">
                Duration (min)
              </label>
              <input
                id="routine-duration-mins"
                type="number"
                min="5"
                max="240"
                step="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
                className="mt-1.5 w-full rounded-2xl bg-[#F3F3F5] border-none px-3.5 py-2.5 text-sm text-[#1E1B4B] focus:bg-white focus:ring-2 focus:ring-[#9C1C7C] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#1E1B4B]">Category</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-2xl p-2.5 text-xs font-semibold text-left transition-colors ${
                    category === c.id
                      ? 'bg-[#3B3D78] text-white shadow-xs'
                      : 'bg-[#F3F3F5] text-[#6B7280] hover:bg-gray-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="routine-notes-area" className="text-xs font-bold text-[#1E1B4B]">
              Notes / Instructions
            </label>
            <textarea
              id="routine-notes-area"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 500ml water with lemon, outdoor walking"
              className="mt-1.5 w-full rounded-2xl bg-[#F3F3F5] border-none px-4 py-2.5 text-xs text-[#1E1B4B] placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#9C1C7C] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-2xl px-4 text-xs font-bold text-[#6B7280] hover:text-[#1E1B4B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] px-6 text-xs font-bold text-white shadow-md transition-all active:scale-95"
            >
              Add Routine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
