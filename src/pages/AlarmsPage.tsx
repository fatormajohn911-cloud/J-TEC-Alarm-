import React, { useState } from 'react';
import { Alarm } from '../types/alarm';
import { AlarmCard } from '../components/alarm/AlarmCard';
import { AlarmFormModal } from '../components/alarm/AlarmFormModal';
import { PageHeader } from '../components/layout/PageHeader';
import { AlarmClock, Plus, Cpu } from 'lucide-react';
import { NativeAlarm } from '../services/nativeAlarmPlugin';
import { WebPreviewBanner } from '../components/common/WebPreviewBanner';

interface AlarmsPageProps {
  alarms: Alarm[];
  timeFormat24h?: boolean;
  onBack: () => void;
  onToggleAlarm: (id: string) => void;
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => void;
  onUpdateAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (id: string) => void;
  onTestRing: (alarm: Alarm) => void;
}

export const AlarmsPage: React.FC<AlarmsPageProps> = ({
  alarms,
  timeFormat24h = false,
  onBack,
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
    <div className="flex-1 min-h-0 flex flex-col bg-white text-[#1E1B4B]">
      {/* Top Bar with Back Arrow */}
      <PageHeader
        title="Alarms"
        subtitle={`${activeCount} of ${alarms.length} active`}
        onBack={onBack}
        rightAction={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex h-10 items-center gap-1 rounded-full bg-white text-[#3B3D78] px-3.5 py-1 text-xs font-bold shadow-sm hover:bg-gray-100 transition-colors"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New</span>
          </button>
        }
      />

      <main className="main-scroll-area">
        <div className="mx-auto w-full max-w-xl px-4 py-5 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          {/* Web-only Banner or Native Android Architecture Callout */}
          {NativeAlarm.isNative() ? (
            <div className="rounded-[22px] bg-[#F3F3F5] p-4 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3B3D78]/15 text-[#3B3D78] mt-0.5">
                <Cpu className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-xs text-[#6B7280] leading-relaxed">
                <span className="font-bold text-[#1E1B4B]">Android Exact Alarm Engine:</span>
                <p className="mt-0.5 break-words">
                  Alarms are registered with <code className="text-[#9C1C7C] font-semibold break-all">AlarmManager.setAlarmClock()</code> to trigger exact wakeups even in deep Doze mode.
                </p>
              </div>
            </div>
          ) : (
            <WebPreviewBanner />
          )}

          {/* Alarms List */}
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
              <div className="flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-gray-200 p-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#9C1C7C]/10 text-[#9C1C7C] mb-3">
                  <AlarmClock className="h-8 w-8 stroke-[2]" />
                </div>
                <h3 className="text-base font-bold text-[#1E1B4B]">No alarms yet</h3>
                <p className="mt-1 text-xs text-[#6B7280] max-w-xs">
                  Create your first alarm with custom repeat days and gentle sounds.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] px-5 text-xs font-bold text-white shadow-md transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Alarm</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit/Create Modal */}
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
