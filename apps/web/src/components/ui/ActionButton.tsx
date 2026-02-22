'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: 'default' | 'primary' | 'danger' | 'teal';
  className?: string;
  iconOnlyOnMobile?: boolean;
}

export function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  title,
  variant = 'default',
  className,
  iconOnlyOnMobile = true,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors border cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'default' && 'border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass)]',
        variant === 'primary' && 'border-[var(--color-accent-border)] text-white bg-[var(--color-accent)] hover:brightness-110',
        variant === 'teal' && 'border-[var(--color-accent-border)] text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]',
        variant === 'danger' && 'border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]',
        className
      )}
    >
      {icon}
      <span className={cn(iconOnlyOnMobile && 'hidden sm:inline')}>{label}</span>
    </button>
  );
}
