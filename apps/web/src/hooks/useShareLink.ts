'use client';

import { useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export interface UseShareLinkOptions {
  /** Payload for Web Share (title, text, url). Copy link uses payload.url. */
  payload: SharePayload;
  /** Toast or callback when link is copied (e.g. fallback after share). */
  onCopied?: () => void;
}

export interface UseShareLinkReturn {
  /** Copy room link (url) to clipboard. */
  copyLink: () => Promise<void>;
  /** Share via Web Share API if available, else copy link. */
  shareLink: () => Promise<void>;
  /** Current copy key from useCopyToClipboard ('link' when link was just copied). */
  copiedKey: 'link' | null;
}

/**
 * Reusable share/copy room link: copy = URL only; share = title + text + url.
 * Use with ShareLinkButtons for consistent UI.
 */
export function useShareLink(options: UseShareLinkOptions): UseShareLinkReturn {
  const { payload, onCopied } = options;
  const { copy: copyToClipboard, copied } = useCopyToClipboard<'link'>();

  const copyLink = useCallback(async () => {
    const ok = await copyToClipboard(payload.url, 'link');
    if (ok && onCopied) onCopied();
  }, [payload.url, copyToClipboard, onCopied]);

  const shareLink = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
      } catch {
        await copyLink();
        if (onCopied) onCopied();
      }
    } else {
      await copyLink();
      if (onCopied) onCopied();
    }
  }, [payload, copyLink, onCopied]);

  return {
    copyLink,
    shareLink,
    copiedKey: copied === 'link' ? 'link' : null,
  };
}
