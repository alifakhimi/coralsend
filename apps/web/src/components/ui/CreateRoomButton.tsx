'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateRoomButtonProps {
  onClick: () => void;
  className?: string;
}

export function CreateRoomButton({ onClick, className }: CreateRoomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full group relative bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)] rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:brightness-110 transition-all',
        className
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--color-accent)] rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-[var(--color-accent-border)] group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
        <div className="text-left">
          <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Create Room</h3>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm">Start a new sharing session</p>
        </div>
      </div>
    </button>
  );
}
