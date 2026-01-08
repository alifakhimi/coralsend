'use client';

import { cn } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/deviceId';
import type { Member } from '@/store/store';

interface MemberAvatarProps {
  member: Member;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  className?: string;
}

export function MemberAvatar({ member, size = 'md', showStatus = true, className }: MemberAvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  const statusColors = {
    online: 'bg-teal-500',
    offline: 'bg-slate-500',
    connecting: 'bg-yellow-500',
  };

  const initials = getInitials(member.deviceId);
  const bgColor = getAvatarColor(member.deviceId);

  return (
    <div className={cn('relative inline-flex', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold text-white',
          sizes[size],
          member.isMe && 'ring-2 ring-teal-400'
        )}
        style={{ backgroundColor: bgColor }}
        title={member.displayName}
      >
        {initials}
      </div>
      
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900',
            statusColors[member.status]
          )}
        />
      )}
    </div>
  );
}

