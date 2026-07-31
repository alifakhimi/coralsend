import type { AnalyticsAdapter } from './types';

export class NoopAdapter implements AnalyticsAdapter {
  init(): void {}
  identify(): void {}
  track(): void {}
  pageView(): void {}
  reset(): void {}
}
