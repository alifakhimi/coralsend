'use client';

import useFitText from 'use-fit-text';
import { cn } from '@/lib/utils';

interface FitTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Min font size in percent (default: 4 for small avatars) */
  minFontSize?: number;
  /** Max font size in percent (default: 100) */
  maxFontSize?: number;
}

/**
 * Fits text to its container by dynamically adjusting font size.
 * Uses use-fit-text (MIT) for binary-search-based fitting.
 */
export function FitText({
  children,
  className,
  style,
  minFontSize = 4,
  maxFontSize = 1000,
}: FitTextProps) {
  const { fontSize, ref } = useFitText({
    logLevel: 'none',
    minFontSize,
    maxFontSize,
  });

  return (
    <div
      ref={ref}
      className={cn('overflow-hidden', className)}
      style={{ ...style, fontSize }}
    >
      {children}
    </div>
  );
}
