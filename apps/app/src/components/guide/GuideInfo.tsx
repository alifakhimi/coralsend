'use client';

import { Shield, Smartphone, Share2, UserX, Zap } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'P2P transfer',
    description: 'Files go directly between devices. No server storage.',
  },
  {
    icon: Shield,
    title: 'Encrypted in transit',
    description: 'WebRTC uses DTLS so data is protected while moving.',
  },
  {
    icon: Smartphone,
    title: 'PWA',
    description: 'Install on your phone or desktop and use like an app.',
  },
  {
    icon: Share2,
    title: 'Share target',
    description: 'Share files from other apps straight into CoralSend.',
  },
  {
    icon: UserX,
    title: 'No sign-up',
    description: 'Create a room and share the link. No account needed.',
  },
];

export function GuideInfo() {
  return (
    <div className="mt-12 pt-8 border-t border-[var(--border-soft)] space-y-10">
      <section id="features">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Features</h3>
        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] flex items-center justify-center">
                <Icon className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">{title}</p>
                <p className="text-[var(--text-muted)] text-xs">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="concept">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How it works</h3>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed">
          CoralSend uses a signaling server only to help your browser connect to the other person&apos;s browser. Room IDs and connection metadata pass through the server; file bytes never do. Once the WebRTC data channel is open, files are sent directly between devices and are encrypted in transit (DTLS).
        </p>
      </section>
    </div>
  );
}
