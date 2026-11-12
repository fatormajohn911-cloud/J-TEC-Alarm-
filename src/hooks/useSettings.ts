import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types/settings';
import { storageService } from '../services/storageService';
import { NativeAlarm } from '../services/nativeAlarmPlugin';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());

  useEffect(() => {
    storageService.saveSettings(settings);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refreshPermissions = useCallback(async () => {
    try {
      const perms = await NativeAlarm.checkPermissions();
      setSettings((prev) => ({
        ...prev,
        exactAlarmPermission: perms.exactAlarm,
        batteryOptimizationExempt: perms.batteryExempt,
        notificationPermission: perms.notifications,
        fullScreenIntentPermission: perms.fullScreenIntent,
      }));
    } catch (err) {
      console.error('Failed checking permissions:', err);
    }
  }, []);

  const resetAllSettings = useCallback(() => {
    storageService.clearAllData();
    window.location.reload();
  }, []);

  return {
    settings,
    updateSetting,
    refreshPermissions,
    resetAllSettings,
  };
}
