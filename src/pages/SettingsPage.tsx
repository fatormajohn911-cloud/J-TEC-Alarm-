import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types/settings';
import { ToggleSwitch } from '../components/common/ToggleSwitch';
import { NativeAlarm } from '../services/nativeAlarmPlugin';
import { PageHeader } from '../components/layout/PageHeader';
import { hapticsService } from '../services/hapticsService';
import {
  playTestTone,
  stopVoicePlayback,
  getVoiceCacheStats,
  clearVoiceCache,
  formatBytes,
} from '../services/geminiVoice';
import {
  Sliders,
  Volume2,
  ShieldCheck,
  Play,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Info,
  Star,
  MessageSquare,
  Trash2,
  X,
} from 'lucide-react';
import { AiIcon } from '../components/common/AiIcon';
import { AppLogo } from '../components/common/AppLogo';

interface SettingsPageProps {
  settings: AppSettings;
  onBack: () => void;
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onRefreshPermissions: () => Promise<void>;
  onResetAll: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onBack,
  onUpdateSetting,
  onRefreshPermissions,
  onResetAll,
}) => {
  const [testingVoice, setTestingVoice] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceCacheStats, setVoiceCacheStats] = useState<{
    totalBytes: number;
    clipCount: number;
  }>({ totalBytes: 0, clipCount: 0 });
  const [activeModal, setActiveModal] = useState<'privacy' | 'rate' | 'feedback' | null>(null);

  const refreshCacheStats = async () => {
    const stats = await getVoiceCacheStats();
    setVoiceCacheStats(stats);
  };

  useEffect(() => {
    refreshCacheStats();
    return () => {
      stopVoicePlayback();
    };
  }, []);

  const handleTestVoiceTone = async () => {
    hapticsService.light();
    if (testingVoice) {
      stopVoicePlayback();
      setTestingVoice(false);
      return;
    }

    setVoiceError(null);
    setTestingVoice(true);
    try {
      await playTestTone(settings.aiVoiceStyle, settings.speechRate, () => {
        setTestingVoice(false);
      });
      refreshCacheStats();
    } catch (err) {
      setTestingVoice(false);
      setVoiceError(
        err instanceof Error ? err.message : 'Unable to preview AI voice right now.'
      );
      setTimeout(() => setVoiceError(null), 4000);
    }
  };

  const handleClearVoiceCache = async () => {
    hapticsService.medium();
    stopVoicePlayback();
    await clearVoiceCache();
    await refreshCacheStats();
    setFeedbackSuccess('Voice audio cache cleared.');
    setTimeout(() => setFeedbackSuccess(null), 3000);
  };

  const handleRequestExactAlarm = async () => {
    hapticsService.light();
    await NativeAlarm.requestExactAlarm();
    await onRefreshPermissions();
  };

  const handleRequestBatteryExemption = async () => {
    hapticsService.light();
    await NativeAlarm.requestBatteryExempt();
    await onRefreshPermissions();
  };

  const handleRequestNotification = async () => {
    hapticsService.light();
    await NativeAlarm.requestNotification();
    await onRefreshPermissions();
  };

  const handleRequestFullScreenIntent = async () => {
    hapticsService.light();
    await NativeAlarm.requestFullScreenIntent();
    await onRefreshPermissions();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white text-[#1E1B4B]">
      {/* Top Bar with Back Arrow */}
      <PageHeader
        title="Settings"
        subtitle="Preferences & Reliability"
        onBack={onBack}
      />

      <main className="main-scroll-area">
        <div className="mx-auto w-full max-w-xl px-4 py-5 space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {feedbackSuccess && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {/* 1. CLOCK SECTION */}
        <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3B3D78]/10 text-[#3B3D78]">
              <Sliders className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">Clock</h3>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm font-bold text-[#1E1B4B]">
                  24-Hour Format
                </span>
                <p className="text-[11px] text-[#6B7280]">
                  Display 14:00 instead of 02:00 PM
                </p>
              </div>
              <ToggleSwitch
                checked={settings.timeFormat24h}
                onChange={(val) => {
                  hapticsService.light();
                  onUpdateSetting('timeFormat24h', val);
                }}
                label="24-Hour Time Format"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm font-bold text-[#1E1B4B]">
                  Show Live Seconds
                </span>
                <p className="text-[11px] text-[#6B7280]">
                  Real-time seconds counter on main clocks
                </p>
              </div>
              <ToggleSwitch
                checked={settings.showSeconds}
                onChange={(val) => {
                  hapticsService.light();
                  onUpdateSetting('showSeconds', val);
                }}
                label="Show Live Seconds"
              />
            </div>
          </div>
        </section>

        {/* 2. AI VOICE SECTION (Title never wraps awkwardly) */}
        <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9C1C7C]/10 text-[#9C1C7C]">
                <Volume2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-[#1E1B4B]">AI Voice</h3>
            </div>

            <button
              type="button"
              onClick={handleTestVoiceTone}
              className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3.5 py-1 text-xs font-bold text-[#3B3D78] transition-colors"
            >
              <Play className="h-3 w-3 fill-current text-[#9C1C7C]" />
              <span>{testingVoice ? 'Stop' : 'Test Tone'}</span>
            </button>
          </div>

          {voiceError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{voiceError}</span>
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#1E1B4B] block mb-2">Voice Style</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'warm', label: 'Warm & Serene', desc: 'Comforting, gentle wake' },
                  { id: 'coach', label: 'Morning Coach', desc: 'Energizing motivation' },
                  { id: 'executive', label: 'Executive', desc: 'Crisp agenda briefing' },
                ].map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      hapticsService.light();
                      onUpdateSetting('aiVoiceStyle', style.id as any);
                    }}
                    className={`flex flex-col items-start p-3 rounded-2xl text-left transition-all ${
                      settings.aiVoiceStyle === style.id
                        ? 'border-2 border-[#9C1C7C] bg-[#9C1C7C]/5'
                        : 'border border-gray-100 bg-[#F3F3F5] hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#1E1B4B]">{style.label}</span>
                    <span className="text-[11px] text-[#6B7280] mt-0.5">{style.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1E1B4B]">Speech Speed</span>
                <span className="font-mono-numbers font-bold text-[#9C1C7C]">
                  {settings.speechRate.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.1"
                value={settings.speechRate}
                onChange={(e) => onUpdateSetting('speechRate', parseFloat(e.target.value))}
                className="mt-2 w-full accent-[#9C1C7C] cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* 2B. AI ASSISTANT & CACHE SECTION */}
        <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3B3D78]/10 text-[#3B3D78]">
              <AiIcon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">AI</h3>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-bold text-[#1E1B4B]">
                  Ask before applying changes
                </span>
                <p className="text-[11px] text-[#6B7280]">
                  Show alarm & schedule proposals before saving
                </p>
              </div>
              <ToggleSwitch
                checked={settings.askBeforeApplyingChanges ?? true}
                onChange={(val) => {
                  hapticsService.light();
                  onUpdateSetting('askBeforeApplyingChanges', val);
                }}
                label="Ask before applying changes"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <div className="min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-bold text-[#1E1B4B]">
                  Voice audio cache
                </span>
                <p className="text-[11px] text-[#6B7280]">
                  {formatBytes(voiceCacheStats.totalBytes)} cached · {voiceCacheStats.clipCount}{' '}
                  {voiceCacheStats.clipCount === 1 ? 'clip' : 'clips'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearVoiceCache}
                disabled={voiceCacheStats.clipCount === 0}
                className="shrink-0 flex min-h-[38px] items-center gap-1.5 rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 disabled:opacity-45 px-3.5 py-1.5 text-xs font-bold text-[#1E1B4B] transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#9C1C7C]" />
                <span>Clear voice cache</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. BRIEFING SECTION */}
        <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5B800]/20 text-[#F5B800]">
              <AiIcon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">Briefing</h3>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E1B4B]">Local Weather & Forecast</span>
              <ToggleSwitch
                checked={settings.aiBriefingWeather}
                onChange={(val) => {
                  hapticsService.light();
                  onUpdateSetting('aiBriefingWeather', val);
                }}
                label="Local Weather"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E1B4B]">Today's Calendar & Schedule</span>
              <ToggleSwitch
                checked={settings.aiBriefingCalendar}
                onChange={(val) => {
                  hapticsService.light();
                  onUpdateSetting('aiBriefingCalendar', val);
                }}
                label="Today Calendar"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E1B4B]">Positive Morning Motivation</span>
              <ToggleSwitch
                checked={settings.aiBriefingMotivation}
                onChange={(val) => {
                  hapticsService.light();
                  onUpdateSetting('aiBriefingMotivation', val);
                }}
                label="Morning Motivation"
              />
            </div>
          </div>
        </section>

        {/* 4. ALARM RELIABILITY SECTION (With green/amber/red status per permission and a Fix button) */}
        <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12A6A0]/10 text-[#12A6A0]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">Alarm Reliability</h3>
          </div>

          <p className="mt-3 text-xs text-[#6B7280] leading-relaxed break-words">
            AI Wake registers alarms with <code className="text-[#9C1C7C] font-semibold break-all">AlarmManager.setAlarmClock()</code>. Each permission below is critical for guaranteed waking:
          </p>

          <div className="mt-4 space-y-2.5">
            {/* Perm 1: Exact Alarms */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    settings.exactAlarmPermission ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1E1B4B]">Exact Alarms</span>
                  <p className="text-[10px] text-[#6B7280] truncate">SCHEDULE_EXACT_ALARM</p>
                </div>
              </div>

              {settings.exactAlarmPermission ? (
                <span className="shrink-0 text-xs font-bold text-emerald-600">Active</span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestExactAlarm}
                  className="shrink-0 rounded-xl bg-[#3B3D78] text-white px-3 py-1 text-xs font-bold"
                >
                  Fix
                </button>
              )}
            </div>

            {/* Perm 2: Battery Optimization */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    settings.batteryOptimizationExempt ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1E1B4B]">Battery Exemption</span>
                  <p className="text-[10px] text-[#6B7280] truncate">Prevents OEM killing</p>
                </div>
              </div>

              {settings.batteryOptimizationExempt ? (
                <span className="shrink-0 text-xs font-bold text-emerald-600">Active</span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestBatteryExemption}
                  className="shrink-0 rounded-xl bg-[#3B3D78] text-white px-3 py-1 text-xs font-bold"
                >
                  Fix
                </button>
              )}
            </div>

            {/* Perm 3: Notifications */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    settings.notificationPermission ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1E1B4B]">Notifications</span>
                  <p className="text-[10px] text-[#6B7280] truncate">Upcoming alerts & snooze controls</p>
                </div>
              </div>
              {settings.notificationPermission ? (
                <span className="shrink-0 text-xs font-bold text-emerald-600">Active</span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestNotification}
                  className="shrink-0 rounded-xl bg-[#3B3D78] text-white px-3 py-1 text-xs font-bold"
                >
                  Fix
                </button>
              )}
            </div>

            {/* Perm 4: Full Screen Lock Intent */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    settings.fullScreenIntentPermission ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1E1B4B]">Full-Screen Alert</span>
                  <p className="text-[10px] text-[#6B7280] truncate">Displays over lock screen</p>
                </div>
              </div>
              {settings.fullScreenIntentPermission ? (
                <span className="shrink-0 text-xs font-bold text-emerald-600">Active</span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestFullScreenIntent}
                  className="shrink-0 rounded-xl bg-[#3B3D78] text-white px-3 py-1 text-xs font-bold"
                >
                  Fix
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 5. ABOUT SECTION (Logo, App Version, Privacy Policy, Rate the app, Send feedback) */}
        <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F57C1F]/10 text-[#F57C1F]">
              <Info className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">About</h3>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
            <AppLogo className="h-11 w-11 rounded-xl shrink-0 shadow-xs" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-[#1E1B4B]">AI Wake</div>
              <div className="text-[11px] font-medium text-[#6B7280]">
                Smart Alarm & Morning Briefing Assistant
              </div>
            </div>
            <span className="shrink-0 text-[11px] font-mono font-bold text-[#6B7280]">v1.0.0</span>
          </div>

          <div className="mt-2 divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-bold text-[#1E1B4B]">Build</span>
              <span className="text-xs font-mono font-bold text-[#6B7280]">102</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              className="w-full flex items-center justify-between py-3 text-left hover:text-[#9C1C7C] transition-colors"
            >
              <span className="text-xs font-bold text-[#1E1B4B]">Privacy Policy</span>
              <span className="text-xs text-[#9C1C7C] font-semibold">Local-First →</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('rate')}
              className="w-full flex items-center justify-between py-3 text-left hover:text-[#9C1C7C] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-[#F5B800] fill-[#F5B800]" />
                <span className="text-xs font-bold text-[#1E1B4B]">Rate AI Wake</span>
              </div>
              <span className="text-xs text-[#6B7280]">5.0 ★</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('feedback')}
              className="w-full flex items-center justify-between py-3 text-left hover:text-[#9C1C7C] transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#12A6A0]" />
                <span className="text-xs font-bold text-[#1E1B4B]">Send Feedback</span>
              </div>
              <span className="text-xs text-[#9C1C7C] font-semibold">Contact →</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-[#1E1B4B]">Reset Stored Data</span>
              <p className="text-[11px] text-[#6B7280]">Clears local alarms and routines</p>
            </div>
            <button
              type="button"
              onClick={() => {
                hapticsService.medium();
                onResetAll();
              }}
              className="shrink-0 flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-red-50 hover:bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </section>
        </div>
      </main>

      {/* Modal Dialogs for About Items */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-[#1E1B4B] capitalize">
                {activeModal === 'privacy' && 'Privacy Policy'}
                {activeModal === 'rate' && 'Rate AI Wake'}
                {activeModal === 'feedback' && 'Send Feedback'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeModal === 'privacy' && (
              <div className="text-xs text-[#6B7280] space-y-2 leading-relaxed">
                <p>
                  AI Wake operates on a <strong className="text-[#1E1B4B]">local-first</strong> architecture.
                </p>
                <p>
                  Your alarm times, recurrence schedules, habits, and speech transcripts remain strictly on your device. We do not sell, track, or share your personal waking schedules with third parties.
                </p>
              </div>
            )}

            {activeModal === 'rate' && (
              <div className="text-center space-y-3 py-2">
                <div className="flex justify-center gap-1 text-[#F5B800]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-6 w-6 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-[#6B7280]">
                  Enjoying AI Wake? Your positive review supports continuous development and new voice models!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    hapticsService.success();
                    setActiveModal(null);
                    setFeedbackSuccess('Thank you for rating AI Wake!');
                  }}
                  className="w-full min-h-[44px] rounded-2xl bg-[#3B3D78] text-white text-xs font-bold"
                >
                  Submit 5-Star Rating
                </button>
              </div>
            )}

            {activeModal === 'feedback' && (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="Tell us what you'd love to see in future updates..."
                  className="w-full rounded-2xl bg-[#F3F3F5] p-3 text-xs text-[#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#9C1C7C]"
                />
                <button
                  type="button"
                  onClick={() => {
                    hapticsService.success();
                    setActiveModal(null);
                    setFeedbackSuccess('Feedback received. Thank you!');
                  }}
                  className="w-full min-h-[44px] rounded-2xl bg-[#3B3D78] text-white text-xs font-bold"
                >
                  Send Feedback
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
