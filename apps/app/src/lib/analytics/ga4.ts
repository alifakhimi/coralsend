'use client';

import type { AnalyticsAdapter } from './types';

const CONSENT_KEY = 'coralsend_analytics_consent';
const SCRIPT_ID = 'coralsend-ga4';
const ALLOWED_EVENTS = new Set(['room_created', 'room_joined', 'file_shared', 'file_downloaded']);
type Gtag = (command: 'config' | 'event', target: string, params?: Record<string, unknown>) => void;

declare global { interface Window { dataLayer?: unknown[]; gtag?: Gtag; } }

function safePagePath(url?: string): string {
  const pathname = url ? new URL(url, window.location.origin).pathname : window.location.pathname;
  return pathname.replace(/\/room\/[^/]+/g, '/room/:id');
}
function fileCategory(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const category = value.split('/', 1)[0].toLowerCase();
  return ['audio', 'image', 'text', 'video', 'application'].includes(category) ? category : 'other';
}
function sizeBucket(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  if (value < 1_000_000) return 'under_1mb';
  if (value < 10_000_000) return '1mb_to_10mb';
  if (value < 100_000_000) return '10mb_to_100mb';
  return '100mb_or_more';
}

export class GA4Adapter implements AnalyticsAdapter {
  private initialized = false;
  init(): void {
    if (typeof window === 'undefined' || localStorage.getItem(CONSENT_KEY) !== 'granted') return;
    this.load();
  }
  setConsent(granted: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    if (granted) this.load();
  }
  hasConsentChoice(): boolean {
    return typeof window === 'undefined' || localStorage.getItem(CONSENT_KEY) !== null;
  }
  identify(): void {}
  track(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized || !window.gtag || !ALLOWED_EVENTS.has(event)) return;
    const params: Record<string, unknown> = {};
    const category = fileCategory(properties?.fileType);
    const bucket = sizeBucket(properties?.fileSize);
    if (category) params.file_category = category;
    if (bucket) params.file_size_bucket = bucket;
    window.gtag('event', event, params);
  }
  pageView(url?: string): void {
    if (!this.initialized || !window.gtag) return;
    window.gtag('event', 'page_view', { page_path: safePagePath(url) });
  }
  reset(): void {}
  private load(): void {
    if (this.initialized) return;
    const id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
    if (!id || !/^G-[A-Z0-9]+$/.test(id)) return;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = ((...args: unknown[]) => window.dataLayer?.push(args)) as Gtag;
    window.gtag('config', id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false, page_path: safePagePath() });
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID; script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
    }
    this.initialized = true;
    this.pageView();
  }
}
