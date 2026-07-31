'use client';

import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function Progress({ value, size = 'md', showLabel = true, className }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-[var(--bg-surface)] rounded-full overflow-hidden', sizes[size])}>
        <div
          className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300 ease-out relative"
          style={{ width: `${clampedValue}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer [background-size:200%_100%]" />
        </div>
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1.5 text-xs text-[var(--text-muted)]">
          <span>{clampedValue}%</span>
          {clampedValue === 100 && <span className="text-[var(--color-accent)]">Complete</span>}
        </div>
      )}
    </div>
  );
}

