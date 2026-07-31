'use client';

import { useState } from 'react';
import { useStore, type AutoExpireValue } from '@/store/store';
import { Button, Switch, BottomSheet, SheetSection, SheetRow, CopyableField, SegmentGroup, SheetTip } from '@/components/ui';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  Settings,
  Lock,
  Clock,
  Users,
  Shield,
  Terminal,
  Tag,
  DoorOpen,
} from 'lucide-react';
import { getRoomShareUrl } from '@/lib/constants';

const MAX_MEMBER_OPTIONS = [2, 4, 8, 16] as const;
const EXPIRE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
] as const;

interface RoomSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateRoomSettings?: (settings: { maxMembers: number; autoExpire: AutoExpireValue; requireApproval: boolean; hostManagement: boolean }) => void;
  onApproveJoinRequest?: (deviceId: string) => void;
  onRejectJoinRequest?: (deviceId: string) => void;
  onLeaveRoom?: () => void;
  className?: string;
}

export function RoomSettings({
  isOpen,
  onClose,
  onUpdateRoomSettings,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onLeaveRoom,
  className,
}: RoomSettingsProps) {
  const currentRoom = useStore((s) => s.currentRoom);
  const deviceId = useStore((s) => s.deviceId);
  const setRoomName = useStore((s) => s.setRoomName);
  const setRoomSettings = useStore((s) => s.setRoomSettings);
  const saveToHistory = useStore((s) => s.saveToHistory);
  const debugEnabled = useStore((s) => s.debugEnabled);
  const setDebugEnabled = useStore((s) => s.setDebugEnabled);

  const isHost = Boolean(currentRoom?.hostDeviceId && currentRoom.hostDeviceId === deviceId);

  const [name, setName] = useState(currentRoom?.name ?? '');
  const [maxMembers, setMaxMembers] = useState(currentRoom?.settings.maxMembers ?? 8);
  const [autoExpire, setAutoExpire] = useState<AutoExpireValue>(currentRoom?.settings.autoExpire ?? 'never');
  const [hostManagement, setHostManagement] = useState(currentRoom?.settings.hostManagement ?? false);
  const [requireApproval, setRequireApproval] = useState(currentRoom?.settings.requireApproval ?? false);

  const { copy, copied } = useCopyToClipboard<'code'>();

  if (!currentRoom) return null;
  const formKey = `${currentRoom.id}-${String(isOpen)}-${currentRoom.name ?? ''}-${currentRoom.settings.maxMembers}-${currentRoom.settings.autoExpire}-${String(currentRoom.settings.hostManagement)}-${String(currentRoom.settings.requireApproval)}`;

  const canEditSettings = isHost;

  const handleSave = () => {
    if (name !== currentRoom.name) setRoomName(name);
    setRoomSettings({ maxMembers, autoExpire, hostManagement, requireApproval });
    onUpdateRoomSettings?.({ maxMembers, autoExpire, hostManagement, requireApproval });
    saveToHistory();
    onClose();
  };

  const handleCopyCode = () => {
    void copy(getRoomShareUrl(currentRoom.id) ?? "", 'code');
  };

  return (
    <BottomSheet
      key={formKey}
      isOpen={isOpen}
      onClose={onClose}
      title="Room settings"
      icon={<Settings className="w-4 h-4 text-[var(--color-accent)]" />}
      className={className}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSave} disabled={!canEditSettings}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-12">
        <SheetSection
          title="Room identity"
          description="How others find and recognize this room."
        >
          <div className="space-y-3">
            <CopyableField
              value={currentRoom.id}
              hint="Copy the room link to share. Anyone with the link can join."
              copied={copied === 'code'}
              copyLabel="Copy link"
              onCopy={handleCopyCode}
              valueSize="md"
            />
            <div>
              <label
                htmlFor="room-name"
                className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
              >
                <Tag className="h-3.5 w-3.5" />
                Room name (optional)
              </label>
              <input
                id="room-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Design team, Client files"
                readOnly={!canEditSettings}
                className={`w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-glass)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] ${!canEditSettings ? 'cursor-not-allowed opacity-60' : ''}`}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                A label only you see—helps you tell rooms apart.
              </p>
            </div>
          </div>
        </SheetSection>

        <SheetSection
          title="Access & limits"
          description="Who can join and how long the room stays open."
        >
          <div className="space-y-3">
            <SegmentGroup
              label={
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Max members
                </span>
              }
              options={MAX_MEMBER_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
              value={String(maxMembers)}
              onChange={(v) => canEditSettings && setMaxMembers(Number(v))}
              columns={4}
              hint={`${currentRoom.members.length} of ${maxMembers} spots used.`}
            />
            <SegmentGroup
              label={
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Auto-close after
                </span>
              }
              options={[...EXPIRE_OPTIONS]}
              value={autoExpire}
              onChange={(v) => canEditSettings && setAutoExpire(v)}
              columns={4}
              size="sm"
              hint="Room closes automatically after no activity for this long."
            />
          </div>
        </SheetSection>

        <SheetSection
          title="Security & privacy"
          description="How join requests and data are handled."
        >
          <div className="space-y-2">
            {isHost && (
              <SheetRow
                icon={<Shield className="h-4 w-4" />}
                title="Host management"
                subtitle="Only you can approve join requests, remove members, and change settings."
                action={<Switch checked={hostManagement} onChange={setHostManagement} />}
              />
            )}
            {hostManagement && (
              <SheetRow
                icon={<Lock className="h-4 w-4" />}
                title="Require approval"
                subtitle="New joiners must be approved before they can see or send files."
                action={<Switch checked={requireApproval} onChange={setRequireApproval} disabled={!isHost} />}
              />
            )}
            {requireApproval && currentRoom.pendingJoinRequests.length > 0 && (
              <div className="space-y-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-glass)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Pending requests</p>
                {currentRoom.pendingJoinRequests.map((request) => (
                  <div key={request.deviceId} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">{request.displayName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{request.deviceId}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onRejectJoinRequest?.(request.deviceId)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onApproveJoinRequest?.(request.deviceId)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <SheetTip variant="info" icon={<Lock className="h-4 w-4" />}>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                End-to-end encrypted
              </p>
              <p className="mt-0.5 text-[var(--text-muted)]">
                All transfers are encrypted. We never see your files or room code.
              </p>
            </SheetTip>
          </div>
        </SheetSection>

        <SheetSection
          title="Developer"
          description="Tools for debugging and diagnostics."
        >
          <SheetRow
            icon={<Terminal className="h-4 w-4" />}
            title="Debug console"
            subtitle="Show connection logs and diagnostics. Shortcut: Ctrl+Shift+D"
            action={<Switch checked={debugEnabled} onChange={setDebugEnabled} />}
          />
        </SheetSection>

        {onLeaveRoom && (
          <div className="pt-4 mt-2 border-t border-[var(--border-soft)]">
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                onClose();
                onLeaveRoom();
              }}
              className="w-full justify-center gap-2"
            >
              <DoorOpen className="w-4 h-4" />
              Leave room
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
