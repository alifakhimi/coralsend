'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MemberAvatar } from './MemberAvatar';
import { useStore } from '@/store/store';
import { RefreshCw, Wifi, Globe, Loader2, Clock3, CheckCircle2, XCircle, UserMinus } from 'lucide-react';
import { Button } from './Button';

interface MemberListProps {
  className?: string;
  onRetryConnection?: (deviceId: string) => void;
  onRemoveMember?: (deviceId: string) => void;
  onApproveJoinRequest?: (deviceId: string) => void;
  onRejectJoinRequest?: (deviceId: string) => void;
  /** Layout: list (default) or grid */
  layout?: 'list' | 'grid';
}

function connectionStatusToMemberStatus(status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'): 'online' | 'offline' | 'connecting' {
  if (status === 'connected') return 'online';
  if (status === 'connecting') return 'connecting';
  return 'offline';
}

export function MemberList({
  className,
  onRetryConnection,
  onRemoveMember,
  onApproveJoinRequest,
  onRejectJoinRequest,
  layout = 'list',
}: MemberListProps) {
  const members = useStore((s) => s.currentRoom?.members);
  const connectionStatus = useStore((s) => s.status);
  const roomSettings = useStore((s) => s.currentRoom?.settings);
  const hostDeviceId = useStore((s) => s.currentRoom?.hostDeviceId);
  const deviceId = useStore((s) => s.deviceId);
  const pendingJoinRequests = useStore((s) => s.currentRoom?.pendingJoinRequests ?? []);
  const error = useStore((s) => s.error);

  const myInfo = useMemo(() => members?.find(m => m.isMe) || null, [members]);
  const otherMembers = useMemo(() => members?.filter(m => !m.isMe) || [], [members]);
  const isHost = Boolean(hostDeviceId && hostDeviceId === deviceId);
  const canApproveOrRemove = roomSettings?.hostManagement && isHost;
  const awaitingApproval = roomSettings?.requireApproval && roomSettings?.hostManagement && error === 'Waiting for approval from a room member';

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
                {hostDeviceId && member.deviceId === hostDeviceId && (
                  <span className="text-xs text-(--text-muted) bg-(--surface-glass-strong) px-1.5 py-0.5 rounded shrink-0">
                    Host
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
              {!member.isMe && onRemoveMember && canApproveOrRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveMember(member.deviceId)}
                  className="p-1 h-auto text-(--text-muted) hover:text-(--color-error)"
                  title="Remove member"
                >
                  <UserMinus className="w-3 h-3" />
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
            {hostDeviceId && myInfo.deviceId === hostDeviceId && (
              <span className="text-xs text-(--text-muted) bg-(--surface-glass-strong) px-1.5 py-0.5 rounded">
                Host
              </span>
            )}
          </div>
          <p className="text-xs text-(--text-muted) truncate">{myInfo.deviceId}</p>
        </div>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0',
            awaitingApproval
              ? 'text-amber-300 bg-amber-300/10'
              : connectionStatus === 'connected'
                ? 'text-(--color-accent) bg-(--color-accent-subtle)'
                : connectionStatus === 'connecting'
                  ? 'text-yellow-400 bg-yellow-400/10'
                  : 'text-(--text-muted) bg-(--surface-glass)'
          )}
        >
          {awaitingApproval
            ? 'awaiting approval'
            : connectionStatus === 'connected'
              ? 'online'
              : connectionStatus === 'connecting'
                ? 'connecting'
                : 'offline'}
        </span>
      </div>

      {/* Join approvals - only when host management + require approval, and only host can approve/reject */}
      {roomSettings?.requireApproval && roomSettings?.hostManagement && (
        <div className="space-y-2 rounded-lg border border-(--border-soft) bg-(--surface-glass) p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-(--text-muted)">Join approvals</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-(--surface-glass-strong) text-(--text-muted)">
              {pendingJoinRequests.length} pending
            </span>
          </div>
          {pendingJoinRequests.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-(--text-muted)">
              <CheckCircle2 className="w-3.5 h-3.5 text-(--color-accent)" />
              <span>No pending requests</span>
            </div>
          ) : (
            pendingJoinRequests.map((request) => (
              <div
                key={request.deviceId}
                className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg border border-(--border-soft) bg-(--surface-glass-strong)"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-(--text-primary) truncate block text-sm">
                    {request.displayName}
                  </span>
                  <p className="text-xs text-(--text-muted) truncate">{request.deviceId}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full text-amber-300 bg-amber-300/10 whitespace-nowrap">
                  pending
                </span>
                {canApproveOrRemove && (
                  <div className="flex items-center gap-2">
                    {onRejectJoinRequest && (
                      <Button
                        variant="danger"
                        size="icon"
                        onClick={() => onRejectJoinRequest(request.deviceId)}
                        title="Reject request"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {onApproveJoinRequest && (
                      <Button
                        variant="primary"
                        size="icon"
                        onClick={() => onApproveJoinRequest(request.deviceId)}
                        title="Approve request"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {awaitingApproval && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-sm text-amber-300">
          <Clock3 className="w-4 h-4 shrink-0" />
          <span>Your request is waiting for approval from a room member.</span>
        </div>
      )}

      {/* Other members */}
      {otherMembers.map((member) => (
        <div
          key={member.deviceId}
          className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg glass border border-(--border-soft) hover:bg-(--surface-glass) transition-colors"
        >
          <MemberAvatar member={member} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-(--text-primary) truncate block text-sm sm:text-base">
                {member.displayName}
              </span>
              {hostDeviceId && member.deviceId === hostDeviceId && (
                <span className="text-xs text-(--text-muted) bg-(--surface-glass-strong) px-1.5 py-0.5 rounded shrink-0">
                  Host
                </span>
              )}
            </div>
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
                size="icon"
                onClick={() => onRetryConnection(member.deviceId)}
                title="Retry connection"
              >
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </Button>
            )}
            {onRemoveMember && canApproveOrRemove && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveMember(member.deviceId)}
                title="Remove member"
              >
                <UserMinus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {otherMembers.length === 0 && (
        <div className="flex flex-row flex-nowrap gap-1 items-center justify-center py-4 gap-2">
          <Loader2 className="w-3 h-3 text-(--color-accent) animate-spin" />
          <p className="text-sm text-(--text-muted) text-center">
            Waiting for others to join...
          </p>
        </div>
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

