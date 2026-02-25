'use client';

import { useCallback, useState } from 'react';
import { COPY_FEEDBACK_MS } from '@/lib/ui-constants';

export interface UseCopyToClipboardOptions {
  /** How long to show "copied" state (ms). Default from ui-constants. */
  feedbackMs?: number;
}

export interface UseCopyToClipboardReturn<K extends string = string> {
  /** Copy text to clipboard; optional key to track which field was copied. */
  copy: (text: string, key?: K) => Promise<boolean>;
  /** The key passed to the last successful copy, or null after feedbackMs. */
  copied: K | null;
}

export function useCopyToClipboard<K extends string = string>(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn<K> {
  const { feedbackMs = COPY_FEEDBACK_MS } = options;
  const [copied, setCopied] = useState<K | null>(null);

  const copy = useCallback(
    async (text: string, key?: K): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        if (key !== undefined) {
          setCopied(key);
          setTimeout(() => setCopied(null), feedbackMs);
        }
        return true;
      } catch (err) {
        console.error('Copy failed:', err);
        return false;
      }
    },
    [feedbackMs]
  ) as UseCopyToClipboardReturn<K>['copy'];

  return { copy, copied };
}
