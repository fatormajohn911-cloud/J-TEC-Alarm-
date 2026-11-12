import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppSettings } from '../../types/settings';
import { hapticsService } from '../../services/hapticsService';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Volume2,
  Bell,
  Maximize2,
  BatteryCharging,
  Clock,
} from 'lucide-react';
import { AiIcon } from '../common/AiIcon';
import { AppLogo } from '../common/AppLogo';

export type ReliabilityPermissionType =
  | 'exact'
  | 'notifications'
  | 'fullscreen'
  | 'battery';

interface OnboardingModalProps {
  isOpen: boolean;
  initialName?: string;
  settings: AppSettings;
  onRequestPermission: (type: ReliabilityPermissionType) => Promise<void>;
  onComplete: (userName: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialName = '',
  settings,
  onRequestPermission,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName === 'Alex' ? '' : initialName);

  if (!isOpen) return null;

  const handlePermissionPress = async (type: ReliabilityPermissionType) => {
    hapticsService.light();
    await onRequestPermission(type);
  };

  const handleNext = () => {
    hapticsService.medium();
    if (step < 2) {
      setStep(step + 1);
    } else {
      hapticsService.success();
      onComplete(name.trim() || 'Friend');
    }
  };

  const handleBack = () => {
    hapticsService.light();
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-white text-[#1E1B4B] p-6 sm:p-10 pt-safe pb-safe overflow-y-auto">
      {/* Top Bar: Step count & Skip */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F3F5] text-[#1E1B4B] hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === idx ? 'w-7 bg-[#9C1C7C]' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            hapticsService.light();
            onComplete(name.trim() || 'Friend');
          }}
          className="text-xs font-bold text-[#6B7280] hover:text-[#1E1B4B]"
        >
          Skip
        </button>
      </div>

      {/* Main Slide Content */}
      <div className="my-auto max-w-md mx-auto w-full py-6">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-center"
            >
              {/* Brand App Logo */}
              <div className="mx-auto flex items-center justify-center">
                <AppLogo className="h-24 w-24 rounded-[28px] shadow-xl shadow-indigo-900/20" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E1B4B]">
                  Welcome to AI Wake
                </h1>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">
                  An intelligent alarm clock and personal wake assistant engineered for rock-solid Android reliability and mindful morning routines.
                </p>
              </div>

              {/* Ask for Name */}
              <div className="rounded-[24px] bg-[#F3F3F5] p-5 text-left border border-gray-100">
                <label htmlFor="user-name-input" className="text-xs font-bold text-[#1E1B4B] block mb-1">
                  What should we call you?
                </label>
                <input
                  id="user-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-base font-bold text-[#1E1B4B] placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9C1C7C]"
                />
                <p className="mt-2 text-[11px] text-[#6B7280]">
                  Your wake-up greetings and morning briefings will be personalized with this name.
                </p>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#9C1C7C] to-[#F57C1F] text-white shadow-xl shadow-pink-900/20">
                <AiIcon className="h-12 w-12 stroke-[2]" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E1B4B]">
                  Spoken AI Morning Briefings
                </h1>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">
                  Wake up to more than a loud buzzer. AI Wake prepares your personalized morning briefing before your alarm and plays it offline at wake-up.
                </p>
              </div>

              <div className="space-y-2.5 text-left">
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F3F3F5]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12A6A0]/15 text-[#12A6A0]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E1B4B]">Daily Agenda & Calendar</h4>
                    <p className="text-[11px] text-[#6B7280]">Know your high-priority commitments right as you wake.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F3F3F5]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5B800]/20 text-[#F5B800]">
                    <AiIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E1B4B]">Weather & Inspiration</h4>
                    <p className="text-[11px] text-[#6B7280]">Start the day informed and encouraged.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F3F3F5]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9C1C7C]/15 text-[#9C1C7C]">
                    <Volume2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E1B4B]">Custom Voice Personas</h4>
                    <p className="text-[11px] text-[#6B7280]">Choose between Warm & Serene, Morning Coach, or Executive.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-[#3B3D78] to-[#12A6A0] text-white shadow-lg mb-3">
                  <ShieldCheck className="h-10 w-10 stroke-[2]" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1E1B4B]">
                  Uncompromising Reliability
                </h1>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Grant these four Android permissions so your alarms always ring on time:
                </p>
              </div>

              {/* 4 Live Permissions list */}
              <div className="space-y-2.5">
                {/* Perm 1: Exact Alarms */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5] border border-gray-100">
                  <div className="flex items-start gap-2.5 pr-2">
                    <Clock className="h-4 w-4 text-[#3B3D78] mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1E1B4B]">Exact Alarms</h4>
                      <p className="text-[11px] text-[#6B7280] leading-tight">
                        Rings right to the exact second even in deep Doze mode.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePermissionPress('exact')}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold transition-colors ${
                      settings.exactAlarmPermission
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#3B3D78] text-white'
                    }`}
                  >
                    {settings.exactAlarmPermission ? 'Allowed' : 'Allow'}
                  </button>
                </div>

                {/* Perm 2: Notifications */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5] border border-gray-100">
                  <div className="flex items-start gap-2.5 pr-2">
                    <Bell className="h-4 w-4 text-[#9C1C7C] mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1E1B4B]">Notifications</h4>
                      <p className="text-[11px] text-[#6B7280] leading-tight">
                        Shows upcoming alarm alerts and snooze/dismiss controls.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePermissionPress('notifications')}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold transition-colors ${
                      settings.notificationPermission
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#3B3D78] text-white'
                    }`}
                  >
                    {settings.notificationPermission ? 'Allowed' : 'Allow'}
                  </button>
                </div>

                {/* Perm 3: Full-Screen Alerts */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5] border border-gray-100">
                  <div className="flex items-start gap-2.5 pr-2">
                    <Maximize2 className="h-4 w-4 text-[#12A6A0] mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1E1B4B]">Full-Screen Alerts</h4>
                      <p className="text-[11px] text-[#6B7280] leading-tight">
                        Rings on top of your lock screen so you never miss it.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePermissionPress('fullscreen')}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold transition-colors ${
                      settings.fullScreenIntentPermission
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#3B3D78] text-white'
                    }`}
                  >
                    {settings.fullScreenIntentPermission ? 'Allowed' : 'Allow'}
                  </button>
                </div>

                {/* Perm 4: Battery Exemption */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5] border border-gray-100">
                  <div className="flex items-start gap-2.5 pr-2">
                    <BatteryCharging className="h-4 w-4 text-[#F57C1F] mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1E1B4B]">Battery Exemption</h4>
                      <p className="text-[11px] text-[#6B7280] leading-tight">
                        Prevents manufacturer background task killers from stopping alarms.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePermissionPress('battery')}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold transition-colors ${
                      settings.batteryOptimizationExempt
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#3B3D78] text-white'
                    }`}
                  >
                    {settings.batteryOptimizationExempt ? 'Allowed' : 'Allow'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA Button */}
      <div className="w-full max-w-md mx-auto pt-4">
        <button
          type="button"
          onClick={handleNext}
          className="w-full min-h-[54px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 transition-all active:scale-98"
        >
          <span>{step === 2 ? 'Get Started' : 'Continue'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
