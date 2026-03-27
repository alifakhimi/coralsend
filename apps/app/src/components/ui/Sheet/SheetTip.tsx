'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SheetTipProps {
  /** 'info' = accent tint, 'warning' = warning tint. */
  variant?: 'info' | 'warning';
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Tip or notice block inside a sheet (e.g. security tip, encryption note). Theme-aware. */
export function SheetTip({
  variant = 'info',
  icon,
  children,
  className,
}: SheetTipProps) {
  const isWarning = variant === 'warning';
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border p-2.5',
        isWarning
          ? 'border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_5%,transparent)]'
          : 'border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)]/50',
        className
      )}
    >
      <span
        className={cn(
          'shrink-0 mt-0.5',
          isWarning ? 'text-[var(--color-warning)]' : 'text-[var(--color-accent)]'
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 text-xs [&_strong]:font-semibold">{children}</div>
    </div>
  );
}
