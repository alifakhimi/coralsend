'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SheetSectionProps {
  /** Uppercase label (e.g. "Room identity"). */
  title?: string;
  /** Optional one-line description below title. */
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Card block for sheet content. Uses theme glass and border. */
export function SheetSection({
  title,
  description,
  children,
  className,
}: SheetSectionProps) {
  return (
    <div
      className={cn(
        'flex flex-col glass-strong rounded-xl border border-[var(--border-soft)] p-3',
        className
      )}
    >
      {title != null && (
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-primary)]">
          {title}
        </p>
      )}
      {description != null && (
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
      )}
      <div className={title != null || description != null ? 'flex flex-1' : undefined}>
        {children}
      </div>
    </div>
  );
}
