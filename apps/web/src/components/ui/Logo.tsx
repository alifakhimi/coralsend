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
    sm: { icon: 32, text: 'text-xl' },
    md: { icon: 48, text: 'text-3xl' },
    lg: { icon: 64, text: 'text-5xl' },
  };

  const { icon, text } = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="relative shrink-0"
        style={{ width: icon, height: icon }}
      >
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
            'font-bold tracking-tight bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent'
          )}
        >
          CoralSend
        </span>
      )}
    </div>
  );
}

