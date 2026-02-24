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
  /** Layout: list (default) or grid */
  layout?: 'list' | 'grid';
}

function connectionStatusToMemberStatus(status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'): 'online' | 'offline' | 'connecting' {
  if (status === 'connected') return 'online';
  if (status === 'connecting') return 'connecting';
  return 'offline';
}

export function MemberList({ className, onRetryConnection, layout = 'list' }: MemberListProps) {
  const members = useStore((s) => s.currentRoom?.members);
  const connectionStatus = useStore((s) => s.status);

  const myInfo = useMemo(() => members?.find(m => m.isMe) || null, [members]);
  const otherMembers = useMemo(() => members?.filter(m => !m.isMe) || [], [members]);

  if (!myInfo) return null;

  const allMembers = [myInfo, ...otherMembers];
  const isGrid = layout === 'grid';

  if (isGrid) {
    return (
      <div className={cn('grid max-xs:grid-cols-1 grid-cols-2 gap-3', className)}>
        {allMembers.map((member) => (
          <div
            key={member.deviceId}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl',
              member.isMe
                ? 'glass border border-(--border-hard)'
                : 'glass border border-(--border-soft) hover:bg-(--surface-glass) transition-colors'
            )}
          >
            <MemberAvatar
              member={member}
              size="lg"
              statusOverride={member.isMe ? connectionStatusToMemberStatus(connectionStatus) : undefined}
            />
            <div className="w-full min-w-0 text-center">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <span className="font-medium text-(--text-primary) truncate text-sm">
                  {member.displayName}
                </span>
                {member.isMe && (
                  <span className="text-xs text-(--color-accent) bg-(--color-accent-subtle) px-1.5 py-0.5 rounded shrink-0">
                    You
                  </span>
                )}
              </div>
              <p className="text-xs text-(--text-muted) truncate mt-0.5">{member.deviceId}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                  (member.isMe ? connectionStatus : member.status) === 'online'
                    ? 'text-(--color-accent) bg-(--color-accent-subtle)'
                    : (member.isMe ? connectionStatus : member.status) === 'connecting'
                      ? 'text-yellow-400 bg-yellow-400/10'
                      : 'text-(--text-muted) bg-(--surface-glass)'
                )}
              >
                {member.isMe
                  ? (connectionStatus === 'connected' ? 'online' : connectionStatus === 'connecting' ? 'connecting' : 'offline')
                  : member.status}
              </span>
              {!member.isMe && member.status !== 'online' && onRetryConnection && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetryConnection(member.deviceId)}
                  className="p-1 h-auto text-(--text-muted) hover:text-(--color-accent-hover)"
                  title="Retry connection"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {otherMembers.length === 0 && (
          <p className="col-span-full text-sm text-(--text-muted) text-center py-4">
            Waiting for others to join...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Me first */}
      <div className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg glass border border-(--color-accent-border)">
        <MemberAvatar
          member={myInfo}
          size="md"
          statusOverride={connectionStatusToMemberStatus(connectionStatus)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-(--text-primary) truncate">
              {myInfo.displayName}
            </span>
            <span className="text-xs text-(--color-accent) bg-(--color-accent-subtle) px-1.5 py-0.5 rounded">
              You
            </span>
          </div>
          <p className="text-xs text-(--text-muted) truncate">{myInfo.deviceId}</p>
        </div>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0',
            connectionStatus === 'connected'
              ? 'text-(--color-accent) bg-(--color-accent-subtle)'
              : connectionStatus === 'connecting'
                ? 'text-yellow-400 bg-yellow-400/10'
                : 'text-(--text-muted) bg-(--surface-glass)'
          )}
        >
          {connectionStatus === 'connected' ? 'online' : connectionStatus === 'connecting' ? 'connecting' : 'offline'}
        </span>
      </div>

      {/* Other members */}
      {otherMembers.map((member) => (
        <div
          key={member.deviceId}
          className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg glass border border-(--border-soft) hover:bg-(--surface-glass) transition-colors"
        >
          <MemberAvatar member={member} size="md" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-(--text-primary) truncate block text-sm sm:text-base">
              {member.displayName}
            </span>
            <p className="text-xs text-(--text-muted) truncate">{member.deviceId}</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {member.status === 'online' && member.connectionPath && member.connectionPath !== 'unknown' && (
              member.connectionPath === 'direct'
                ? <Wifi className="w-3 h-3 text-(--color-accent)" aria-label="Direct peer-to-peer" role="img" />
                : <Globe className="w-3 h-3 text-(--color-warning)" aria-label="Via TURN relay" role="img" />
            )}
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                member.status === 'online'
                  ? 'text-(--color-accent) bg-(--color-accent-subtle)'
                  : member.status === 'connecting'
                    ? 'text-yellow-400 bg-yellow-400/10'
                    : 'text-(--text-muted) bg-(--surface-glass)'
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
                className="p-1 sm:p-1.5 h-auto text-(--text-muted) hover:text-(--color-accent-hover)"
                title="Retry connection"
              >
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {otherMembers.length === 0 && (
        <p className="text-sm text-(--text-muted) text-center py-4">
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
          className="rounded-full border border-(--border-soft) bg-(--bg-elevated) shadow-sm relative"
          style={{ zIndex: displayMembers.length - index }}
        />
      ))}
      {remaining > 0 && (
        <div
          className="relative w-8 h-8 rounded-full glass-strong flex items-center justify-center text-xs font-medium text-(--text-primary) border border-(--border-soft) shadow-sm"
          style={{ zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

