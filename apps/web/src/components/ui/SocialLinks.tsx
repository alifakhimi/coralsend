'use client';

import Link from 'next/link';
import { SOCIAL_LINKS } from '@/lib/constants';
import { Github, Twitter, Linkedin, Instagram, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<keyof typeof SOCIAL_LINKS, React.ComponentType<{ className?: string; size?: number }>> = {
  github: Github,
  twitter: Twitter,
  telegram: Send,
  instagram: Instagram,
  linkedin: Linkedin,
};

const LABELS: Record<keyof typeof SOCIAL_LINKS, string> = {
  github: 'GitHub',
  twitter: 'Twitter',
  telegram: 'Telegram',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

interface SocialLinksProps {
  className?: string;
  iconSize?: number;
}

export function SocialLinks({ className, iconSize = 20 }: SocialLinksProps) {
  const entries = (Object.entries(SOCIAL_LINKS) as [keyof typeof SOCIAL_LINKS, string][]).filter(
    ([, url]) => url && url.length > 0
  );
  if (entries.length === 0) return null;

  return (
    <nav aria-label="Social links" className={cn('flex items-center gap-3', className)}>
      {entries.map(([key, url]) => {
        const Icon = ICONS[key];
        return (
          <Link
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-muted)] hover:text-[var(--color-accent-hover)] transition-colors"
            aria-label={LABELS[key]}
          >
            <Icon size={iconSize} className="shrink-0" />
          </Link>
        );
      })}
    </nav>
  );
}
