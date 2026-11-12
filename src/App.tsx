/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PageType } from './navigation/navigationTypes';
import { Alarm } from './types/alarm';
import { useAlarms } from './hooks/useAlarms';
import { useSchedule } from './hooks/useSchedule';
import { useSettings } from './hooks/useSettings';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { AlarmFormModal } from './components/alarm/AlarmFormModal';
import { OnboardingModal, ReliabilityPermissionType } from './components/onboarding/OnboardingModal';
import { NativeAlarm } from './services/nativeAlarmPlugin';

// Pages
import { HomePage } from './pages/HomePage';
import { AssistantPage } from './pages/AssistantPage';
import { SchedulePage } from './pages/SchedulePage';
import { AlarmsPage } from './pages/AlarmsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AlarmRingingScreen } from './pages/AlarmRingingScreen';

export default function App() {
  const [activePage, setActivePage] = useState<PageType>('home');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [isNewAlarmModalOpen, setIsNewAlarmModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);

  // Core business logic hooks
  const {
    alarms,
    nextAlarmInfo,
    toggleAlarm,
    addAlarm,
    updateAlarm,
    deleteAlarm,
  } = useAlarms();

  const {
    routines,
    selectedDay,
    setSelectedDay,
    toggleRoutine,
    addRoutine,
    deleteRoutine,
  } = useSchedule();

  const { settings, updateSetting, refreshPermissions, resetAllSettings } = useSettings();

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
    setActivePage('home');
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

  // Full-Screen Alarm Ringing Experience
  if (ringingAlarm) {
    return (
      <AlarmRingingScreen
        alarm={ringingAlarm}
        settings={settings}
        routines={routines}
        onDismiss={() => setRingingAlarm(null)}
        onSnooze={() => setRingingAlarm(null)}
      />
    );
  }

  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-white text-[#1E1B4B] font-sans selection:bg-[#9C1C7C]/20 selection:text-[#9C1C7C]">
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
          onBack={navigateBackToHome}
          onAddAlarm={addAlarm}
          onUpdateAlarm={updateAlarm}
          onDeleteAlarm={deleteAlarm}
          onToggleAlarm={toggleAlarm}
          onAddRoutine={addRoutine}
          onDeleteRoutine={deleteRoutine}
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
    </div>
  );
}
