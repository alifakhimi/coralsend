'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ActionCardBaseProps {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: 'highlight' | 'default';
  className?: string;
}

interface ActionCardAsButton extends ActionCardBaseProps {
  href?: never;
  onClick: () => void;
}

interface ActionCardAsLink extends ActionCardBaseProps {
  href: string;
  onClick?: never;
}

type ActionCardProps = ActionCardAsButton | ActionCardAsLink;

export function ActionCard({
  icon,
  title,
  description,
  variant = 'default',
  className,
  ...rest
}: ActionCardProps) {
  const isLink = 'href' in rest && rest.href;

  const Icon = icon;

  const content = (
    <div className="flex items-center gap-3 sm:gap-4">
      <div
        className={cn(
          'w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform',
          variant === 'highlight'
            ? 'bg-[var(--color-accent)] shadow-lg shadow-[var(--color-accent-border)] text-white'
            : 'bg-[var(--surface-glass-strong)] text-[var(--color-accent)]'
        )}
      >
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <div className="text-left">
        <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="text-[var(--text-muted)] text-xs sm:text-sm">{description}</p>
      </div>
    </div>
  );

  const baseClasses = cn(
    'w-full group block rounded-xl sm:rounded-2xl p-4 sm:p-5 transition-all',
    variant === 'highlight'
      ? 'bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)] hover:brightness-110'
      : 'glass border border-[var(--border-soft)] hover:border-[var(--color-accent-border)]',
    className
  );

  if (isLink) {
    return (
      <Link href={rest.href} className={cn(baseClasses, 'cursor-pointer')}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={rest.onClick}
      className={cn(baseClasses, 'cursor-pointer text-left')}
    >
      {content}
    </button>
  );
}
