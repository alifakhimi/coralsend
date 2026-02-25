'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/store';
import { Button, Switch, BottomSheet, SheetSection, SheetRow, CopyableField, SegmentGroup, SheetTip } from '@/components/ui';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  Settings,
  Lock,
  Clock,
  Users,
  Shield,
  Terminal,
  Hash,
  Tag,
} from 'lucide-react';

const MAX_MEMBER_OPTIONS = [2, 4, 8, 16] as const;
const EXPIRE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
] as const;
type AutoExpireValue = (typeof EXPIRE_OPTIONS)[number]['value'];

interface RoomSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function RoomSettings({ isOpen, onClose, className }: RoomSettingsProps) {
  const currentRoom = useStore((s) => s.currentRoom);
  const setRoomName = useStore((s) => s.setRoomName);
  const debugEnabled = useStore((s) => s.debugEnabled);
  const setDebugEnabled = useStore((s) => s.setDebugEnabled);

  const [name, setName] = useState(currentRoom?.name ?? '');
  const [maxMembers, setMaxMembers] = useState(8);
  const [autoExpire, setAutoExpire] = useState<AutoExpireValue>('never');
  const [requireApproval, setRequireApproval] = useState(false);

  const { copy, copied } = useCopyToClipboard<'roomCode'>();

  // Sync local name when room changes (e.g. after rejoin).
  useEffect(() => {
    if (currentRoom?.name != null) setName(currentRoom.name);
  }, [currentRoom?.id, currentRoom?.name]);

  if (!currentRoom) return null;

  const handleSave = () => {
    if (name !== currentRoom.name) setRoomName(name);
    onClose();
  };

  const handleCopyCode = () => {
    void copy(currentRoom.id, 'roomCode');
  };

  return (
    <BottomSheet
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
          <Button variant="primary" className="flex-1" onClick={handleSave}>
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
              hint="Share this code so others can join. Anyone with it has access."
              copied={copied === 'roomCode'}
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
                className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-glass)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
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
              onChange={(v) => setMaxMembers(Number(v))}
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
              onChange={setAutoExpire}
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
            <SheetRow
              icon={<Shield className="h-4 w-4" />}
              title="Require approval"
              subtitle="New joiners must be approved before they can see or send files."
              action={<Switch checked={requireApproval} onChange={setRequireApproval} />}
            />
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
      </div>
    </BottomSheet>
  );
}
