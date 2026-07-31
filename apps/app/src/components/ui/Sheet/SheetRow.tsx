'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SheetRowProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action: ReactNode;
  className?: string;
}

/** Single row: icon + title/subtitle + action (e.g. Switch). Uses theme tokens. */
export function SheetRow({
  icon,
  title,
  subtitle,
  action,
  className,
}: SheetRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] p-2.5',
        'bg-[var(--surface-glass)]/60',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-[var(--text-muted)]" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
