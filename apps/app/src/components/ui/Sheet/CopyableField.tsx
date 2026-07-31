'use client';

import { type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../Button';

export interface CopyableFieldProps {
  /** Optional label above value (e.g. "Room code"). */
  label?: ReactNode | string | undefined;
  /** Value to display and copy (e.g. room id). */
  value: string;
  /** Optional hint below value. */
  hint?: string;
  /** Whether the copy action just succeeded (show "Copied"). */
  copied?: boolean;
  /** Called when user clicks copy; pass the value to copy. */
  onCopy: () => void | Promise<void>;
  /** Button label when not copied (e.g. "Copy link"). Default "Copy". */
  copyLabel?: string;
  /** Size of value text. */
  valueSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

const valueSizeClasses = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl sm:text-[2rem]',
} as const;

/** Displays a value with copy button and optional label/hint. Theme-aware. */
export function CopyableField({
  label,
  value,
  hint,
  copied = false,
  copyLabel = 'Copy',
  valueSize = 'md',
  className,
  onCopy,
}: CopyableFieldProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {label ? (
        <span className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
          {label}
        </span>
      ) : undefined}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-row flex-nowrap items-start gap-2">
          <p
            className={cn(
              'font-mono font-semibold tracking-wide leading-none text-[var(--color-accent)]',
              valueSizeClasses[valueSize]
            )}
          >
            {value}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-7 px-2 text-xs"
            aria-label={copied ? 'Copied' : copyLabel}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--color-success)]" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{copied ? 'Copied' : copyLabel}</span>
          </Button>
        </div>
      </div>
      {hint != null && (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}
