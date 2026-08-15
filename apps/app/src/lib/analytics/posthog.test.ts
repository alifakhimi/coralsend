import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), identify: vi.fn(), opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(), reset: vi.fn(), people: { set: vi.fn() },
}));
const consent = vi.hoisted(() => ({ granted: false, store: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthog }));
vi.mock('./consent', () => ({
  hasAnalyticsConsent: () => consent.granted,
  storeAnalyticsConsent: consent.store,
}));
import { PostHogAdapter } from './posthog';

describe('PostHogAdapter privacy controls', () => {
  beforeEach(() => {
    vi.clearAllMocks(); consent.granted = false; vi.stubGlobal('window', {});
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'ph_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://analytics.example.test');
  });

  it('does nothing before consent or after decline', () => {
    const adapter = new PostHogAdapter(); adapter.init();
    adapter.identify('device-id', { email: 'private@example.test' });
    adapter.track('transfer_completed', { direction: 'send', roomId: 'secret-room' });
    adapter.setConsent(false); adapter.track('transfer_completed', { direction: 'send' });
    expect(posthog.init).not.toHaveBeenCalled(); expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled(); expect(posthog.people.set).not.toHaveBeenCalled();
    expect(consent.store).toHaveBeenCalledWith(false);
  });

  it('initializes with privacy-safe collection settings only after consent', () => {
    const adapter = new PostHogAdapter(); adapter.setConsent(true);
    expect(posthog.init).toHaveBeenCalledWith('ph_test', expect.objectContaining({
      autocapture: false, capture_pageview: false, capture_pageleave: false,
      disable_session_recording: true, person_profiles: 'never', persistence: 'memory',
    }));
  });

  it('allow-lists payloads after consent and stops immediately on decline', () => {
    const adapter = new PostHogAdapter(); adapter.setConsent(true);
    adapter.track('room_joined', { roomId: 'secret-room' });
    adapter.track('transfer_failed', {
      direction: 'receive', size_bucket: '1-10mb', duration_bucket: '10-30s',
      failure_category: 'network', roomId: 'secret-room', transferId: 'secret-transfer',
      fileName: 'private.pdf', email: 'private@example.test', freeText: 'private note',
    });
    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith('transfer_failed', {
      direction: 'receive', size_bucket: '1-10mb', duration_bucket: '10-30s', failure_category: 'network',
    });
    adapter.setConsent(false); adapter.track('transfer_failed', { direction: 'receive' });
    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce();
    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it('opts an initialized client back in only after renewed consent', () => {
    const adapter = new PostHogAdapter(); adapter.setConsent(true); adapter.setConsent(false); adapter.setConsent(true);
    expect(posthog.init).toHaveBeenCalledOnce(); expect(posthog.opt_out_capturing).toHaveBeenCalledOnce();
    expect(posthog.opt_in_capturing).toHaveBeenCalledOnce();
  });
});
