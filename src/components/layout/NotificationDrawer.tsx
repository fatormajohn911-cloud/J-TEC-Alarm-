import React from 'react';
import { X, CheckCircle2, ShieldAlert, Sparkles, Bell } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-semibold text-zinc-100">Notifications</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications panel"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {/* Notification 1 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-200">AI Wake Foundation Ready</h3>
                  <span className="text-[10px] text-zinc-400">Now</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                  Phase 1 foundation is operational. Alarm models, schedule synchronization, and Kotlin bridge interfaces are staged.
                </p>
              </div>
            </div>
          </div>

          {/* Notification 2 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-200">Reliability Permissions</h3>
                  <span className="text-[10px] text-zinc-400">Today</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                  Exact alarm scheduling and battery optimization exemption status are verified in settings.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="mt-2 text-xs font-medium text-purple-400 hover:text-purple-300 underline underline-offset-2"
                >
                  Review reliability settings →
                </button>
              </div>
            </div>
          </div>

          {/* Notification 3 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-200">Phase 2 AI Readiness</h3>
                  <span className="text-[10px] text-zinc-400">Preview</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                  Voice command transcription and Gemini briefing generation architecture will connect during Phase 2.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 py-2.5 text-xs font-medium text-zinc-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
