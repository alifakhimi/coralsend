'use client';

import { cn } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/deviceId';
import type { Member } from '@/store/store';

interface MemberAvatarProps {
  member: Member;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  /** Override status (e.g. for "me" use store connection status) */
  statusOverride?: Member['status'];
  className?: string;
  style?: React.CSSProperties;
}

export function MemberAvatar({ member, size = 'md', showStatus = true, statusOverride, className, style }: MemberAvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  const statusColors = {
    online: 'bg-[var(--color-accent)]',
    offline: 'bg-[var(--text-muted)]',
    connecting: 'bg-yellow-500',
  };

  const initials = getInitials(member.deviceId);
  const bgColor = getAvatarColor(member.deviceId);
  const status = statusOverride ?? member.status;

  return (
    <div className={cn('relative inline-flex', className)} style={style}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold text-white',
          sizes[size],
          member.isMe && showStatus && 'ring-2 ring-[var(--color-accent)]'
        )}
        style={{ backgroundColor: bgColor }}
        title={`${member.displayName} (${status})`}
      >
        {initials}
      </div>
      
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-[var(--bg-elevated)]',
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}

