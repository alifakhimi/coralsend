import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceptable Use - CoralSend',
  description: 'Rules for responsible use of CoralSend services.',
  alternates: {
    canonical: '/acceptable-use',
  },
};

export default function AcceptableUsePage() {
  return (
    <main className="page-shell overflow-auto">
      <div className="page-glow" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Acceptable Use Policy</h1>
        <p className="text-[var(--text-muted)] text-sm">Last updated: 2026-02-20</p>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Prohibited activity</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Illegal content distribution or unlawful behavior.</li>
            <li>Malware delivery, phishing, fraud, or credential theft.</li>
            <li>DoS attacks, spam, bot abuse, or traffic amplification attempts.</li>
            <li>Attempts to bypass security controls or service limits.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Enforcement</h2>
          <p>
            Violations may result in temporary or permanent restriction of service access, including traffic blocking
            and account-level enforcement if accounts are introduced.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Reporting abuse</h2>
          <p>
            Report abuse through project channels with enough context to investigate (timestamps, room ID context,
            and source information if available).
          </p>
        </section>
      </div>
    </main>
  );
}
