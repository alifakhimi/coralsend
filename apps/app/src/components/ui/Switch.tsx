'use client';

import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-11 h-6 rounded-full transition-colors relative shrink-0',
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--bg-surface)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}
