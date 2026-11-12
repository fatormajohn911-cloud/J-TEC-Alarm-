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
    <div className="min-h-screen bg-white text-[#1E1B4B] flex flex-col w-full max-w-full overflow-x-hidden">
      {/* 1. Header: deep indigo/purple gradient with dynamic user name */}
      <HomeHeader
        userName={settings.userName || 'Alex'}
        onOpenNotifications={onOpenNotifications}
        unreadCount={2}
      />

      {/* Main Container */}
      <div className="relative -mt-10 mx-auto w-full max-w-xl px-4 sm:px-5 flex-1 flex flex-col overflow-x-hidden">
        {/* 2. Top Circles: Sounds, Nap, Briefing, Routine (Each opens a bottom sheet) */}
        <div className="flex items-center justify-between pb-5 px-1 w-full max-w-full overflow-x-hidden">
          {/* Sounds */}
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              setActiveStorySheet('sounds');
            }}
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#12A6A0] via-[#9C1C7C] to-[#F57C1F] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
              <div className="h-14 w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-[#12A6A0]/15 flex items-center justify-center text-[#12A6A0]">
                  <Music2 className="h-6 w-6 stroke-[2]" />
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#1E1B4B]">Sounds</span>
          </button>

          {/* Nap */}
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              setActiveStorySheet('nap');
            }}
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#F57C1F] via-[#9C1C7C] to-[#12A6A0] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
              <div className="h-14 w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-[#F57C1F]/15 flex items-center justify-center text-[#F57C1F]">
                  <Coffee className="h-6 w-6 stroke-[2]" />
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#1E1B4B]">Nap</span>
          </button>

          {/* Briefing */}
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              setActiveStorySheet('briefing');
            }}
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#9C1C7C] via-[#F5B800] to-[#12A6A0] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
              <div className="h-14 w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-[#9C1C7C]/15 flex items-center justify-center text-[#9C1C7C]">
                  <AiIcon className="h-6 w-6 stroke-[2]" />
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#1E1B4B]">Briefing</span>
          </button>

          {/* Routine */}
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              setActiveStorySheet('routine');
            }}
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#F5B800] via-[#9C1C7C] to-[#F57C1F] transition-transform group-hover:scale-105 active:scale-95 shadow-sm">
              <div className="h-14 w-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-[#F5B800]/20 flex items-center justify-center text-[#F5B800]">
                  <Sun className="h-6 w-6 stroke-[2]" />
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#1E1B4B]">Routine</span>
          </button>
        </div>

        {/* 3. Hero Card: Next Alarm with countdown OR inviting empty state */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2A2B5C] via-[#35366D] to-[#4A4F7A] text-white p-6 shadow-[0_16px_36px_rgba(42,43,92,0.28)] transition-all">
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />

          {nextAlarmInfo.alarm ? (
            <div>
              {/* Top row */}
              <div className="flex items-center justify-between">
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
              <div className="mt-4 flex items-end justify-between pt-3 border-t border-white/10">
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-[170px] sm:max-w-xs">
                    {nextAlarmInfo.alarm.label || 'Weekday Awakening'}
                  </p>
                  <p className="text-[11px] text-purple-200/90 font-medium">
                    Snooze {nextAlarmInfo.alarm.snoozeIntervalMinutes}m · {nextAlarmInfo.alarm.aiBriefing ? 'AI Briefing' : 'Chime'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block rounded-full bg-[#9C1C7C] text-white px-3.5 py-1 text-xs font-bold shadow-sm font-mono-numbers">
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
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#9C1C7C] hover:bg-[#86176a] px-5 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Set your first alarm</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Quick Presets Row: +20m Nap, +45m Rest, Custom timer (Zero duplication!) */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              onQuickCreateNap(20);
            }}
            className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 active:scale-95 transition-all text-center p-2.5 shadow-xs"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1B4B]">
              <Zap className="h-4 w-4 text-[#F57C1F]" />
              <span>+20m Nap</span>
            </div>
            <span className="text-[10px] text-[#6B7280]">Power recharge</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              onQuickCreateNap(45);
            }}
            className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 active:scale-95 transition-all text-center p-2.5 shadow-xs"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1B4B]">
              <Coffee className="h-4 w-4 text-[#F5B800]" />
              <span>+45m Rest</span>
            </div>
            <span className="text-[10px] text-[#6B7280]">Deep cycle</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticsService.light();
              setActiveStorySheet('nap');
            }}
            className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 active:scale-95 transition-all text-center p-2.5 shadow-xs"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1B4B]">
              <Timer className="h-4 w-4 text-[#12A6A0]" />
              <span>Custom</span>
            </div>
            <span className="text-[10px] text-[#6B7280]">Set duration</span>
          </button>
        </div>

        {/* 5. Slim AI Banner Card */}
        <div
          onClick={() => {
            hapticsService.light();
            onNavigate('assistant');
          }}
          className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl bg-gradient-to-r from-[#9C1C7C]/10 via-[#3B3D78]/10 to-[#12A6A0]/10 border border-[#9C1C7C]/20 p-3.5 hover:border-[#9C1C7C]/40 transition-all active:scale-98 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3B3D78] text-white">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#1E1B4B]">Ask AI to set an alarm</h4>
              <p className="text-[11px] text-[#6B7280]">"Wake me at 6:45 AM if it rains tomorrow"</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[#9C1C7C]" />
        </div>

        {/* 6. "My Alarms" Section: Tap to edit, Swipe to delete, Clean list */}
        <div className="mt-6 rounded-t-[32px] bg-white pt-2 pb-28">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <button
              type="button"
              onClick={() => onNavigate('alarms')}
              className="flex items-center gap-1.5 group text-left"
            >
              <h2 className="text-lg font-bold text-[#1E1B4B] group-hover:text-[#9C1C7C] transition-colors">
                My Alarms
              </h2>
              <ChevronRight className="h-5 w-5 text-[#9C1C7C] group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('alarms')}
              className="text-xs font-bold text-[#9C1C7C] hover:underline"
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
                  className="group flex cursor-pointer items-center justify-between py-3.5 px-2 rounded-2xl transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                    >
                      <AlarmClock className="h-5 w-5 stroke-[2]" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#1E1B4B] truncate max-w-[140px] sm:max-w-xs group-hover:text-[#9C1C7C] transition-colors">
                        {alarm.label}
                      </h3>
                      <p className="text-[11px] text-[#6B7280] font-medium">
                        {daysLabel} · Snooze {alarm.snoozeIntervalMinutes}m
                      </p>
                    </div>
                  </div>

                  {/* Right side: Time, Toggle, and Delete */}
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-numbers text-base sm:text-lg font-bold text-[#9C1C7C]">
                      {formattedTime}
                    </span>

                    <div onClick={(e) => e.stopPropagation()}>
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
                      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

      {/* Undo Delete Snackbar */}
      <AnimatePresence>
        {deletedAlarmSnackbar && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-[#1E1B4B] text-white p-4 shadow-2xl flex items-center justify-between border border-white/10"
          >
            <span className="text-xs font-semibold">
              Deleted "{deletedAlarmSnackbar.label}"
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="text-xs font-extrabold text-[#F5B800] hover:underline px-2 py-1"
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
    </div>
  );
};
