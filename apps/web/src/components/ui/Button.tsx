'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer';

    const variants = {
      primary: 'bg-[var(--color-accent-bg)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-bg-hover)] focus:ring-[var(--color-accent)] shadow-lg shadow-[var(--color-accent-border)]',
      secondary: 'glass-strong text-[var(--text-primary)] hover:bg-[var(--color-accent-subtle)] border border-[var(--border-soft)] focus:ring-[var(--color-accent)]',
      ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-glass)] hover:text-[var(--text-primary)] focus:ring-[var(--color-accent)]',
      danger: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] border border-[var(--color-error)] focus:ring-[var(--color-error)]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-2.5 text-base',
      icon: 'p-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

