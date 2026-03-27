import type { AnalyticsAdapter } from './types';
import { PostHogAdapter } from './posthog';
import { NoopAdapter } from './noop';

const hasPostHog =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '').length > 0;

const adapter: AnalyticsAdapter = hasPostHog ? new PostHogAdapter() : new NoopAdapter();

export const analytics: AnalyticsAdapter = adapter;
export type { AnalyticsAdapter } from './types';
