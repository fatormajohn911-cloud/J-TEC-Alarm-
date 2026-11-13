import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types/settings';
import { ToggleSwitch } from '../components/common/ToggleSwitch';
import { NativeAlarm } from '../services/nativeAlarmPlugin';
import { PageHeader } from '../components/layout/PageHeader';
import { hapticsService } from '../services/hapticsService';
import { WebPreviewBanner } from '../components/common/WebPreviewBanner';
import {
  getTextKeyStatus,
  saveUserTextApiKey,
  clearUserTextApiKey,
  testTextApiKey,
  checkServerTextAvailable,
} from '../services/geminiText';
import {
  playTestTone,
  stopVoicePlayback,
  getVoiceCacheStats,
  clearVoiceCache,
  formatBytes,
  getVoiceKeyStatus,
  saveUserVoiceApiKey,
  clearUserVoiceApiKey,
  testVoiceApiKey,
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
  Download,
  Share,
  KeyRound,
  Activity,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { AiIcon } from '../components/common/AiIcon';
import { AppLogo } from '../components/common/AppLogo';
import {
  buildCopyableAiErrorReport,
  copyTextToClipboard,
  ParsedAiError,
} from '../utils/aiErrorDetails';

interface PWAStateProps {
  canPromptInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<boolean>;
}

interface SettingsPageProps {
  settings: AppSettings;
  pwa?: PWAStateProps;
  scrollTarget?: string | null;
  onClearScrollTarget?: () => void;
  onBack: () => void;
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onRefreshPermissions: () => Promise<void>;
  onResetAll: () => void;
}

function formatBuildDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  pwa,
  scrollTarget,
  onClearScrollTarget,
  onBack,
  onUpdateSetting,
  onRefreshPermissions,
  onResetAll,
}) => {
  const isNative = NativeAlarm.isNative();
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  const buildTimeRaw = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
  const buildDateFormatted = buildTimeRaw ? formatBuildDate(buildTimeRaw) : 'dev';
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

  const [testingVoice, setTestingVoice] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceCacheStats, setVoiceCacheStats] = useState<{
    totalBytes: number;
    clipCount: number;
  }>({ totalBytes: 0, clipCount: 0 });
  const [activeModal, setActiveModal] = useState<'privacy' | 'rate' | 'feedback' | null>(null);

  // Key status & Developer / API Keys form states (never reveal raw saved keys)
  const [textKeyStatus, setTextKeyStatus] = useState(() => getTextKeyStatus());
  const [voiceKeyStatus, setVoiceKeyStatus] = useState(() => getVoiceKeyStatus());
  const [serverProxyReady, setServerProxyReady] = useState<boolean | null>(null);

  const [textKeyInput, setTextKeyInput] = useState('');
  const [voiceKeyInput, setVoiceKeyInput] = useState('');
  const [textTestState, setTextTestState] = useState<{
    loading: boolean;
    ok?: boolean;
    message?: string;
  }>({ loading: false });
  const [voiceTestState, setVoiceTestState] = useState<{
    loading: boolean;
    ok?: boolean;
    message?: string;
  }>({ loading: false });
  const [networkCheckState, setNetworkCheckState] = useState<{
    loading: boolean;
    ok?: boolean;
    message?: string;
    details?: ParsedAiError;
  }>({ loading: false });
  const [copiedDiagError, setCopiedDiagError] = useState(false);

  const pageOrigin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'unknown';

  const devSectionRef = useRef<HTMLElement | null>(null);

  const refreshKeyStatuses = () => {
    setTextKeyStatus(getTextKeyStatus());
    setVoiceKeyStatus(getVoiceKeyStatus());
  };

  const refreshCacheStats = async () => {
    const stats = await getVoiceCacheStats();
    setVoiceCacheStats(stats);
  };

  useEffect(() => {
    refreshCacheStats();
    refreshKeyStatuses();
    if (!isNative) {
      checkServerTextAvailable().then(setServerProxyReady);
    }
    return () => {
      stopVoicePlayback();
    };
  }, [isNative]);

  const handleRunNetworkCheck = async () => {
    hapticsService.light();
    setNetworkCheckState({ loading: true });
    setCopiedDiagError(false);
    const res = await testTextApiKey();
    if (res.ok) {
      setNetworkCheckState({
        loading: false,
        ok: true,
        message: res.message || 'OK',
      });
    } else {
      const details: ParsedAiError = {
        category: 'unknown',
        plainReason: res.plainReason || res.message,
        httpStatus: res.httpStatus ?? null,
        apiMessage: res.apiMessage || res.message,
      };
      setNetworkCheckState({
        loading: false,
        ok: false,
        message: res.plainReason || res.message,
        details,
      });
    }
  };

  useEffect(() => {
    if (scrollTarget === 'developer-api-keys' && devSectionRef.current) {
      const timer = window.setTimeout(() => {
        devSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onClearScrollTarget?.();
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [scrollTarget, onClearScrollTarget]);

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

  const handleSaveTextKey = () => {
    hapticsService.light();
    saveUserTextApiKey(textKeyInput);
    setTextKeyInput('');
    refreshKeyStatuses();
    setTextTestState({
      loading: false,
      ok: true,
      message: 'Text API key saved in local browser storage.',
    });
  };

  const handleClearTextKey = () => {
    hapticsService.light();
    clearUserTextApiKey();
    setTextKeyInput('');
    refreshKeyStatuses();
    setTextTestState({ loading: false, message: undefined });
  };

  const handleTestTextKey = async () => {
    hapticsService.light();
    setTextTestState({ loading: true });
    const res = await testTextApiKey(textKeyInput || undefined);
    setTextTestState({ loading: false, ok: res.ok, message: res.message });
  };

  const handleSaveVoiceKey = () => {
    hapticsService.light();
    saveUserVoiceApiKey(voiceKeyInput);
    setVoiceKeyInput('');
    refreshKeyStatuses();
    setVoiceTestState({
      loading: false,
      ok: true,
      message: 'Voice API key saved in local browser storage.',
    });
  };

  const handleClearVoiceKey = () => {
    hapticsService.light();
    clearUserVoiceApiKey();
    setVoiceKeyInput('');
    refreshKeyStatuses();
    setVoiceTestState({ loading: false, message: undefined });
  };

  const handleTestVoiceKey = async () => {
    hapticsService.light();
    setVoiceTestState({ loading: true });
    const res = await testVoiceApiKey(voiceKeyInput || undefined);
    setVoiceTestState({ loading: false, ok: res.ok, message: res.message });
  };

  const webNotificationsSupported =
    typeof window !== 'undefined' && typeof Notification !== 'undefined';
  const webNotificationPermission = webNotificationsSupported
    ? Notification.permission
    : 'unsupported';

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

          {/* Web-only Preview Banner */}
          <WebPreviewBanner />

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

          {/* 2. AI VOICE SECTION */}
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
                        onUpdateSetting('aiVoiceStyle', style.id as AppSettings['aiVoiceStyle']);
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

          {/* 4. ALARM RELIABILITY SECTION */}
          <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12A6A0]/10 text-[#12A6A0]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-[#1E1B4B]">Alarm Reliability</h3>
            </div>

            <p className="mt-3 text-xs text-[#6B7280] leading-relaxed break-words">
              {isNative ? (
                <>
                  AI Wake registers alarms with{' '}
                  <code className="text-[#9C1C7C] font-semibold break-all">
                    AlarmManager.setAlarmClock()
                  </code>
                  . Each permission below is critical for guaranteed waking:
                </>
              ) : (
                'Native Android permissions are shown below for reference. On the web, browser Notification permission can be enabled for open-tab alerts.'
              )}
            </p>

            <div className="mt-4 space-y-2.5">
              {/* Perm 1: Exact Alarms */}
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      !isNative
                        ? 'bg-gray-300'
                        : settings.exactAlarmPermission
                        ? 'bg-emerald-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#1E1B4B]">Exact Alarms</span>
                    <p className="text-[10px] text-[#6B7280] truncate">SCHEDULE_EXACT_ALARM</p>
                  </div>
                </div>

                {!isNative ? (
                  <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                    Not applicable on web
                  </span>
                ) : settings.exactAlarmPermission ? (
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
                      !isNative
                        ? 'bg-gray-300'
                        : settings.batteryOptimizationExempt
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#1E1B4B]">Battery Exemption</span>
                    <p className="text-[10px] text-[#6B7280] truncate">Prevents OEM killing</p>
                  </div>
                </div>

                {!isNative ? (
                  <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                    Not applicable on web
                  </span>
                ) : settings.batteryOptimizationExempt ? (
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
                      isNative
                        ? settings.notificationPermission
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                        : webNotificationPermission === 'granted'
                        ? 'bg-emerald-500'
                        : webNotificationPermission === 'unsupported'
                        ? 'bg-gray-300'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#1E1B4B]">Notifications</span>
                    <p className="text-[10px] text-[#6B7280] truncate">
                      {isNative ? 'Upcoming alerts & snooze controls' : 'Browser alarm alerts'}
                    </p>
                  </div>
                </div>
                {isNative ? (
                  settings.notificationPermission ? (
                    <span className="shrink-0 text-xs font-bold text-emerald-600">Active</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestNotification}
                      className="shrink-0 rounded-xl bg-[#3B3D78] text-white px-3 py-1 text-xs font-bold"
                    >
                      Fix
                    </button>
                  )
                ) : webNotificationPermission === 'unsupported' ? (
                  <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                    Not applicable on web
                  </span>
                ) : webNotificationPermission === 'granted' ? (
                  <span className="shrink-0 text-xs font-bold text-emerald-600">Active</span>
                ) : webNotificationPermission === 'denied' ? (
                  <span className="shrink-0 text-[11px] font-semibold text-red-600">
                    Blocked
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestNotification}
                    className="shrink-0 rounded-xl bg-[#3B3D78] text-white px-3 py-1 text-xs font-bold"
                  >
                    Allow
                  </button>
                )}
              </div>

              {/* Perm 4: Full Screen Lock Intent */}
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F5] p-3.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      !isNative
                        ? 'bg-gray-300'
                        : settings.fullScreenIntentPermission
                        ? 'bg-emerald-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#1E1B4B]">Full-Screen Alert</span>
                    <p className="text-[10px] text-[#6B7280] truncate">Displays over lock screen</p>
                  </div>
                </div>
                {!isNative ? (
                  <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                    Not applicable on web
                  </span>
                ) : settings.fullScreenIntentPermission ? (
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

          {/* 5. ABOUT SECTION (Logo, Install App, Version/Build, Legal, Reset) */}
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
              <span className="shrink-0 text-[11px] font-mono font-bold text-[#6B7280]">
                v{appVersion}
              </span>
            </div>

            {/* Install App CTA when beforeinstallprompt fired, or iOS Safari guide */}
            {pwa?.canPromptInstall && (
              <button
                type="button"
                onClick={async () => {
                  hapticsService.medium();
                  await pwa.promptInstall();
                }}
                className="mt-3 w-full min-h-[44px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Install app</span>
              </button>
            )}

            {!pwa?.canPromptInstall && pwa?.isIOS && (
              <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 flex items-start gap-2.5">
                <Share className="h-4 w-4 shrink-0 text-[#3B3D78] mt-0.5" />
                <p className="text-xs text-[#1E1B4B] leading-relaxed">
                  Install on iPhone: tap <span className="font-bold">Share</span> then{' '}
                  <span className="font-bold">Add to Home Screen</span>.
                </p>
              </div>
            )}

            <div className="mt-2 divide-y divide-gray-100">
              <div className="flex items-center justify-between py-3">
                <span className="text-xs font-bold text-[#1E1B4B]">Build</span>
                <span className="text-xs font-mono font-bold text-[#6B7280]">
                  #{buildId} · {buildDateFormatted}
                </span>
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

          {/* 6. DIAGNOSTICS SECTION */}
          <section className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3B3D78]/10 text-[#3B3D78]">
                <Activity className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-[#1E1B4B]">Diagnostics</h3>
            </div>

            <div className="mt-3 divide-y divide-gray-100 text-xs">
              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B]">Text API key</span>
                <span
                  className={`font-semibold ${
                    textKeyStatus.isSet || serverProxyReady
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {textKeyStatus.isSet
                    ? `Set (source: ${textKeyStatus.source})`
                    : serverProxyReady
                    ? 'Set (server)'
                    : 'Missing'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B]">Voice API key</span>
                <span
                  className={`font-semibold ${
                    voiceKeyStatus.isSet || serverProxyReady
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {voiceKeyStatus.isSet
                    ? `Set (source: ${voiceKeyStatus.source})`
                    : serverProxyReady
                    ? 'Set (server)'
                    : 'Missing'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B]">Platform</span>
                <span className="font-mono font-semibold text-[#6B7280]">
                  {isNative ? 'Android' : 'Web'}
                </span>
              </div>

              <div className="flex items-start justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B] shrink-0">Page origin</span>
                <span className="font-mono text-[11px] font-semibold text-[#6B7280] text-right break-all">
                  {pageOrigin}
                </span>
              </div>

              <div className="py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-[#1E1B4B]">Network check</span>
                    <p className="text-[11px] text-[#6B7280]">
                      Sends one tiny request to the text API
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunNetworkCheck}
                    disabled={networkCheckState.loading}
                    className="shrink-0 min-h-[34px] rounded-xl bg-[#F3F3F5] hover:bg-gray-200 px-3 text-[11px] font-bold text-[#3B3D78] transition-colors flex items-center gap-1.5"
                  >
                    {networkCheckState.loading && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    <span>{networkCheckState.loading ? 'Checking…' : 'Check'}</span>
                  </button>
                </div>

                {networkCheckState.ok !== undefined && (
                  <div
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold space-y-1 ${
                      networkCheckState.ok
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {networkCheckState.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      )}
                      <span className="break-words">
                        {networkCheckState.ok ? 'OK' : networkCheckState.message}
                      </span>
                    </div>
                    {networkCheckState.ok && networkCheckState.message && (
                      <p className="pl-5 text-[10px] font-normal text-emerald-700 break-words">
                        {networkCheckState.message}
                      </p>
                    )}
                    {!networkCheckState.ok && networkCheckState.details && (
                      <div className="pl-5 space-y-1.5">
                        <p className="text-[10px] font-mono text-red-600/90 break-words">
                          {networkCheckState.details.httpStatus
                            ? `HTTP ${networkCheckState.details.httpStatus}: `
                            : ''}
                          {networkCheckState.details.apiMessage}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!networkCheckState.details) return;
                            const ok = await copyTextToClipboard(
                              buildCopyableAiErrorReport(
                                'network_check',
                                networkCheckState.details
                              )
                            );
                            if (ok) {
                              setCopiedDiagError(true);
                              window.setTimeout(() => setCopiedDiagError(false), 2000);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-red-700 border border-red-200 hover:bg-red-100/40"
                        >
                          {copiedDiagError ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy error details</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B]">Build number</span>
                <span className="font-mono font-semibold text-[#6B7280]">{buildId}</span>
              </div>

              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B]">Build date</span>
                <span className="font-mono font-semibold text-[#6B7280] text-right">
                  {buildDateFormatted}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="font-bold text-[#1E1B4B]">App version</span>
                <span className="font-mono font-semibold text-[#6B7280]">v{appVersion}</span>
              </div>
            </div>
          </section>

          {/* 7. DEVELOPER / API KEYS SECTION (Testing in browser/APK; never shows stored key value) */}
          <section
            id="developer-api-keys"
            ref={devSectionRef}
            className="rounded-[28px] bg-white border border-gray-100 p-5 shadow-[0_4px_20px_rgba(30,27,75,0.04)]"
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9C1C7C]/10 text-[#9C1C7C]">
                <KeyRound className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-[#1E1B4B]">Developer / API Keys</h3>
            </div>

            <p className="mt-3 text-[11px] text-[#6B7280] leading-relaxed">
              Optional testing keys stored locally on this device. Build-time environment keys are used automatically when present. Saved key values are never shown.
            </p>

            <div className="mt-4 space-y-5">
              {/* Text API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="dev-text-api-key" className="text-xs font-bold text-[#1E1B4B]">
                    Text API key
                  </label>
                  <span className="text-[11px] font-semibold text-[#6B7280]">
                    {textKeyStatus.isSet
                      ? `Active (${textKeyStatus.source})`
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="dev-text-api-key"
                    type="password"
                    autoComplete="off"
                    value={textKeyInput}
                    onChange={(e) => setTextKeyInput(e.target.value)}
                    placeholder={
                      textKeyStatus.source === 'saved'
                        ? 'Saved on device — enter new key to replace'
                        : 'Paste Gemini Text API key'
                    }
                    className="flex-1 min-w-0 rounded-2xl bg-[#F3F3F5] px-3.5 py-2.5 text-xs text-[#1E1B4B] placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#3B3D78]/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestTextKey}
                    disabled={textTestState.loading}
                    className="shrink-0 min-h-[40px] rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 px-3.5 text-xs font-bold text-[#3B3D78] transition-colors flex items-center gap-1.5"
                  >
                    {textTestState.loading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Test</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTextKey}
                    disabled={!textKeyInput.trim()}
                    className="rounded-xl bg-[#3B3D78] hover:bg-[#2E2F6B] disabled:opacity-45 px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
                  >
                    Save key
                  </button>
                  {textKeyStatus.source === 'saved' && (
                    <button
                      type="button"
                      onClick={handleClearTextKey}
                      className="rounded-xl bg-red-50 hover:bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-600 transition-colors"
                    >
                      Clear saved
                    </button>
                  )}
                </div>

                {textTestState.message && (
                  <div
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold flex items-start gap-2 ${
                      textTestState.ok
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {textTestState.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <span className="break-words">{textTestState.message}</span>
                  </div>
                )}
              </div>

              {/* Voice API Key */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label htmlFor="dev-voice-api-key" className="text-xs font-bold text-[#1E1B4B]">
                    Voice API key
                  </label>
                  <span className="text-[11px] font-semibold text-[#6B7280]">
                    {voiceKeyStatus.isSet
                      ? `Active (${voiceKeyStatus.source})`
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="dev-voice-api-key"
                    type="password"
                    autoComplete="off"
                    value={voiceKeyInput}
                    onChange={(e) => setVoiceKeyInput(e.target.value)}
                    placeholder={
                      voiceKeyStatus.source === 'saved'
                        ? 'Saved on device — enter new key to replace'
                        : 'Paste Gemini Voice API key'
                    }
                    className="flex-1 min-w-0 rounded-2xl bg-[#F3F3F5] px-3.5 py-2.5 text-xs text-[#1E1B4B] placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#3B3D78]/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestVoiceKey}
                    disabled={voiceTestState.loading}
                    className="shrink-0 min-h-[40px] rounded-2xl bg-[#F3F3F5] hover:bg-gray-200 px-3.5 text-xs font-bold text-[#3B3D78] transition-colors flex items-center gap-1.5"
                  >
                    {voiceTestState.loading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Test</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveVoiceKey}
                    disabled={!voiceKeyInput.trim()}
                    className="rounded-xl bg-[#3B3D78] hover:bg-[#2E2F6B] disabled:opacity-45 px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
                  >
                    Save key
                  </button>
                  {voiceKeyStatus.source === 'saved' && (
                    <button
                      type="button"
                      onClick={handleClearVoiceKey}
                      className="rounded-xl bg-red-50 hover:bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-600 transition-colors"
                    >
                      Clear saved
                    </button>
                  )}
                </div>

                {voiceTestState.message && (
                  <div
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold flex items-start gap-2 ${
                      voiceTestState.ok
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {voiceTestState.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <span className="break-words">{voiceTestState.message}</span>
                  </div>
                )}
              </div>
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
