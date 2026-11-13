import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alarm, NextAlarmInfo } from '../types/alarm';
import { AppSettings } from '../types/settings';
import { PageType } from '../navigation/navigationTypes';
import { ToggleSwitch } from '../components/common/ToggleSwitch';
import { HomeHeader } from '../components/layout/HomeHeader';
import { HomeStorySheets, StorySheetType } from '../components/home/HomeStorySheets';
import { hapticsService } from '../services/hapticsService';
import { AiIcon } from '../components/common/AiIcon';
import {
  AlarmClock,
  Plus,
  Zap,
  Coffee,
  Mic,
  Trash2,
  Clock,
  Music2,
  Sun,
  Timer,
  ChevronRight,
  BellRing,
} from 'lucide-react';

interface HomePageProps {
  nextAlarmInfo: NextAlarmInfo;
  activeAlarms: Alarm[];
  settings: AppSettings;
  aiEnabled?: boolean;
  onToggleAlarm: (id: string) => void;
  onOpenCreateAlarm: () => void;
  onOpenEditAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (id: string) => void;
  onRestoreAlarm: (alarm: Alarm) => void;
  onQuickCreateNap: (minutes: number) => void;
  onNavigate: (page: PageType) => void;
  onTestRing: (alarm: Alarm) => void;
  onOpenNotifications: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  nextAlarmInfo,
  activeAlarms,
  settings,
  aiEnabled = true,
  onToggleAlarm,
  onOpenCreateAlarm,
  onOpenEditAlarm,
  onDeleteAlarm,
  onRestoreAlarm,
  onQuickCreateNap,
  onNavigate,
  onTestRing,
  onOpenNotifications,
}) => {
  const [activeStorySheet, setActiveStorySheet] = useState<StorySheetType>(null);
  const [deletedAlarmSnackbar, setDeletedAlarmSnackbar] = useState<Alarm | null>(null);

  const handleDeleteWithUndo = (alarm: Alarm, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticsService.medium();
    onDeleteAlarm(alarm.id);
    setDeletedAlarmSnackbar(alarm);
    setTimeout(() => {
      setDeletedAlarmSnackbar((current) => (current?.id === alarm.id ? null : current));
    }, 4500);
  };

  const handleUndo = () => {
    if (deletedAlarmSnackbar) {
      hapticsService.success();
      onRestoreAlarm(deletedAlarmSnackbar);
      setDeletedAlarmSnackbar(null);
    }
  };

  return (
    <>
      <main className="main-scroll-area w-full bg-white text-[#1E1B4B]">
        {/* 1. Header: deep indigo/purple gradient with dynamic user name */}
        <HomeHeader
          userName={settings.userName || 'Alex'}
          onOpenNotifications={onOpenNotifications}
          unreadCount={2}
        />

        {/* Main Content Wrapper */}
        <div className="relative -mt-10 mx-auto w-full max-w-xl px-4 sm:px-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          {/* 2. Top Circles: Sounds, Nap, Briefing, Routine (Each opens a bottom sheet) */}
          <div className="grid grid-cols-4 gap-2 pb-5 w-full">
            {/* Sounds */}
            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                setActiveStorySheet('sounds');
              }}
              className="group touch-pan-y flex min-w-0 flex-col items-center gap-1.5 focus-visible:outline-none"
            >
              <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#12A6A0] via-[#9C1C7C] to-[#F57C1F] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
                <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-[#12A6A0]/15 flex items-center justify-center text-[#12A6A0]">
                    <Music2 className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#1E1B4B] truncate max-w-full">Sounds</span>
            </button>

            {/* Nap */}
            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                setActiveStorySheet('nap');
              }}
              className="group touch-pan-y flex min-w-0 flex-col items-center gap-1.5 focus-visible:outline-none"
            >
              <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#F57C1F] via-[#9C1C7C] to-[#12A6A0] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
                <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-[#F57C1F]/15 flex items-center justify-center text-[#F57C1F]">
                    <Coffee className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#1E1B4B] truncate max-w-full">Nap</span>
            </button>

            {/* Briefing */}
            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                setActiveStorySheet('briefing');
              }}
              className="group touch-pan-y flex min-w-0 flex-col items-center gap-1.5 focus-visible:outline-none"
            >
              <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#9C1C7C] via-[#F5B800] to-[#12A6A0] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
                <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-[#9C1C7C]/15 flex items-center justify-center text-[#9C1C7C]">
                    <AiIcon className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#1E1B4B] truncate max-w-full">Briefing</span>
            </button>

            {/* Routine */}
            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                setActiveStorySheet('routine');
              }}
              className="group touch-pan-y flex min-w-0 flex-col items-center gap-1.5 focus-visible:outline-none"
            >
              <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#F5B800] via-[#9C1C7C] to-[#F57C1F] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
                <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-[#F5B800]/20 flex items-center justify-center text-[#F5B800]">
                    <Sun className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#1E1B4B] truncate max-w-full">Routine</span>
            </button>
          </div>

          {/* 3. Hero Card: Next Alarm with countdown OR inviting empty state */}
          <div className="relative overflow-clip rounded-[28px] bg-gradient-to-br from-[#2A2B5C] via-[#35366D] to-[#4A4F7A] text-white p-5 sm:p-6 shadow-[0_12px_28px_rgba(42,43,92,0.24)] transition-all touch-pan-y">
            <div
              className="pointer-events-none absolute top-0 right-0 h-40 w-40 -translate-y-1/3 translate-x-1/3 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />

            {nextAlarmInfo.alarm ? (
              <div>
                {/* Top row */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-purple-200">
                    Next Alarm
                  </span>
                  <ToggleSwitch
                    checked={nextAlarmInfo.alarm.enabled}
                    onChange={() => {
                      hapticsService.light();
                      onToggleAlarm(nextAlarmInfo.alarm!.id);
                    }}
                    label="Toggle next alarm"
                  />
                </div>

                {/* Center Time */}
                <div className="mt-3">
                  <span className="font-mono-numbers text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">
                    {nextAlarmInfo.timeFormatted}
                  </span>
                </div>

                {/* Bottom Row */}
                <div className="mt-4 flex items-end justify-between gap-3 pt-3 border-t border-white/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {nextAlarmInfo.alarm.label || 'Weekday Awakening'}
                    </p>
                    <p className="text-[11px] text-purple-200/90 font-medium truncate">
                      Snooze {nextAlarmInfo.alarm.snoozeIntervalMinutes}m · {nextAlarmInfo.alarm.aiBriefing ? 'AI Briefing' : 'Chime'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="inline-block rounded-full bg-[#9C1C7C] text-white px-3.5 py-1 text-xs font-bold shadow-sm font-mono-numbers whitespace-nowrap">
                      {nextAlarmInfo.countdownText}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Inviting Empty State when no alarm exists */
              <div className="py-2 flex flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 mb-2.5">
                  <AlarmClock className="h-6 w-6 text-purple-200" />
                </div>
                <h3 className="text-lg font-bold text-white">No active alarms</h3>
                <p className="text-xs text-purple-200/80 max-w-xs mt-1">
                  Wake up refreshed with custom chimes and spoken morning intelligence.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    hapticsService.medium();
                    onOpenCreateAlarm();
                  }}
                  className="mt-4 touch-pan-y inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#9C1C7C] hover:bg-[#86176a] px-5 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Set your first alarm</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Quick Presets Row: +20m Nap, +45m Rest, Custom timer */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                onQuickCreateNap(20);
              }}
              className="touch-pan-y flex min-h-[58px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 active:scale-95 transition-all text-center px-1.5 py-2.5 sm:p-2.5 shadow-xs"
            >
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#1E1B4B] max-w-full">
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-[#F57C1F]" />
                <span className="truncate">+20m Nap</span>
              </div>
              <span className="text-[10px] text-[#6B7280] truncate max-w-full">Power recharge</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                onQuickCreateNap(45);
              }}
              className="touch-pan-y flex min-h-[58px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 active:scale-95 transition-all text-center px-1.5 py-2.5 sm:p-2.5 shadow-xs"
            >
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#1E1B4B] max-w-full">
                <Coffee className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-[#F5B800]" />
                <span className="truncate">+45m Rest</span>
              </div>
              <span className="text-[10px] text-[#6B7280] truncate max-w-full">Deep cycle</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                setActiveStorySheet('nap');
              }}
              className="touch-pan-y flex min-h-[58px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 active:scale-95 transition-all text-center px-1.5 py-2.5 sm:p-2.5 shadow-xs"
            >
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#1E1B4B] max-w-full">
                <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-[#12A6A0]" />
                <span className="truncate">Custom</span>
              </div>
              <span className="text-[10px] text-[#6B7280] truncate max-w-full">Set duration</span>
            </button>
          </div>

          {/* 5. Slim AI Banner Card */}
          {aiEnabled && (
            <div
              onClick={() => {
                hapticsService.light();
                onNavigate('assistant');
              }}
              className="mt-4 touch-pan-y flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#9C1C7C]/10 via-[#3B3D78]/10 to-[#12A6A0]/10 border border-[#9C1C7C]/20 p-3.5 hover:border-[#9C1C7C]/40 transition-all active:scale-98 shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3B3D78] text-white">
                  <Mic className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#1E1B4B] truncate">Ask AI to set an alarm</h4>
                  <p className="text-[11px] text-[#6B7280] truncate">"Wake me at 6:45 AM if it rains tomorrow"</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#9C1C7C]" />
            </div>
          )}

          {/* 6. "My Alarms" Section: Tap to edit, Swipe to delete, Clean list */}
          <div className="mt-6 rounded-t-[32px] bg-white pt-2">
            <div className="flex items-center justify-between gap-2 py-3 border-b border-gray-100">
              <button
                type="button"
                onClick={() => onNavigate('alarms')}
                className="touch-pan-y flex items-center gap-1.5 group text-left min-w-0"
              >
                <h2 className="text-lg font-bold text-[#1E1B4B] group-hover:text-[#9C1C7C] transition-colors truncate">
                  My Alarms
                </h2>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#9C1C7C] group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('alarms')}
                className="touch-pan-y shrink-0 text-xs font-bold text-[#9C1C7C] hover:underline whitespace-nowrap"
              >
                Manage all ({activeAlarms.length})
              </button>
            </div>

            {/* Alarm Rows */}
            <div className="mt-2 divide-y divide-gray-100">
              {activeAlarms.map((alarm, idx) => {
                const iconColors = [
                  'bg-[#12A6A0]/15 text-[#12A6A0]',
                  'bg-[#9C1C7C]/15 text-[#9C1C7C]',
                  'bg-[#F57C1F]/15 text-[#F57C1F]',
                  'bg-[#F5B800]/20 text-[#F5B800]',
                ];
                const colorClass = iconColors[idx % iconColors.length];

                const [h, m] = alarm.time.split(':').map(Number);
                const period = h >= 12 ? 'PM' : 'AM';
                const displayH = h % 12 || 12;
                const formattedTime = `${displayH}:${m.toString().padStart(2, '0')} ${period}`;

                const daysLabel =
                  alarm.days.length === 5 && !alarm.days.includes(0) && !alarm.days.includes(6)
                    ? 'Mon - Fri'
                    : alarm.days.length === 7
                    ? 'Every day'
                    : alarm.days.length === 2 && alarm.days.includes(0) && alarm.days.includes(6)
                    ? 'Weekends'
                    : alarm.days.length === 0
                    ? 'Once'
                    : `${alarm.days.length} days/wk`;

                return (
                  <div
                    key={alarm.id}
                    onClick={() => onOpenEditAlarm(alarm)}
                    className="group touch-pan-y flex cursor-pointer items-center justify-between gap-2 py-3.5 px-1.5 sm:px-2 rounded-2xl transition-colors hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                      >
                        <AlarmClock className="h-5 w-5 stroke-[2]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-[#1E1B4B] truncate group-hover:text-[#9C1C7C] transition-colors">
                          {alarm.label}
                        </h3>
                        <p className="text-[11px] text-[#6B7280] font-medium truncate">
                          {daysLabel} · Snooze {alarm.snoozeIntervalMinutes}m
                        </p>
                      </div>
                    </div>

                    {/* Right side: Time, Toggle, and Delete */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                      <span className="font-mono-numbers text-sm sm:text-lg font-bold text-[#9C1C7C] whitespace-nowrap">
                        {formattedTime}
                      </span>

                      <div onClick={(e) => e.stopPropagation()} className="touch-pan-y">
                        <ToggleSwitch
                          checked={alarm.enabled}
                          onChange={() => {
                            hapticsService.light();
                            onToggleAlarm(alarm.id);
                          }}
                          label={`Toggle ${alarm.label}`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteWithUndo(alarm, e)}
                        aria-label="Delete alarm"
                        className="touch-pan-y flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Undo Delete Snackbar */}
      <AnimatePresence>
        {deletedAlarmSnackbar && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-[#1E1B4B] text-white p-4 shadow-2xl flex items-center justify-between border border-white/10"
          >
            <span className="text-xs font-semibold truncate pr-2">
              Deleted "{deletedAlarmSnackbar.label}"
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="shrink-0 text-xs font-extrabold text-[#F5B800] hover:underline px-2 py-1"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Action Bottom Sheets */}
      <HomeStorySheets
        sheetType={activeStorySheet}
        onClose={() => setActiveStorySheet(null)}
        onStartNap={onQuickCreateNap}
        onNavigateToSchedule={() => onNavigate('schedule')}
      />
    </>
  );
};
