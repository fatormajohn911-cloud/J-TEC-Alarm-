/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TabType } from './navigation/navigationTypes';
import { Alarm } from './types/alarm';
import { useAlarms } from './hooks/useAlarms';
import { useSchedule } from './hooks/useSchedule';
import { useSettings } from './hooks/useSettings';
import { AppHeader } from './components/layout/AppHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { AndroidStatusBarMock } from './components/layout/AndroidStatusBarMock';
import { AlarmFormModal } from './components/alarm/AlarmFormModal';

// Pages
import { HomePage } from './pages/HomePage';
import { AssistantPage } from './pages/AssistantPage';
import { SchedulePage } from './pages/SchedulePage';
import { AlarmsPage } from './pages/AlarmsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AlarmRingingScreen } from './pages/AlarmRingingScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [isNewAlarmModalOpen, setIsNewAlarmModalOpen] = useState(false);

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
    routinesForSelectedDay,
    toggleRoutine,
    addRoutine,
    deleteRoutine,
  } = useSchedule();

  const { settings, updateSetting, resetAllSettings } = useSettings();

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
      days: [], // Once
      enabled: true,
      soundId: 'lofi_wake',
      volume: 80,
      vibrate: true,
      snoozeIntervalMinutes: 5,
      snoozeLimit: 1,
      aiBriefing: false,
    });
  };

  // Dismiss ringing
  const handleDismissRinging = () => {
    setRingingAlarm(null);
  };

  // Snooze ringing
  const handleSnoozeRinging = (snoozeMinutes: number) => {
    setRingingAlarm(null);
    // You could schedule a snooze alarm or display notification
  };

  // 6. SPECIAL SCREEN: Full-Screen Alarm Ringing Experience
  // When active, it completely replaces normal layout and bottom navigation!
  if (ringingAlarm) {
    return (
      <AlarmRingingScreen
        alarm={ringingAlarm}
        onDismiss={handleDismissRinging}
        onSnooze={handleSnoozeRinging}
      />
    );
  }

  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center">
      {/* Optional Simulated Android Device Frame */}
      <div
        className={`w-full transition-all flex flex-col min-h-screen ${
          settings.deviceFrameMockup
            ? 'max-w-[420px] my-6 rounded-[44px] border-[6px] border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden bg-zinc-950 relative'
            : 'max-w-3xl'
        }`}
      >
        {/* Android Status Bar Mock (active in mockup mode or on top) */}
        {settings.deviceFrameMockup && (
          <AndroidStatusBarMock timeFormat24h={settings.timeFormat24h} />
        )}

        {/* Header */}
        <AppHeader
          currentTab={currentTab}
          onNavigate={setCurrentTab}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          onTriggerTestAlarm={() => handleTriggerTestRing()}
          unreadCount={2}
        />

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 pt-5">
          {currentTab === 'home' && (
            <HomePage
              nextAlarmInfo={nextAlarmInfo}
              activeAlarmsCount={activeAlarmsCount}
              todayRoutines={routinesForSelectedDay}
              settings={settings}
              onToggleAlarm={toggleAlarm}
              onOpenCreateAlarm={() => setIsNewAlarmModalOpen(true)}
              onQuickCreateNap={handleQuickCreateNap}
              onNavigate={setCurrentTab}
              onTestRing={handleTriggerTestRing}
              onToggleRoutine={toggleRoutine}
            />
          )}

          {currentTab === 'assistant' && (
            <AssistantPage
              onAddAlarm={addAlarm}
              onNavigateToAlarms={() => setCurrentTab('alarms')}
            />
          )}

          {currentTab === 'schedule' && (
            <SchedulePage
              routines={routines}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onToggleRoutine={toggleRoutine}
              onAddRoutine={addRoutine}
              onDeleteRoutine={deleteRoutine}
            />
          )}

          {currentTab === 'alarms' && (
            <AlarmsPage
              alarms={alarms}
              timeFormat24h={settings.timeFormat24h}
              onToggleAlarm={toggleAlarm}
              onAddAlarm={addAlarm}
              onUpdateAlarm={updateAlarm}
              onDeleteAlarm={deleteAlarm}
              onTestRing={handleTriggerTestRing}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onUpdateSetting={updateSetting}
              onResetAll={resetAllSettings}
            />
          )}
        </main>

        {/* Fixed Bottom Navigation */}
        <BottomNavigation
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          alarmCount={activeAlarmsCount}
        />
      </div>

      {/* Global Modals */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onOpenSettings={() => {
          setIsNotificationOpen(false);
          setCurrentTab('settings');
        }}
      />

      <AlarmFormModal
        isOpen={isNewAlarmModalOpen}
        timeFormat24h={settings.timeFormat24h}
        onClose={() => setIsNewAlarmModalOpen(false)}
        onSave={(data) => {
          addAlarm(data as any);
          setIsNewAlarmModalOpen(false);
        }}
      />
    </div>
  );
}
