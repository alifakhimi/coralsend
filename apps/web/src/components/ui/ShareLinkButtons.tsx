'use client';

import { Button } from '@/components/ui/Button';
import { Copy, Check, Share2, Link } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ShareLinkButtonsProps {
  /** Copy link (room URL) to clipboard. */
  onCopyLink: () => void | Promise<void>;
  /** Share via Web Share API or copy link. */
  onShareLink: () => void | Promise<void>;
  /** Whether link was just copied (show "Copied" / check). */
  copiedKey?: 'link' | 'share' | null;
  /** Show "Copy link" button. */
  showCopyLink?: boolean;
  /** Show "Share" button (when Web Share is available or as fallback to copy). */
  showShare?: boolean;
  /** Button size. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional class for container. */
  className?: string;
}

/**
 * Reusable actions: Copy link and Share (title + message + link).
 * Use with useShareLink + getRoomSharePayload for consistent behavior.
 */
export function ShareLinkButtons({
  onCopyLink,
  onShareLink,
  copiedKey = null,
  showCopyLink = true,
  showShare = true,
  size = 'sm',
  className,
}: ShareLinkButtonsProps) {
  const hasShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {showCopyLink && (
        <Button
          variant="secondary"
          size={size}
          onClick={() => void onCopyLink()}
          aria-label={copiedKey === 'link' ? 'Link copied' : 'Copy link'}
        >
          {copiedKey === 'link' ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Link className="h-4 w-4" aria-hidden />
          )}
          Copy link
        </Button>
      )}
      {showShare && hasShare && (
        <Button
          variant="secondary"
          size={size}
          onClick={() => void onShareLink()}
          aria-label="Share room link"
        >
          {copiedKey === 'share' ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden />
          )}
          Share
        </Button>
      )}
    </div>
  );
}
