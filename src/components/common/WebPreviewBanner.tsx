import React, { useEffect, useState } from 'react';
import { Globe, Volume2, CheckCircle2 } from 'lucide-react';
import { alarmAudio, NativeAlarm } from '../../services/nativeAlarmPlugin';
import { hapticsService } from '../../services/hapticsService';

export const WebPreviewBanner: React.FC = () => {
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() =>
    alarmAudio.isUnlocked()
  );

  useEffect(() => {
    if (NativeAlarm.isNative()) return;
    return alarmAudio.subscribeUnlock(setAudioUnlocked);
  }, []);

  if (NativeAlarm.isNative()) {
    return null;
  }

  const handleEnableSound = async () => {
    hapticsService.light();
    await alarmAudio.unlock();
  };

  return (
    <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 p-3.5 flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 mt-0.5">
        <Globe className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-medium text-amber-950 leading-relaxed">
          Web preview: alarms only ring while this page is open. Install the Android app for reliable background alarms.
        </p>
        <div className="flex items-center gap-2">
          {audioUnlocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100/90 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Sound enabled</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableSound}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B3D78] hover:bg-[#2E2F6B] px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors active:scale-95"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>Enable sound</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
