export const ANALYTICS_CONSENT_KEY = 'coralsend_analytics_consent';

export function hasAnalyticsConsent(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'granted';
}

export function storeAnalyticsConsent(granted: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? 'granted' : 'denied');
  }
}
