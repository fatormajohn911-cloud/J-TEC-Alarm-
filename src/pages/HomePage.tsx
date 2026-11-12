import React from 'react';
import { Alarm, NextAlarmInfo } from '../types/alarm';
import { ScheduleRoutine } from '../types/schedule';
import { AppSettings } from '../types/settings';
import { DigitalClock } from '../components/common/DigitalClock';
import { ToggleSwitch } from '../components/common/ToggleSwitch';
import { TabType } from '../navigation/navigationTypes';
import {
  AlarmClock,
  Sparkles,
  Calendar,
  Plus,
  ArrowRight,
  CheckCircle2,
  Circle,
  BellRing,
  Coffee,
  Zap,
} from 'lucide-react';

interface HomePageProps {
  nextAlarmInfo: NextAlarmInfo;
  activeAlarmsCount: number;
  todayRoutines: ScheduleRoutine[];
  settings: AppSettings;
  onToggleAlarm: (id: string) => void;
  onOpenCreateAlarm: () => void;
  onQuickCreateNap: (minutes: number) => void;
  onNavigate: (tab: TabType) => void;
  onTestRing: (alarm: Alarm) => void;
  onToggleRoutine: (id: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  nextAlarmInfo,
  activeAlarmsCount,
  todayRoutines,
  settings,
  onToggleAlarm,
  onOpenCreateAlarm,
  onQuickCreateNap,
  onNavigate,
  onTestRing,
  onToggleRoutine,
}) => {
  return (
    <div className="space-y-6 pb-20">
      {/* 1. Large Live Digital Clock */}
      <section aria-label="Current Live Clock">
        <DigitalClock
          timeFormat24h={settings.timeFormat24h}
          showSeconds={settings.showSeconds}
          size="large"
        />
      </section>

      {/* 2. Next Alarm Overview Card */}
      <section aria-label="Next Scheduled Alarm">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <AlarmClock className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Next Alarm
              </span>
            </div>

            {nextAlarmInfo.alarm && (
              <span className="text-xs font-semibold text-purple-300 font-mono-numbers">
                {nextAlarmInfo.countdownText}
              </span>
            )}
          </div>

          {nextAlarmInfo.alarm ? (
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2 font-mono-numbers">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50">
                    {nextAlarmInfo.timeFormatted}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-300 truncate">
                  {nextAlarmInfo.alarm.label || 'Scheduled Alarm'}
                </p>

                {/* Clean unboxed metadata with separators */}
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                  <span>Snooze {nextAlarmInfo.alarm.snoozeIntervalMinutes}m</span>
                  <span aria-hidden="true">·</span>
                  <span>{nextAlarmInfo.alarm.aiBriefing ? 'AI Briefing On' : 'Standard Chime'}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2.5">
                <ToggleSwitch
                  checked={nextAlarmInfo.alarm.enabled}
                  onChange={() => onToggleAlarm(nextAlarmInfo.alarm!.id)}
                  label="Toggle next alarm"
                />

                <button
                  type="button"
                  onClick={() => onTestRing(nextAlarmInfo.alarm!)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/50 px-2.5 py-1 text-xs font-medium text-purple-300 transition-colors"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span>Test Ring</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center py-4 text-center">
              <p className="text-sm font-medium text-zinc-400">No active alarms scheduled</p>
              <button
                type="button"
                onClick={onOpenCreateAlarm}
                className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 text-xs font-semibold text-white shadow-md transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create an Alarm</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3. Quick Action Nap & Presets */}
      <section aria-label="Quick Presets">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onQuickCreateNap(20)}
            className="flex min-h-[64px] flex-col items-start justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Zap className="h-3.5 w-3.5 text-purple-400" />
              <span>+20m Nap</span>
            </div>
            <span className="mt-0.5 text-[11px] text-zinc-400">Power recharge</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickCreateNap(45)}
            className="flex min-h-[64px] flex-col items-start justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Coffee className="h-3.5 w-3.5 text-purple-400" />
              <span>+45m Rest</span>
            </div>
            <span className="mt-0.5 text-[11px] text-zinc-400">Deep cycle</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateAlarm}
            className="flex min-h-[64px] flex-col items-start justify-center rounded-2xl border border-purple-900/60 bg-purple-950/20 p-3 hover:border-purple-800 hover:bg-purple-950/30 transition-all text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-200">
              <Plus className="h-3.5 w-3.5 text-purple-400" />
              <span>New Alarm</span>
            </div>
            <span className="mt-0.5 text-[11px] text-zinc-400">Custom time</span>
          </button>
        </div>
      </section>

      {/* 4. AI Assistant Entry Point */}
      <section aria-label="AI Assistant Entry">
        <div
          onClick={() => onNavigate('assistant')}
          className="group cursor-pointer relative overflow-hidden rounded-3xl border border-purple-900/50 bg-gradient-to-r from-purple-950/30 via-zinc-900 to-zinc-900 p-5 shadow-lg transition-all hover:border-purple-700/70"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 group-hover:text-purple-200 transition-colors">
                  AI Wake Assistant
                </h3>
                <p className="text-xs text-zinc-400">
                  "Wake me at 6:45 AM if it rains tomorrow"
                </p>
              </div>
            </div>

            <span className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </section>

      {/* 5. Today's Schedule Preview */}
      <section aria-label="Today Schedule Preview">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Today's Routines
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <span>View full</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {todayRoutines.length > 0 ? (
              todayRoutines.slice(0, 3).map((routine) => (
                <div
                  key={routine.id}
                  onClick={() => onToggleRoutine(routine.id)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Mark ${routine.title} as ${routine.completed ? 'incomplete' : 'complete'}`}
                      className="text-zinc-500 hover:text-purple-400"
                    >
                      {routine.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-zinc-600" />
                      )}
                    </button>
                    <div>
                      <span
                        className={`text-xs font-medium ${
                          routine.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                        }`}
                      >
                        {routine.title}
                      </span>
                      <div className="text-[11px] text-zinc-400">
                        {routine.durationMinutes} mins
                      </div>
                    </div>
                  </div>

                  <span className="font-mono-numbers text-xs font-semibold text-zinc-400">
                    {routine.time}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-3 text-center text-xs text-zinc-400">
                No routines scheduled for today
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 6. Active Alarms & Activity Overview Stats */}
      <section aria-label="Activity Overview">
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => onNavigate('alarms')}
            className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700"
          >
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Active Alarms
            </span>
            <div className="mt-1 font-mono-numbers text-2xl font-bold text-zinc-100">
              {activeAlarmsCount}
            </div>
            <span className="text-[11px] text-purple-400">Managed in Alarms →</span>
          </div>

          <div
            onClick={() => onNavigate('settings')}
            className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700"
          >
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Reliability Engine
            </span>
            <div className="mt-1 text-sm font-semibold text-emerald-400">
              Ready (Phase 1)
            </div>
            <span className="text-[11px] text-zinc-400">Native bridge active →</span>
          </div>
        </div>
      </section>
    </div>
  );
};
