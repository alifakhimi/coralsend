'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MemberAvatar } from './MemberAvatar';
import { useStore } from '@/store/store';
import { RefreshCw, Wifi, Globe } from 'lucide-react';
import { Button } from './Button';

interface MemberListProps {
  className?: string;
  onRetryConnection?: (deviceId: string) => void;
}

function connectionStatusToMemberStatus(status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'): 'online' | 'offline' | 'connecting' {
  if (status === 'connected') return 'online';
  if (status === 'connecting') return 'connecting';
  return 'offline';
}

export function MemberList({ className, onRetryConnection }: MemberListProps) {
  const members = useStore((s) => s.currentRoom?.members);
  const connectionStatus = useStore((s) => s.status);

  const myInfo = useMemo(() => members?.find(m => m.isMe) || null, [members]);
  const otherMembers = useMemo(() => members?.filter(m => !m.isMe) || [], [members]);

  if (!myInfo) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Me first */}
      <div className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg glass border border-[var(--border-soft)]">
        <MemberAvatar
          member={myInfo}
          size="md"
          statusOverride={connectionStatusToMemberStatus(connectionStatus)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)] truncate">
              {myInfo.displayName}
            </span>
            <span className="text-xs text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded">
              You
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] truncate">{myInfo.deviceId}</p>
        </div>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0',
            connectionStatus === 'connected'
              ? 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
              : connectionStatus === 'connecting'
                ? 'text-yellow-400 bg-yellow-400/10'
                : 'text-[var(--text-muted)] bg-[var(--surface-glass)]'
          )}
        >
          {connectionStatus === 'connected' ? 'online' : connectionStatus === 'connecting' ? 'connecting' : 'offline'}
        </span>
      </div>

      {/* Other members */}
      {otherMembers.map((member) => (
        <div
          key={member.deviceId}
          className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-[var(--surface-glass)] transition-colors"
        >
          <MemberAvatar member={member} size="md" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-[var(--text-primary)] truncate block text-sm sm:text-base">
              {member.displayName}
            </span>
            <p className="text-xs text-[var(--text-muted)] truncate">{member.deviceId}</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {member.status === 'online' && member.connectionPath && member.connectionPath !== 'unknown' && (
              member.connectionPath === 'direct'
                ? <Wifi className="w-3 h-3 text-[var(--color-accent)]" aria-label="Direct peer-to-peer" role="img" />
                : <Globe className="w-3 h-3 text-[var(--color-warning)]" aria-label="Via TURN relay" role="img" />
            )}
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                member.status === 'online'
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                  : member.status === 'connecting'
                    ? 'text-yellow-400 bg-yellow-400/10'
                    : 'text-[var(--text-muted)] bg-[var(--surface-glass)]'
              )}
            >
              {member.status}
            </span>
            {/* Retry button for offline/connecting members */}
            {member.status !== 'online' && onRetryConnection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetryConnection(member.deviceId)}
                className="p-1 sm:p-1.5 h-auto text-[var(--text-muted)] hover:text-[var(--color-accent-hover)]"
                title="Retry connection"
              >
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {otherMembers.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          Waiting for others to join...
        </p>
      )}
    </div>
  );
}

export function MemberAvatarStack({ className, size = 'sm' }: { className?: string, size?: 'sm' | 'md' | 'lg' }) {
  const members = useStore((s) => s.currentRoom?.members);
  const connectionStatus = useStore((s) => s.status);
  const displayMembers = useMemo(() => members?.slice(0, 4) || [], [members]);
  const remaining = (members?.length || 0) - 4;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayMembers.map((member, index) => (
        <MemberAvatar
          key={member.deviceId}
          member={member}
          size={size}
          showStatus
          statusOverride={member.isMe ? connectionStatusToMemberStatus(connectionStatus) : undefined}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-elevated)] shadow-sm relative"
          style={{ zIndex: displayMembers.length - index }}
        />
      ))}
      {remaining > 0 && (
        <div
          className="relative w-8 h-8 rounded-full glass-strong flex items-center justify-center text-xs font-medium text-[var(--text-primary)] border border-[var(--border-soft)] shadow-sm"
          style={{ zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

