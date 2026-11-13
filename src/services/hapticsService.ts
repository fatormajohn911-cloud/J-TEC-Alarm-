import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

function webVibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported vibration in browser
  }
}

export const hapticsService = {
  async light() {
    if (!Capacitor.isNativePlatform()) {
      webVibrate(10);
      return;
    }
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      webVibrate(10);
    }
  },

  async medium() {
    if (!Capacitor.isNativePlatform()) {
      webVibrate(25);
      return;
    }
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      webVibrate(25);
    }
  },

  async success() {
    if (!Capacitor.isNativePlatform()) {
      webVibrate([20, 40, 20]);
      return;
    }
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      webVibrate([20, 40, 20]);
    }
  },

  async selection() {
    if (!Capacitor.isNativePlatform()) {
      webVibrate(8);
      return;
    }
    try {
      await Haptics.selectionChanged();
    } catch {
      webVibrate(8);
    }
  },
};
