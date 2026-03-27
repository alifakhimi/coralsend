'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function PanelCard({
  title,
  icon,
  badge,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  noPadding = false,
}: PanelCardProps) {
  const hasHeader = Boolean(title || icon || badge || actions);

  return (
    <section
      className={cn(
        'rounded-2xl border border-[var(--border-soft)] glass overflow-hidden flex flex-col',
        className
      )}
    >
      {hasHeader && (
        <header className="sticky top-0 z-10 glass-strong border-b border-[var(--border-soft)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              {title && <h3 className="font-semibold text-[var(--text-primary)] truncate">{title}</h3>}
              {badge}
            </div>
            {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
          </div>
        </header>
      )}

      <div className={cn('flex-1 min-h-0 overflow-y-auto', !noPadding && 'p-4', bodyClassName)}>
        {children}
      </div>

      {footer && (
        <footer className="sticky bottom-0 glass-strong border-t border-[var(--border-soft)] p-4">
          {footer}
        </footer>
      )}
    </section>
  );
}
