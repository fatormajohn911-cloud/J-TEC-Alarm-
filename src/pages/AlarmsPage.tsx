import React, { useState } from 'react';
import { Alarm } from '../types/alarm';
import { AlarmCard } from '../components/alarm/AlarmCard';
import { AlarmFormModal } from '../components/alarm/AlarmFormModal';
import { AlarmClock, Plus, ShieldCheck, Cpu } from 'lucide-react';

interface AlarmsPageProps {
  alarms: Alarm[];
  timeFormat24h?: boolean;
  onToggleAlarm: (id: string) => void;
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => void;
  onUpdateAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (id: string) => void;
  onTestRing: (alarm: Alarm) => void;
}

export const AlarmsPage: React.FC<AlarmsPageProps> = ({
  alarms,
  timeFormat24h = false,
  onToggleAlarm,
  onAddAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onTestRing,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);

  const handleOpenCreate = () => {
    setEditingAlarm(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (alarm: Alarm) => {
    setEditingAlarm(alarm);
    setIsModalOpen(true);
  };

  const handleSaveModal = (data: Omit<Alarm, 'id' | 'createdAt'> | Alarm) => {
    if ('id' in data) {
      onUpdateAlarm(data as Alarm);
    } else {
      onAddAlarm(data);
    }
  };

  const activeCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Header with Alarm Count & Add CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Alarms
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span>{alarms.length} Configured</span>
            <span aria-hidden="true">·</span>
            <span className="text-purple-300 font-medium">{activeCount} Active</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span>New Alarm</span>
        </button>
      </div>

      {/* 2. Architecture Notice Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-start gap-3">
          <Cpu className="mt-0.5 h-4 w-4 text-purple-400 shrink-0" />
          <div className="text-xs text-zinc-400 leading-relaxed">
            <span className="font-semibold text-zinc-200">Native Android AlarmManager Architecture:</span>
            <p className="mt-0.5">
              Alarms are orchestrated through the <code className="text-purple-300">AlarmPluginInterface</code>. In Phase 1, UI states and web audio emulation are live. When compiled as an APK, calls route directly to Android's exact wake-lock AlarmManager.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Alarm List */}
      <div className="space-y-3.5">
        {alarms.length > 0 ? (
          alarms.map((alarm) => (
            <AlarmCard
              key={alarm.id}
              alarm={alarm}
              timeFormat24h={timeFormat24h}
              onToggle={onToggleAlarm}
              onEdit={handleOpenEdit}
              onDelete={onDeleteAlarm}
              onTestRing={onTestRing}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 p-12 text-center">
            <AlarmClock className="h-12 w-12 text-zinc-600 mb-3" />
            <h3 className="text-base font-semibold text-zinc-300">No alarms created yet</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-xs">
              Set up your first waking schedule with gentle chimes and optional AI morning briefing.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 text-xs font-semibold text-white shadow-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Alarm</span>
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Modal Dialog */}
      <AlarmFormModal
        isOpen={isModalOpen}
        initialAlarm={editingAlarm}
        timeFormat24h={timeFormat24h}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAlarm(null);
        }}
        onSave={handleSaveModal}
      />
    </div>
  );
};
