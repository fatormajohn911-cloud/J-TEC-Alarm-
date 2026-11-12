import { X, CheckCircle2, ShieldAlert, Bell } from 'lucide-react';
import { AiIcon } from '../common/AiIcon';

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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="relative flex h-full w-full max-w-sm flex-col bg-white p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9C1C7C]/10 text-[#9C1C7C]">
              <Bell className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-[#1E1B4B]">Notifications</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications panel"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-400 hover:text-[#1E1B4B] hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {/* Notification 1 */}
          <div className="rounded-2xl border border-gray-100 bg-[#F3F3F5] p-4 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9C1C7C]/15 text-[#9C1C7C]">
                <AiIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1E1B4B]">AI Wake Foundation Ready</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Now</span>
                </div>
                <p className="mt-1 text-xs text-[#6B7280] leading-relaxed">
                  Phase 1 foundation is operational. Alarm models, schedule synchronization, and Kotlin bridge interfaces are staged.
                </p>
              </div>
            </div>
          </div>

          {/* Notification 2 */}
          <div className="rounded-2xl border border-gray-100 bg-[#F3F3F5] p-4 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#12A6A0]/15 text-[#12A6A0]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1E1B4B]">Reliability Permissions</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Today</span>
                </div>
                <p className="mt-1 text-xs text-[#6B7280] leading-relaxed">
                  Exact alarm scheduling and battery optimization exemption status are verified in settings.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="mt-2 text-xs font-semibold text-[#9C1C7C] hover:underline"
                >
                  Review reliability settings →
                </button>
              </div>
            </div>
          </div>

          {/* Notification 3 */}
          <div className="rounded-2xl border border-gray-100 bg-[#F3F3F5] p-4 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F57C1F]/15 text-[#F57C1F]">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1E1B4B]">Phase 2 AI Readiness</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Preview</span>
                </div>
                <p className="mt-1 text-xs text-[#6B7280] leading-relaxed">
                  Voice command transcription and Gemini briefing generation architecture will connect during Phase 2.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-2xl bg-[#3B3D78] hover:bg-[#2E2F6B] py-2.5 text-xs font-bold text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
