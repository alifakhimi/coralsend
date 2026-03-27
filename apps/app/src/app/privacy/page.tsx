import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - CoralSend',
  description: 'How CoralSend handles data, metadata, and optional analytics.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main className="page-shell overflow-auto">
      <div className="page-glow" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Privacy Policy</h1>
        <p className="text-[var(--text-muted)] text-sm">
          Last updated: 2026-02-20
        </p>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">What CoralSend does</h2>
          <p>
            CoralSend is a peer-to-peer file transfer app. File bytes are sent directly between devices over WebRTC.
            The signaling server helps peers connect and does not store file payload bytes.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Data we process</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Room and connection metadata required to establish peer sessions.</li>
            <li>Device identifier stored in browser local storage for session continuity.</li>
            <li>Optional analytics events if PostHog is configured by the operator.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Data we do not store</h2>
          <p>
            CoralSend does not intentionally store file payload bytes on the signaling server.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Retention</h2>
          <p>
            Runtime metadata is designed to be ephemeral. Any server logs and analytics retention depend on operator
            configuration and should be reviewed by the deployer.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Security notes</h2>
          <p>
            Transport is encrypted in transit via WebRTC DTLS. Application-layer end-to-end encryption with
            user-held keys is planned and not fully implemented in this MVP.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[var(--text-primary)]">
          <h2 className="font-semibold">Contact</h2>
          <p>
            For privacy-related questions, contact the project owner through the repository contact channels.
          </p>
        </section>
      </div>
    </main>
  );
}
