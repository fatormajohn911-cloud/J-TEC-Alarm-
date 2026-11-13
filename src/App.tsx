/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { RefreshCw } from 'lucide-react';
import { PageType } from './navigation/navigationTypes';
import { Alarm } from './types/alarm';
import { useAlarms } from './hooks/useAlarms';
import { useSchedule } from './hooks/useSchedule';
import { useSettings } from './hooks/useSettings';
import { usePWA } from './hooks/usePWA';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { AlarmFormModal } from './components/alarm/AlarmFormModal';
import { OnboardingModal, ReliabilityPermissionType } from './components/onboarding/OnboardingModal';
import { alarmAudio, NativeAlarm } from './services/nativeAlarmPlugin';
import {
  BackendStateSnapshot,
  fetchBackendConfig,
  getBackendStateSnapshot,
  subscribeBackendState,
  warmUpBackend,
} from './services/apiClient';

// Pages
import { HomePage } from './pages/HomePage';
import { AssistantPage } from './pages/AssistantPage';
import { SchedulePage } from './pages/SchedulePage';
import { AlarmsPage } from './pages/AlarmsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AlarmRingingScreen } from './pages/AlarmRingingScreen';

export default function App() {
  const [activePage, setActivePage] = useState<PageType>('home');
  const [settingsScrollTarget, setSettingsScrollTarget] = useState<string | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [isNewAlarmModalOpen, setIsNewAlarmModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
  const [backendState, setBackendState] = useState<BackendStateSnapshot>(() =>
    getBackendStateSnapshot()
  );

  const pwa = usePWA();

  // Warm up backend and fetch /v1/config on startup
  useEffect(() => {
    const unsub = subscribeBackendState(setBackendState);
    warmUpBackend();
    fetchBackendConfig();
    return unsub;
  }, []);

  const aiEnabled = backendState.config ? backendState.config.aiEnabled : true;
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

  const handleWebAlarmTrigger = useCallback((alarm: Alarm) => {
    setRingingAlarm((curr) => curr || alarm);
  }, []);

  // Core business logic hooks
  const {
    alarms,
    nextAlarmInfo,
    toggleAlarm,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    scheduleWebSnooze,
  } = useAlarms(handleWebAlarmTrigger);

  const {
    routines,
    selectedDay,
    setSelectedDay,
    toggleRoutine,
    addRoutine,
    deleteRoutine,
  } = useSchedule();

  const { settings, updateSetting, refreshPermissions, resetAllSettings } = useSettings();

  // First-tap gesture audio unlock for web browsers
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    return alarmAudio.attachAutoUnlock();
  }, []);

  // Check native Android reliability permissions on launch and whenever returning to app
  useEffect(() => {
    refreshPermissions();
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshPermissions();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshPermissions]);

  // Keep native WorkManager briefing worker context synced with user settings & routines
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const serverUrl =
      typeof window !== 'undefined' && window.location.origin.startsWith('http')
        ? window.location.origin
        : '';
    NativeAlarm.syncBriefingContext({
      userName: settings.userName || 'Friend',
      routines: routines.map((r) => ({
        time: r.time,
        title: r.title,
        durationMinutes: r.durationMinutes,
        dayOfWeek: r.dayOfWeek,
      })),
      serverUrl,
      includeWeather: settings.aiBriefingWeather,
      includeCalendar: settings.aiBriefingCalendar,
      includeMotivation: settings.aiBriefingMotivation,
      voiceStyle: settings.aiVoiceStyle,
    }).catch(() => {});
  }, [
    settings.userName,
    settings.aiBriefingWeather,
    settings.aiBriefingCalendar,
    settings.aiBriefingMotivation,
    settings.aiVoiceStyle,
    routines,
  ]);

  const handleRequestPermission = async (type: ReliabilityPermissionType) => {
    if (type === 'exact') {
      await NativeAlarm.requestExactAlarm();
    } else if (type === 'notifications') {
      await NativeAlarm.requestNotification();
    } else if (type === 'fullscreen') {
      await NativeAlarm.requestFullScreenIntent();
    } else if (type === 'battery') {
      await NativeAlarm.requestBatteryExempt();
    }
    await refreshPermissions();
  };

  // Handle Android hardware back button / browser back navigation
  useEffect(() => {
    const handlePopState = () => {
      if (activePage !== 'home') {
        setActivePage('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activePage]);

  const navigateTo = (page: PageType) => {
    if (page !== 'home') {
      window.history.pushState({ page }, '');
    }
    setActivePage(page);
  };

  const navigateBackToHome = () => {
    setSettingsScrollTarget(null);
    setActivePage('home');
  };

  const openApiKeySettings = () => {
    setSettingsScrollTarget('developer-api-keys');
    navigateTo('settings');
  };

  // Test ringing launcher
  const handleTriggerTestRing = (alarm?: Alarm) => {
    if (alarm) {
      setRingingAlarm(alarm);
    } else if (alarms.length > 0) {
      setRingingAlarm(alarms[0]);
    } else {
      setRingingAlarm({
        id: 'test_alarm',
        time: '07:00',
        label: 'Test Wake Up Alarm',
        days: [1, 2, 3, 4, 5],
        enabled: true,
        soundId: 'aurora',
        volume: 85,
        vibrate: true,
        snoozeIntervalMinutes: 9,
        snoozeLimit: 3,
        aiBriefing: true,
        createdAt: Date.now(),
      });
    }
  };

  // Quick nap preset calculator
  const handleQuickCreateNap = async (minutes: number) => {
    const future = new Date(Date.now() + minutes * 60000);
    const h = future.getHours().toString().padStart(2, '0');
    const m = future.getMinutes().toString().padStart(2, '0');

    await addAlarm({
      time: `${h}:${m}`,
      label: `Power Nap (${minutes}m)`,
      days: [],
      enabled: true,
      soundId: 'lofi_wake',
      volume: 80,
      vibrate: true,
      snoozeIntervalMinutes: 5,
      snoozeLimit: 1,
      aiBriefing: false,
    });
  };

  // Restore deleted alarm from Undo snackbar
  const handleRestoreAlarm = async (restored: Alarm) => {
    await addAlarm({
      time: restored.time,
      label: restored.label,
      days: restored.days,
      enabled: restored.enabled,
      soundId: restored.soundId,
      volume: restored.volume,
      vibrate: restored.vibrate,
      snoozeIntervalMinutes: restored.snoozeIntervalMinutes,
      snoozeLimit: restored.snoozeLimit,
      aiBriefing: restored.aiBriefing,
      aiVoiceStyle: restored.aiVoiceStyle,
    });
  };

  // Onboarding completion
  const handleCompleteOnboarding = (userName: string) => {
    updateSetting('userName', userName);
    updateSetting('onboardingCompleted', true);
  };

  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="min-h-[100dvh] w-full bg-[#EEF0F4] sm:flex sm:justify-center">
      <div className="relative flex flex-col h-[100dvh] w-full max-w-[480px] mx-auto bg-white text-[#1E1B4B] font-sans selection:bg-[#9C1C7C]/20 selection:text-[#9C1C7C] sm:shadow-[0_0_40px_rgba(30,27,75,0.06)] overflow-hidden">
        {/* Service Worker Update Available Banner */}
        {pwa.needRefresh && (
          <button
            type="button"
            onClick={pwa.refreshApp}
            className="shrink-0 w-full bg-[#2E2F6B] text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#3B3D78] transition-colors z-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Update available, tap to refresh</span>
          </button>
        )}

        {/* Full-Screen Alarm Ringing Experience */}
        {ringingAlarm ? (
          <AlarmRingingScreen
            alarm={ringingAlarm}
            settings={settings}
            routines={routines}
            aiEnabled={aiEnabled}
            onDismiss={() => setRingingAlarm(null)}
            onSnooze={(minutes) => {
              if (ringingAlarm) {
                scheduleWebSnooze(ringingAlarm, minutes);
              }
              setRingingAlarm(null);
            }}
          />
        ) : backendState.updateRequired ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white">
            <div className="w-full max-w-sm rounded-[28px] border border-indigo-100 bg-[#F3F3F5] p-6 shadow-sm space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B3D78] text-white">
                <RefreshCw className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-extrabold text-[#1E1B4B]">
                  Please update the app
                </h2>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  A newer version of AI Wake ({backendState.config?.minAppVersion}) is required to continue using online features. You are currently on v{appVersion}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full min-h-[44px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] text-white text-xs font-bold shadow-sm transition-colors"
              >
                Reload to check for update
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. FIRST-RUN ONBOARDING (shown once until completed) */}
            <OnboardingModal
              isOpen={!settings.onboardingCompleted}
              initialName={settings.userName || ''}
              settings={settings}
              onRequestPermission={handleRequestPermission}
              onComplete={handleCompleteOnboarding}
            />

            {/* HOME SCREEN: single scrolling main content area + bottom nav outside scroll area */}
            {activePage === 'home' && (
              <>
                <HomePage
                  nextAlarmInfo={nextAlarmInfo}
                  activeAlarms={alarms}
                  settings={settings}
                  aiEnabled={aiEnabled}
                  onToggleAlarm={toggleAlarm}
                  onOpenCreateAlarm={() => {
                    setEditingAlarm(null);
                    setIsNewAlarmModalOpen(true);
                  }}
                  onOpenEditAlarm={(alarm) => {
                    setEditingAlarm(alarm);
                    setIsNewAlarmModalOpen(true);
                  }}
                  onDeleteAlarm={deleteAlarm}
                  onRestoreAlarm={handleRestoreAlarm}
                  onQuickCreateNap={handleQuickCreateNap}
                  onNavigate={navigateTo}
                  onTestRing={handleTriggerTestRing}
                  onOpenNotifications={() => setIsNotificationOpen(true)}
                />

                {/* Bottom Navigation is ONLY shown on Home screen and sits outside the scroll area */}
                <BottomNavigation
                  onNavigate={navigateTo}
                  onOpenNewAlarm={() => {
                    setEditingAlarm(null);
                    setIsNewAlarmModalOpen(true);
                  }}
                  alarmCount={activeAlarmsCount}
                />
              </>
            )}

            {/* FULL-SCREEN SUBPAGES (No bottom navigation, header on top, content scrolls) */}
            {activePage === 'alarms' && (
              <AlarmsPage
                alarms={alarms}
                timeFormat24h={settings.timeFormat24h}
                onBack={navigateBackToHome}
                onToggleAlarm={toggleAlarm}
                onAddAlarm={addAlarm}
                onUpdateAlarm={updateAlarm}
                onDeleteAlarm={deleteAlarm}
                onTestRing={handleTriggerTestRing}
              />
            )}

            {activePage === 'assistant' && (
              <AssistantPage
                alarms={alarms}
                routines={routines}
                settings={settings}
                aiEnabled={aiEnabled}
                onBack={navigateBackToHome}
                onAddAlarm={addAlarm}
                onUpdateAlarm={updateAlarm}
                onDeleteAlarm={deleteAlarm}
                onToggleAlarm={toggleAlarm}
                onAddRoutine={addRoutine}
                onDeleteRoutine={deleteRoutine}
                onOpenApiKeySettings={openApiKeySettings}
                onViewAlarm={(alarmId) => {
                  const target = alarms.find((a) => a.id === alarmId);
                  if (target) {
                    setEditingAlarm(target);
                    setIsNewAlarmModalOpen(true);
                  } else {
                    navigateTo('alarms');
                  }
                }}
                onViewSchedule={(dayOfWeek) => {
                  if (typeof dayOfWeek === 'number') {
                    setSelectedDay(dayOfWeek);
                  }
                  navigateTo('schedule');
                }}
              />
            )}

            {activePage === 'schedule' && (
              <SchedulePage
                routines={routines}
                selectedDay={selectedDay}
                onBack={navigateBackToHome}
                onSelectDay={setSelectedDay}
                onToggleRoutine={toggleRoutine}
                onAddRoutine={addRoutine}
                onDeleteRoutine={deleteRoutine}
              />
            )}

            {activePage === 'settings' && (
              <SettingsPage
                settings={settings}
                pwa={pwa}
                aiEnabled={aiEnabled}
                scrollTarget={settingsScrollTarget}
                onClearScrollTarget={() => setSettingsScrollTarget(null)}
                onBack={navigateBackToHome}
                onUpdateSetting={updateSetting}
                onRefreshPermissions={refreshPermissions}
                onResetAll={resetAllSettings}
              />
            )}

            {/* Global Notifications Drawer */}
            <NotificationDrawer
              isOpen={isNotificationOpen}
              onClose={() => setIsNotificationOpen(false)}
              onOpenSettings={() => {
                setIsNotificationOpen(false);
                navigateTo('settings');
              }}
            />

            {/* Bottom Sheet Alarm Form (Create or Edit) */}
            <AlarmFormModal
              key={isNewAlarmModalOpen ? editingAlarm?.id || 'new' : 'closed'}
              isOpen={isNewAlarmModalOpen}
              initialAlarm={editingAlarm}
              timeFormat24h={settings.timeFormat24h}
              onClose={() => {
                setIsNewAlarmModalOpen(false);
                setEditingAlarm(null);
              }}
              onSave={(data) => {
                if ('id' in data) {
                  updateAlarm(data as Alarm);
                } else {
                  addAlarm(data as any);
                }
                setIsNewAlarmModalOpen(false);
                setEditingAlarm(null);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
