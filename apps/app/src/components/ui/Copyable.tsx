'use client';

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface CopyableProps {
  /** Content to show (any React node). */
  children: ReactNode;
  /** Value to copy to clipboard. */
  value: string;
  /** Show "Copy" / "Copied" text next to icon. Default true. */
  showText?: boolean;
  /** Label when not copied (e.g. "Copy link"). Default "Copy". */
  copyLabel?: string;
  /** Called after successful copy. */
  onCopied?: () => void;
  /** Copy button size. */
  size?: 'sm' | 'md' | 'icon';
  /** Copy button variant. */
  variant?: 'ghost' | 'secondary';
  /** Optional class for the wrapper (flex container). */
  className?: string;
  /** Optional class for the copy button. */
  buttonClassName?: string;
  /** Put copy button before children. Default false (after). */
  buttonFirst?: boolean;
}

const sizeClasses = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-2.5 text-sm',
  icon: 'h-8 w-8 p-0',
} as const;

const iconSizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  icon: 'h-4 w-4',
} as const;

/**
 * Wraps any content and shows a copy button (icon only or icon + text) beside it.
 * Copies `value` to clipboard when the button is clicked.
 */
export function Copyable({
  children,
  value,
  showText = false,
  copyLabel = 'Copy',
  onCopied,
  size = 'sm',
  variant = 'ghost',
  className,
  buttonClassName,
  buttonFirst = false,
}: CopyableProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCopied(true);
      onCopied?.();
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [value, onCopied]);

  const copyButton = (
    <Button
      variant={variant}
      size={size === 'icon' ? 'icon' : 'sm'}
      onClick={handleCopy}
      className={cn(size !== 'icon' && sizeClasses[size], buttonClassName)}
      aria-label={copied ? 'Copied' : copyLabel}
    >
      {copied ? (
        <Check className={cn(iconSizes[size], 'text-[var(--color-success)]')} aria-hidden />
      ) : (
        <Copy className={iconSizes[size]} aria-hidden />
      )}
      {showText && size !== 'icon' && (
        <span>{copied ? 'Copied' : copyLabel}</span>
      )}
    </Button>
  );

  return (
    <div className={cn('flex flex-nowrap items-center gap-2', className)}>
      {buttonFirst ? copyButton : null}
      {children}
      {buttonFirst ? null : copyButton}
    </div>
  );
}
