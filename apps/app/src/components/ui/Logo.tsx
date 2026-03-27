'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ASSETS } from '@/lib/constants';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const sizeMap = {
    sm: { icon: 32, text: 'text-xl', iconClass: 'w-8 h-8' },
    md: { icon: 48, text: 'text-3xl', iconClass: 'w-12 h-12' },
    lg: { icon: 64, text: 'text-5xl', iconClass: 'w-16 h-16' },
  };

  const { icon, text, iconClass } = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('relative shrink-0', iconClass)}>
        <Image
          src={ASSETS.logo}
          alt="CoralSend"
          width={icon}
          height={icon}
          className="object-contain"
          priority
        />
      </div>

      {showText && (
        <span
          className={cn(
            text,
            'font-bold tracking-tight gradient-text'
          )}
        >
          CoralSend
        </span>
      )}
    </div>
  );
}

