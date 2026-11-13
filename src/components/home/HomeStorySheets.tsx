import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AVAILABLE_SOUNDS } from '../../types/alarm';
import { alarmAudio } from '../../services/nativeAlarmPlugin';
import { hapticsService } from '../../services/hapticsService';
import { ToggleSwitch } from '../common/ToggleSwitch';
import {
  X,
  Play,
  Square,
  Volume2,
  Coffee,
  Sun,
  Music2,
  Check,
  Plus,
} from 'lucide-react';
import { AiIcon } from '../common/AiIcon';

export type StorySheetType = 'sounds' | 'nap' | 'briefing' | 'routine' | null;

interface HomeStorySheetsProps {
  sheetType: StorySheetType;
  onClose: () => void;
  onStartNap: (minutes: number) => void;
  onNavigateToSchedule: () => void;
}

export const HomeStorySheets: React.FC<HomeStorySheetsProps> = ({
  sheetType,
  onClose,
  onStartNap,
  onNavigateToSchedule,
}) => {
  const [selectedSound, setSelectedSound] = useState('aurora');
  const [volume, setVolume] = useState(85);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customNapMinutes, setCustomNapMinutes] = useState(25);

  const [briefingWeather, setBriefingWeather] = useState(true);
  const [briefingCalendar, setBriefingCalendar] = useState(true);
  const [briefingMotivation, setBriefingMotivation] = useState(true);
  const [voicePersona, setVoicePersona] = useState<'warm' | 'coach' | 'executive'>('warm');

  if (!sheetType) return null;

  const handleTestSound = (id: string) => {
    hapticsService.light();
    setIsPlaying(true);
    alarmAudio.playTone(id, volume);
    setTimeout(() => setIsPlaying(false), 2400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative z-10 w-full max-w-[480px] rounded-t-[32px] bg-white p-6 shadow-2xl border-t border-gray-100 max-h-[85vh] overflow-y-auto pb-safe"
      >
        {/* Grab Handle */}
        <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300 mb-4" />

        {/* 1. SOUNDS SHEET */}
        {sheetType === 'sounds' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#12A6A0]/15 text-[#12A6A0]">
                  <Music2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E1B4B]">Alarm Sounds & Tones</h3>
                  <p className="text-xs text-[#6B7280]">Preview peaceful chimes & pulses</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {AVAILABLE_SOUNDS.map((sound) => {
                const isSelected = selectedSound === sound.id;
                return (
                  <div
                    key={sound.id}
                    onClick={() => {
                      hapticsService.light();
                      setSelectedSound(sound.id);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl p-3.5 transition-all ${
                      isSelected
                        ? 'bg-[#12A6A0]/10 border border-[#12A6A0]/30 text-[#1E1B4B]'
                        : 'bg-[#F3F3F5] text-[#6B7280] hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          isSelected ? 'bg-[#12A6A0] text-white' : 'border-2 border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1E1B4B]">{sound.name}</div>
                        <div className="text-[11px] text-[#6B7280]">{sound.description}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestSound(sound.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#12A6A0] shadow-xs hover:scale-105"
                    >
                      {isPlaying ? (
                        <Square className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#1E1B4B] flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4 text-[#12A6A0]" />
                  Volume Preview
                </span>
                <span className="font-mono-numbers font-bold text-[#12A6A0]">{volume}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="w-full accent-[#12A6A0]"
              />
            </div>
          </div>
        )}

        {/* 2. NAP SHEET */}
        {sheetType === 'nap' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F57C1F]/15 text-[#F57C1F]">
                  <Coffee className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E1B4B]">Power Nap & Timer</h3>
                  <p className="text-xs text-[#6B7280]">Recharge your mental clarity</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2">
              {[15, 20, 30, 45].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    hapticsService.light();
                    setCustomNapMinutes(mins);
                  }}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all ${
                    customNapMinutes === mins
                      ? 'bg-[#F57C1F] text-white shadow-md font-bold'
                      : 'bg-[#F3F3F5] text-[#1E1B4B] hover:bg-gray-200 font-semibold'
                  }`}
                >
                  <span className="text-sm font-bold font-mono-numbers">+{mins}m</span>
                  <span className="text-[10px] opacity-80 font-sans">
                    {mins === 20 ? 'Power' : mins === 45 ? 'Deep' : 'Rest'}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom slider */}
            <div className="rounded-[24px] bg-[#F3F3F5] p-4 text-center">
              <span className="text-xs font-bold text-[#6B7280]">Selected Nap Duration</span>
              <div className="mt-1 font-mono-numbers text-3xl font-extrabold text-[#F57C1F]">
                {customNapMinutes} Minutes
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={customNapMinutes}
                onChange={(e) => setCustomNapMinutes(parseInt(e.target.value, 10))}
                className="mt-3 w-full accent-[#F57C1F]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                hapticsService.success();
                onStartNap(customNapMinutes);
                onClose();
              }}
              className="w-full min-h-[50px] rounded-2xl bg-[#F57C1F] hover:bg-[#e06b16] text-white font-bold text-sm shadow-md transition-all active:scale-98"
            >
              Start {customNapMinutes}m Nap Alarm
            </button>
          </div>
        )}

        {/* 3. BRIEFING SHEET */}
        {sheetType === 'briefing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9C1C7C]/15 text-[#9C1C7C]">
                  <AiIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E1B4B]">AI Morning Briefing</h3>
                  <p className="text-xs text-[#6B7280]">Configure spoken wake intelligence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5]">
                <span className="text-xs font-bold text-[#1E1B4B]">Weather & Sunrise Forecast</span>
                <ToggleSwitch
                  checked={briefingWeather}
                  onChange={(v) => {
                    hapticsService.light();
                    setBriefingWeather(v);
                  }}
                  label="Weather"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5]">
                <span className="text-xs font-bold text-[#1E1B4B]">Today's Scheduled Calendar</span>
                <ToggleSwitch
                  checked={briefingCalendar}
                  onChange={(v) => {
                    hapticsService.light();
                    setBriefingCalendar(v);
                  }}
                  label="Calendar"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F3F3F5]">
                <span className="text-xs font-bold text-[#1E1B4B]">Positive Morning Motivation</span>
                <ToggleSwitch
                  checked={briefingMotivation}
                  onChange={(v) => {
                    hapticsService.light();
                    setBriefingMotivation(v);
                  }}
                  label="Motivation"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1E1B4B] block mb-2">Voice Style</label>
              <div className="grid grid-cols-3 gap-2">
                {(['warm', 'coach', 'executive'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      hapticsService.light();
                      setVoicePersona(style);
                    }}
                    className={`p-3 rounded-2xl text-xs font-bold capitalize transition-all ${
                      voicePersona === style
                        ? 'bg-[#9C1C7C] text-white shadow-xs'
                        : 'bg-[#F3F3F5] text-[#6B7280] hover:bg-gray-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticsService.success();
                onClose();
              }}
              className="w-full min-h-[48px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] text-white font-bold text-xs shadow-md mt-2"
            >
              Save Briefing Settings
            </button>
          </div>
        )}

        {/* 4. ROUTINE SHEET */}
        {sheetType === 'routine' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5B800]/20 text-[#F5B800]">
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E1B4B]">Morning Wake Protocols</h3>
                  <p className="text-xs text-[#6B7280]">Habits synchronized with waking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3.5 rounded-2xl bg-[#F3F3F5] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#1E1B4B]">Hydration & Sunlight Protocol</h4>
                  <p className="text-[11px] text-[#6B7280]">500ml water + 10 mins morning light</p>
                </div>
                <span className="font-mono-numbers text-xs font-bold text-[#9C1C7C]">07:00 AM</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F3F3F5] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#1E1B4B]">Gentle Mobility & Stretching</h4>
                  <p className="text-[11px] text-[#6B7280]">Decompress spine & hips</p>
                </div>
                <span className="font-mono-numbers text-xs font-bold text-[#9C1C7C]">07:20 AM</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToSchedule();
              }}
              className="w-full min-h-[48px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] text-white font-bold text-xs shadow-md transition-colors"
            >
              Open Full Schedule Planner →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
