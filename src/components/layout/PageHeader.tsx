import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-gradient-to-r from-[#3F4080] via-[#353676] to-[#2E2F6B] text-white pt-safe shadow-sm">
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        {/* Left: Back button + Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Home"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
            {subtitle && (
              <p className="text-[11px] text-purple-200/80 font-medium">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Action slot if any */}
        {rightAction && <div className="flex items-center">{rightAction}</div>}
      </div>
    </header>
  );
};
