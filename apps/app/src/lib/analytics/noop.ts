import type { AnalyticsAdapter } from './types';

export class NoopAdapter implements AnalyticsAdapter {
  init(): void {}
  setConsent(): void {}
  hasConsentChoice(): boolean { return true; }
  identify(): void {}
  track(): void {}
  pageView(): void {}
  reset(): void {}
}
