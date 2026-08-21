export interface AnalyticsAdapter {
  init(): void;
  setConsent(granted: boolean): void;
  identify(userId: string, properties?: Record<string, unknown>): void;
  track(event: string, properties?: Record<string, unknown>): void;
  pageView(url?: string): void;
  reset(): void;
}
