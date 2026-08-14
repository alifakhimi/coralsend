'use client';

import posthog from 'posthog-js';
import type { AnalyticsAdapter } from './types';
import { hasAnalyticsConsent, storeAnalyticsConsent } from './consent';

const ALLOWED_PROPERTIES: Record<string, ReadonlySet<string>> = {
  transfer_attempt: new Set(['direction', 'size_bucket']),
  transfer_completed: new Set(['direction', 'size_bucket', 'duration_bucket']),
  transfer_failed: new Set(['direction', 'size_bucket', 'duration_bucket', 'failure_category']),
};

export class PostHogAdapter implements AnalyticsAdapter {
  private initialized = false;
  private consentGranted = false;

  init(): void {
    this.consentGranted = hasAnalyticsConsent();
    if (this.consentGranted) this.enable();
  }

  private enable(): void {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (!key || this.initialized || typeof window === 'undefined') return;
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: 'never',
      persistence: 'memory',
    });
    this.initialized = true;
  }

  setConsent(granted: boolean): void {
    storeAnalyticsConsent(granted);
    this.consentGranted = granted;
    if (granted && this.initialized) posthog.opt_in_capturing();
    else if (granted) this.enable();
    else if (this.initialized) posthog.opt_out_capturing();
  }

  // PostHog distinct IDs remain pseudonymous technical identifiers only.
  // Application/device identifiers and person properties must never be joined to them.
  identify(_userId?: string, _properties?: Record<string, unknown>): void {}

  track(event: string, properties?: Record<string, unknown>): void {
    const allowedKeys = ALLOWED_PROPERTIES[event];
    if (!this.initialized || !this.consentGranted || !allowedKeys) return;
    const safeProperties = Object.fromEntries(
      Object.entries(properties ?? {}).filter(([key]) => allowedKeys.has(key)),
    );
    posthog.capture(event, safeProperties);
  }

  pageView(): void {}

  reset(): void {
    if (this.initialized) posthog.reset();
  }
}
