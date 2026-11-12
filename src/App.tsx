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
import { OnboardingModal } from './components/onboarding/OnboardingModal';

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

  const { settings, updateSetting, resetAllSettings } = useSettings();

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
        onDismiss={() => setRingingAlarm(null)}
        onSnooze={() => setRingingAlarm(null)}
      />
    );
  }

  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white text-[#1E1B4B] flex flex-col font-sans selection:bg-[#9C1C7C]/20 selection:text-[#9C1C7C]">
      {/* 1. FIRST-RUN ONBOARDING (shown once until completed) */}
      <OnboardingModal
        isOpen={!settings.onboardingCompleted}
        initialName={settings.userName || 'Alex'}
        onComplete={handleCompleteOnboarding}
      />

      {/* Main Viewport */}
      <div className="w-full flex-1 flex flex-col">
        {/* HOME SCREEN */}
        {activePage === 'home' && (
          <div className="flex-1 flex flex-col transition-opacity duration-200">
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

            {/* Bottom Navigation is ONLY shown on Home screen */}
            <BottomNavigation
              onNavigate={navigateTo}
              onOpenNewAlarm={() => {
                setEditingAlarm(null);
                setIsNewAlarmModalOpen(true);
              }}
              alarmCount={activeAlarmsCount}
            />
          </div>
        )}

        {/* FULL-SCREEN SUBPAGES (No bottom navigation, has back arrow to Home) */}
        {activePage === 'alarms' && (
          <div className="flex-1">
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
          </div>
        )}

        {activePage === 'assistant' && (
          <div className="flex-1">
            <AssistantPage
              onBack={navigateBackToHome}
              onAddAlarm={addAlarm}
              onNavigateToAlarms={() => navigateTo('alarms')}
            />
          </div>
        )}

        {activePage === 'schedule' && (
          <div className="flex-1">
            <SchedulePage
              routines={routines}
              selectedDay={selectedDay}
              onBack={navigateBackToHome}
              onSelectDay={setSelectedDay}
              onToggleRoutine={toggleRoutine}
              onAddRoutine={addRoutine}
              onDeleteRoutine={deleteRoutine}
            />
          </div>
        )}

        {activePage === 'settings' && (
          <div className="flex-1">
            <SettingsPage
              settings={settings}
              onBack={navigateBackToHome}
              onUpdateSetting={updateSetting}
              onResetAll={resetAllSettings}
            />
          </div>
        )}
      </div>

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
