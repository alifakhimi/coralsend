import type { AnalyticsAdapter } from './types';
import { PostHogAdapter } from './posthog';
import { Ga4Adapter } from './ga4';
import { NoopAdapter } from './noop';

const hasPostHog =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '').length > 0;

const hasGa4 = typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ?? '').length > 0;

const adapter: AnalyticsAdapter = hasGa4 ? new Ga4Adapter() : hasPostHog ? new PostHogAdapter() : new NoopAdapter();

export const analytics: AnalyticsAdapter = adapter;
export type { AnalyticsAdapter } from './types';
