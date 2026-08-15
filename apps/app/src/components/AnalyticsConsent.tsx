'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_CONSENT_KEY } from '@/lib/analytics/consent';
export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
  useEffect(() => { if (configured && localStorage.getItem(ANALYTICS_CONSENT_KEY) === null) setVisible(true); }, [configured]);
  if (!visible) return null;
  const choose = (granted: boolean) => { analytics.setConsent(granted); setVisible(false); };
  return <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border border-white/15 bg-slate-950 p-4 text-sm text-slate-100 shadow-2xl" aria-label="Analytics consent">
    <p>May we collect anonymous, aggregate transfer reliability metrics? We do not send file names, room or transfer IDs, contact details, device identifiers, or session content. See our <Link className="underline" href="/privacy">privacy policy</Link>.</p>
    <div className="mt-3 flex justify-end gap-3"><button className="rounded-lg border border-white/25 px-4 py-2" onClick={() => choose(false)}>Decline</button><button className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950" onClick={() => choose(true)}>Allow analytics</button></div>
  </aside>;
}
