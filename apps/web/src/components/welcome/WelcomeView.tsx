import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Logo } from '@/components/ui';
import { WelcomeContent } from './WelcomeContent';
import { cn } from '@/lib/utils';
import { CreateRoomCta } from './CreateRoomCta';
import { ASSETS } from '@/lib/constants';

const primaryBtn =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-xl px-6 py-3 text-base bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-400 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] shadow-lg shadow-teal-500/25';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-xl px-6 py-3 text-base glass-strong text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-soft)] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]';
const openAppBtn =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-xl px-4 py-2.5 text-sm bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25 hover:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]';

export function WelcomeView() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header: Logo + Open App CTA */}
      <header className="sticky top-0 z-20 border-b border-[var(--border-soft)] glass-strong">
        <nav
          className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] rounded-lg"
            aria-label="CoralSend Home"
          >
            <Logo size="sm" className="pointer-events-none" />
          </Link>
          <Link href="/app" className={cn(openAppBtn)}>
            <Sparkles className="w-4 h-4" aria-hidden />
            Open App
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </nav>
      </header>

      <article className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero */}
        <section className="text-center mb-16 sm:mb-20" aria-labelledby="hero-title">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[var(--border-soft)] text-xs font-medium text-[var(--text-muted)] mb-8">
            P2P · No account · Encrypted
          </div>
          <div className="flex justify-center mb-8">
            <Image
              src={ASSETS.logo}
              alt="CoralSend"
              width={96}
              height={96}
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
          <h1
            id="hero-title"
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-3 sm:mb-4 tracking-tight"
          >
            Send files directly.
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              No cloud, no account.
            </span>
          </h1>
          <p className="text-[var(--text-muted)] text-base sm:text-lg leading-relaxed max-w-md mx-auto mb-10">
            Create a room, share the link, and send files straight to the other device. Everything stays between you and
            the receiver—encrypted and private.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <CreateRoomCta className={cn(primaryBtn)} />
            <Link href="/guide" className={cn(secondaryBtn)}>
              Getting started
            </Link>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Already have a room?{' '}
            <Link
              href="/app"
              className="font-medium text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-2"
            >
              Open App
            </Link>
          </p>
        </section>

        {/* Features + How it works + Footer */}
        <WelcomeContent />
      </article>
    </div>
  );
}
