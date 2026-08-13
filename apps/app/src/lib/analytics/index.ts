import type { AnalyticsAdapter } from './types';
import { GA4Adapter } from './ga4';
import { PostHogAdapter } from './posthog';
import { NoopAdapter } from './noop';

const hasPostHog =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '').length > 0;

const hasGA4 =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ?? '').length > 0;

const adapter: AnalyticsAdapter = hasGA4
  ? new GA4Adapter()
  : hasPostHog
    ? new PostHogAdapter()
    : new NoopAdapter();

export const analytics: AnalyticsAdapter = adapter;
export type { AnalyticsAdapter } from './types';
