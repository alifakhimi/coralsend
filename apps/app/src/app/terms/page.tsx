import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - CoralSend',
  description: 'Terms for using CoralSend and related hosted services.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <main className="page-shell overflow-auto">
      <div className="page-glow" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Terms of Service</h1>
        <p className="text-[var(--text-muted)] text-sm">Last updated: 2026-02-20</p>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Acceptance</h2>
          <p>
            By using CoralSend, you agree to these terms. If you do not agree, do not use the service.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Service scope</h2>
          <p>
            CoralSend provides peer-to-peer transfer tooling. Availability, uptime, and feature set may change during
            MVP.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">User responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the service lawfully and responsibly.</li>
            <li>Do not attempt abuse, denial-of-service, or unauthorized access.</li>
            <li>Protect room links and access credentials under your control.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Intellectual property</h2>
          <p>
            Open source code rights are governed by repository licenses. Brand usage is governed separately under the
            trademark policy.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Disclaimer</h2>
          <p>
            The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind to
            the maximum extent allowed by law.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the project owner is not liable for indirect or consequential
            damages arising from use of the service.
          </p>
        </section>
      </div>
    </main>
  );
}
