'use client';
import type { AnalyticsAdapter } from './types';
export const CONSENT_KEY = 'coralsend_analytics_consent';
const ALLOWED_EVENTS = new Set(['file_shared', 'file_downloaded']);
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; } }
function safePagePath(pathname: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') ?? '';
  const path = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname;
  if (path.startsWith('/room/')) return '/room/:id';
  if (path.startsWith('/app/join')) return '/app/join';
  return new Set(['/', '/app', '/guide', '/privacy', '/terms', '/acceptable-use', '/changelog']).has(path) ? path : '/other';
}
export class Ga4Adapter implements AnalyticsAdapter {
  private initialized = false;
  init(): void { if (typeof window !== 'undefined' && localStorage.getItem(CONSENT_KEY) === 'granted') this.enable(); }
  setConsent(granted: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    if (granted) this.enable();
  }
  private enable(): void {
    const id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
    if (!id || this.initialized || typeof document === 'undefined' || !/^G-[A-Z0-9]+$/.test(id)) return;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, anonymize_ip: true });
    const script = document.createElement('script');
    script.id = 'coralsend-ga4'; script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script); this.initialized = true; this.pageView();
  }
  identify(): void {}
  track(event: string): void { if (this.initialized && ALLOWED_EVENTS.has(event)) window.gtag?.('event', event); }
  pageView(): void { if (this.initialized) window.gtag?.('event', 'page_view', { page_path: safePagePath(location.pathname) }); }
  reset(): void {}
}
