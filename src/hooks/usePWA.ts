import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);

  const updateSwFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(
    null
  );
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    let cleanupSwListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            regs.forEach((r) => r.unregister().catch(() => {}));
          })
          .catch(() => {});
      }
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => {
            keys.forEach((k) => caches.delete(k).catch(() => {}));
          })
          .catch(() => {});
      }
    } else if ('serviceWorker' in navigator) {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          if (registration.waiting) {
            waitingWorkerRef.current = registration.waiting;
            setNeedRefresh(true);
          }
          const handleUpdateFound = () => {
            const installing = registration.installing;
            if (!installing) return;
            const onStateChange = () => {
              if (
                installing.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                waitingWorkerRef.current =
                  registration.waiting || installing;
                setNeedRefresh(true);
              }
            };
            installing.addEventListener('statechange', onStateChange);
          };
          registration.addEventListener('updatefound', handleUpdateFound);
          cleanupSwListener = () => {
            registration.removeEventListener('updatefound', handleUpdateFound);
          };
        },
      });
      updateSwFnRef.current = updateSW;
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      cleanupSwListener?.();
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const refreshApp = useCallback(async () => {
    if (waitingWorkerRef.current) {
      try {
        waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        // ignore
      }
    }
    if (updateSwFnRef.current) {
      await updateSwFnRef.current(true);
    } else {
      window.location.reload();
    }
  }, []);

  return {
    canPromptInstall: Boolean(deferredPrompt) && !isInstalled && !Capacitor.isNativePlatform(),
    isInstalled,
    isIOS: isIOS && !isInstalled && !Capacitor.isNativePlatform(),
    needRefresh,
    promptInstall,
    refreshApp,
  };
}
