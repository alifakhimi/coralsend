'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analytics } from '@/lib/analytics';

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!analytics.hasConsentChoice()), []);
  if (!visible) return null;
  const choose = (granted: boolean) => { analytics.setConsent(granted); setVisible(false); };
  return (
    <aside aria-label="Analytics preference" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl">
      <p className="text-sm text-[var(--text-primary)]">Help improve CoralSend with privacy-safe usage analytics. We never include file names, room codes, contact details, or device identifiers. <Link className="underline" href="/privacy">Privacy details</Link></p>
      <div className="mt-3 flex justify-end gap-2">
        <button className="rounded-lg px-4 py-2 text-sm text-[var(--text-primary)]" onClick={() => choose(false)}>Decline</button>
        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" onClick={() => choose(true)}>Allow analytics</button>
      </div>
    </aside>
  );
}
