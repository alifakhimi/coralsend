'use client';

import posthog from 'posthog-js';
import type { AnalyticsAdapter } from './types';

export class PostHogAdapter implements AnalyticsAdapter {
  init(): void {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (!key || typeof window === 'undefined') return;
    posthog.init(key, { api_host: host });
  }

  setConsent(granted: boolean): void {
    if (typeof window === 'undefined') return;
    if (granted) posthog.opt_in_capturing();
    else posthog.opt_out_capturing();
  }

  hasConsentChoice(): boolean {
    return typeof window === 'undefined' || posthog.has_opted_in_capturing() || posthog.has_opted_out_capturing();
  }

  identify(userId: string, properties?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    posthog.identify(userId);
    if (properties && Object.keys(properties).length > 0) {
      posthog.people.set(properties);
    }
  }

  track(event: string, properties?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    posthog.capture(event, properties);
  }

  pageView(url?: string): void {
    if (typeof window === 'undefined') return;
    posthog.capture('$pageview', url ? { $current_url: url } : undefined);
  }

  reset(): void {
    if (typeof window === 'undefined') return;
    posthog.reset();
  }
}
