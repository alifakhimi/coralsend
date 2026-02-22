import Link from 'next/link';
import Image from 'next/image';
import { Shield, Smartphone, Share2, UserX, Zap, Lock, Wifi, FileCheck, ArrowRight } from 'lucide-react';
import { SocialLinks } from '@/components/ui';
import { APP_VERSION } from '@/lib/constants';
import { ASSETS } from '@/lib/constants';

const FEATURES = [
  {
    icon: Zap,
    title: 'Peer-to-peer transfer',
    description:
      'Files travel directly between your device and the receiver. No server storage, no cloud—just a secure channel between two browsers.',
  },
  {
    icon: Shield,
    title: 'Encrypted in transit',
    description:
      'WebRTC uses DTLS to encrypt all data. File bytes are protected from the moment they leave your device until they reach the other side.',
  },
  {
    icon: Smartphone,
    title: 'Progressive Web App',
    description:
      'Install CoralSend on your phone or desktop. It works like a native app—offline-capable, fast, and always up to date.',
  },
  {
    icon: Share2,
    title: 'Share target',
    description:
      'Share files from Photos, Files, or any app directly into CoralSend. One tap to send—no copy-paste or email needed.',
  },
  {
    icon: UserX,
    title: 'No sign-up required',
    description:
      'Create a room, share the link, and start sending. No account, no password, no email. Privacy by design.',
  },
];

export function WelcomeContent() {
  return (
    <div className="space-y-20 sm:space-y-24">
      {/* Features */}
      <section id="features" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-2xl font-bold text-[var(--text-primary)] mb-8 sm:mb-10">
          Why CoralSend?
        </h2>
        <ul className="space-y-6 sm:space-y-8">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-4 sm:gap-5">
              <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-teal-400" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-base sm:text-lg mb-1">{title}</h3>
                <p className="text-[var(--text-muted)] text-sm sm:text-base leading-relaxed">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-2xl font-bold text-[var(--text-primary)] mb-6 sm:mb-8">
          How it works
        </h2>
        <div className="glass rounded-2xl border border-[var(--border-soft)] p-6 sm:p-8">
          <p className="text-[var(--text-muted)] text-sm sm:text-base leading-relaxed mb-6">
            CoralSend uses a signaling server only to help your browser connect to the other person&apos;s browser.
            Room IDs and connection metadata pass through the server; <strong className="text-[var(--text-primary)]">file
            bytes never do</strong>. Once the WebRTC data channel is open, files are sent directly between devices and
            are encrypted in transit (DTLS).
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
              <Lock className="w-4 h-4 text-teal-400" aria-hidden />
              End-to-end encrypted
            </span>
            <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
              <Wifi className="w-4 h-4 text-teal-400" aria-hidden />
              Direct P2P when possible
            </span>
            <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
              <FileCheck className="w-4 h-4 text-teal-400" aria-hidden />
              No server storage
            </span>
          </div>
        </div>
      </section>

      {/* App preview / CTA */}
      <section
        className="rounded-2xl border border-[var(--border-soft)] overflow-hidden glass"
        aria-labelledby="cta-heading"
      >
        <div className="p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src={ASSETS.logo}
              alt=""
              width={64}
              height={64}
              className="object-contain opacity-90"
              aria-hidden
            />
          </div>
          <h2 id="cta-heading" className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Ready to send?
          </h2>
          <p className="text-[var(--text-muted)] text-sm sm:text-base mb-6 max-w-md mx-auto">
            Open the app to create a room, join with a link, or scan a QR code.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-xl px-6 py-3 text-base bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 hover:border-teal-500/50 transition-colors"
          >
            Open App
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-6 pt-8 border-t border-[var(--border-soft)]">
        <p className="text-[var(--text-muted)] text-xs">v{APP_VERSION}</p>
        <SocialLinks iconSize={20} />
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm" aria-label="Legal and info">
          <Link href="/privacy" className="text-[var(--text-muted)] hover:text-teal-400 transition-colors">
            Privacy
          </Link>
          <span className="text-[var(--text-muted)]" aria-hidden>·</span>
          <Link href="/terms" className="text-[var(--text-muted)] hover:text-teal-400 transition-colors">
            Terms
          </Link>
          <span className="text-[var(--text-muted)]" aria-hidden>·</span>
          <Link href="/acceptable-use" className="text-[var(--text-muted)] hover:text-teal-400 transition-colors">
            Acceptable use
          </Link>
        </nav>
        <Link href="/changelog" className="text-[var(--text-muted)] hover:text-teal-400 text-sm transition-colors">
          Changelog
        </Link>
      </footer>
    </div>
  );
}
