'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SOCIAL_LINKS, APP_VERSION } from '@/lib/constants';
import { ArrowLeft } from 'lucide-react';

export default function ChangelogPage() {
  const router = useRouter();
  const githubUrl = SOCIAL_LINKS.github;
  const releasesUrl = githubUrl ? `${githubUrl.replace(/\/*$/, '')}/releases` : '';

  return (
    <main className="page-shell">
      <div className="page-glow" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--color-accent-hover)] text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Changelog</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          Release history and updates. Current version: v{APP_VERSION}
        </p>
        {releasesUrl ? (
          <>
            <p className="text-[var(--text-primary)] text-sm leading-relaxed">
              Full release notes and version history are available on GitHub.
            </p>
            <Link
              href={releasesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-sm font-medium transition-colors"
            >
              View releases on GitHub →
            </Link>
          </>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">GitHub URL is not configured.</p>
        )}
      </div>
    </main>
  );
}
