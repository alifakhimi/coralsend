'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T = string> {
  value: T;
  label: string;
}

export interface SegmentGroupProps<T = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Number of columns (2 or 4). */
  columns?: 2 | 4;
  /** Smaller text for many options. */
  size?: 'sm' | 'md';
  /** Optional hint below the group. */
  hint?: string;
  /** Optional label above the group. */
  label?: ReactNode;
  className?: string;
}

/** Horizontal segment control (e.g. max members 2/4/8/16 or Never/1h/24h/7d). Theme-aware. */
export function SegmentGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 4,
  size = 'md',
  hint,
  label,
  className,
}: SegmentGroupProps<T>) {
  const gridClass = columns === 4 ? 'grid-cols-4' : 'grid-cols-2';
  return (
    <div className={cn('space-y-1.5', className)}>
      {label != null && (
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
      )}
      <div className={cn('grid gap-1.5', gridClass)}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'rounded-lg border font-medium transition-colors',
                size === 'sm' ? 'py-2 text-xs' : 'py-2 text-sm',
                isSelected
                  ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                  : 'border-[var(--border-soft)] bg-[var(--surface-glass)] text-[var(--text-muted)] hover:bg-[var(--surface-glass-strong)] hover:text-[var(--text-primary)]'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint != null && (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}
