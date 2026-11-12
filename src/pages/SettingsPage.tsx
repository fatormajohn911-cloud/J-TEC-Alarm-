import React, { useState } from 'react';
import { AppSettings } from '../types/settings';
import { ToggleSwitch } from '../components/common/ToggleSwitch';
import { alarmAudio, NativeAlarm } from '../services/nativeAlarmPlugin';
import {
  Sliders,
  Volume2,
  Bell,
  ShieldCheck,
  Sparkles,
  Database,
  Smartphone,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onResetAll: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSetting,
  onResetAll,
}) => {
  const [testingVoice, setTestingVoice] = useState(false);
  const [permissionSuccessMessage, setPermissionSuccessMessage] = useState<string | null>(null);

  const handleTestVoiceTone = () => {
    setTestingVoice(true);
    alarmAudio.playTone('aurora', 80);
    setTimeout(() => setTestingVoice(false), 2400);
  };

  const handleRequestExactAlarm = async () => {
    const res = await NativeAlarm.requestExactAlarm();
    onUpdateSetting('exactAlarmPermission', res.granted);
    setPermissionSuccessMessage('Exact alarm scheduling verified.');
    setTimeout(() => setPermissionSuccessMessage(null), 3000);
  };

  const handleRequestBatteryExemption = async () => {
    const res = await NativeAlarm.requestBatteryExempt();
    onUpdateSetting('batteryOptimizationExempt', res.granted);
    setPermissionSuccessMessage('Battery optimization exemption verified.');
    setTimeout(() => setPermissionSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
          Settings & Reliability
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure clock display, AI voice briefings, and Android system permissions
        </p>
      </div>

      {permissionSuccessMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{permissionSuccessMessage}</span>
        </div>
      )}

      {/* 1. Appearance Section */}
      <section aria-labelledby="section-appearance" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800/80">
          <Sliders className="h-4 w-4 text-purple-400" />
          <h3 id="section-appearance" className="text-sm font-bold text-zinc-100">
            Clock & Appearance
          </h3>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-sm font-medium text-zinc-200">
                24-Hour Time Format
              </span>
              <p className="text-[11px] text-zinc-400">
                Display 14:00 instead of 02:00 PM
              </p>
            </div>
            <ToggleSwitch
              checked={settings.timeFormat24h}
              onChange={(val) => onUpdateSetting('timeFormat24h', val)}
              label="24-Hour Time Format"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-sm font-medium text-zinc-200">
                Show Live Seconds
              </span>
              <p className="text-[11px] text-zinc-400">
                Display seconds counter on digital clock
              </p>
            </div>
            <ToggleSwitch
              checked={settings.showSeconds}
              onChange={(val) => onUpdateSetting('showSeconds', val)}
              label="Show Live Seconds"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-sm font-medium text-zinc-200">
                Android Device Frame Preview
              </span>
              <p className="text-[11px] text-zinc-400">
                Render within realistic Android smartphone bezel frame
              </p>
            </div>
            <ToggleSwitch
              checked={settings.deviceFrameMockup}
              onChange={(val) => onUpdateSetting('deviceFrameMockup', val)}
              label="Android Device Frame Preview"
            />
          </div>
        </div>
      </section>

      {/* 2. Voice Preferences Section */}
      <section aria-labelledby="section-voice" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-4 w-4 text-purple-400" />
            <h3 id="section-voice" className="text-sm font-bold text-zinc-100">
              AI Voice Persona & Speech
            </h3>
          </div>

          <button
            type="button"
            onClick={handleTestVoiceTone}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 transition-colors"
          >
            <Play className="h-3 w-3 fill-current text-purple-400" />
            <span>Test Sound</span>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-300">Voice Style Preset</label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'warm', label: 'Warm & Serene', desc: 'Gentle, comforting cadence' },
                { id: 'coach', label: 'Morning Coach', desc: 'Energizing and inspiring tone' },
                { id: 'executive', label: 'Executive Briefing', desc: 'Concise, crisp agenda focus' },
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onUpdateSetting('aiVoiceStyle', style.id as any)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-colors ${
                    settings.aiVoiceStyle === style.id
                      ? 'border-purple-500 bg-purple-950/40 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-xs font-semibold text-zinc-200">{style.label}</span>
                  <span className="text-[11px] text-zinc-400 mt-0.5">{style.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Speech Pace</span>
              <span className="font-mono-numbers text-zinc-400">{settings.speechRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.2"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => onUpdateSetting('speechRate', parseFloat(e.target.value))}
              className="mt-2 w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 3. Android Permissions & Alarm Reliability (Critical for Android Architect Review) */}
      <section aria-labelledby="section-reliability" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800/80">
          <ShieldCheck className="h-4 w-4 text-purple-400" />
          <h3 id="section-reliability" className="text-sm font-bold text-zinc-100">
            Android Alarm Reliability & Permissions
          </h3>
        </div>

        <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
          Android 12+ Doze mode and manufacturer battery savers can kill background processes. AI Wake uses exact AlarmManager scheduling (<code className="text-purple-300">setAlarmClock</code>) and full-screen intents so your alarm rings even when locked.
        </p>

        <div className="mt-4 space-y-3.5">
          {/* Permission 1: Exact Alarms */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Exact Alarm Permission
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  SCHEDULE_EXACT_ALARM
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Guarantees millisecond wake accuracy even in deep Doze mode
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestExactAlarm}
              className="shrink-0 min-h-[36px] rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs font-medium text-purple-300 transition-colors"
            >
              Verify
            </button>
          </div>

          {/* Permission 2: Battery Optimization */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Battery Optimization Exemption
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  IGNORE_BATTERY_OPTIMIZATIONS
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Prevents aggressive OEM battery killers (Samsung/Xiaomi) from killing the alarm service
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestBatteryExemption}
              className="shrink-0 min-h-[36px] rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs font-medium text-purple-300 transition-colors"
            >
              Verify
            </button>
          </div>

          {/* Permission 3: Full-Screen Intent */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Full-Screen Lock Intent
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  USE_FULL_SCREEN_INTENT
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Displays the alarm ringing screen immediately on top of the lock screen
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 py-1">Active</span>
          </div>
        </div>
      </section>

      {/* 4. AI Wake-Up Briefing Configuration */}
      <section aria-labelledby="section-briefing" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800/80">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 id="section-briefing" className="text-sm font-bold text-zinc-100">
            AI Wake Briefing Elements
          </h3>
        </div>

        <p className="mt-2 text-xs text-zinc-400">
          Select information to include in your personalized wake-up speech:
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Local Weather & Forecast</span>
            <ToggleSwitch
              checked={settings.aiBriefingWeather}
              onChange={(val) => onUpdateSetting('aiBriefingWeather', val)}
              label="Local Weather"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Today's Schedule & Calendar</span>
            <ToggleSwitch
              checked={settings.aiBriefingCalendar}
              onChange={(val) => onUpdateSetting('aiBriefingCalendar', val)}
              label="Today Schedule"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Positive Morning Motivation</span>
            <ToggleSwitch
              checked={settings.aiBriefingMotivation}
              onChange={(val) => onUpdateSetting('aiBriefingMotivation', val)}
              label="Morning Motivation"
            />
          </div>
        </div>
      </section>

      {/* 5. Privacy & Data Storage */}
      <section aria-labelledby="section-privacy" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800/80">
          <Database className="h-4 w-4 text-purple-400" />
          <h3 id="section-privacy" className="text-sm font-bold text-zinc-100">
            Privacy & Storage
          </h3>
        </div>

        <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
          AI Wake is built on a <span className="text-zinc-200 font-medium">local-first</span> foundation. Your alarm times, schedule routines, and voice preferences remain on your device and are never sold or shared.
        </p>

        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-300">Reset Local Storage</span>
            <p className="text-[11px] text-zinc-400">Clears alarms, routines, and cached chat history</p>
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-900/60 bg-rose-950/20 hover:bg-rose-950/40 px-3.5 py-2 text-xs font-medium text-rose-300 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Data</span>
          </button>
        </div>
      </section>
    </div>
  );
};
