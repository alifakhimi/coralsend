'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/store';
import { Button } from './Button';
import { Switch } from './Switch';
import { BottomSheet } from './BottomSheet';
import {
  Settings,
  Lock,
  Clock,
  Users,
  Shield,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';

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

  const [name, setName] = useState(currentRoom?.name || '');
  const [maxMembers, setMaxMembers] = useState(8);
  const [autoExpire, setAutoExpire] = useState<'never' | '1h' | '24h' | '7d'>('never');
  const [requireApproval, setRequireApproval] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentRoom) return null;

  const handleSave = () => {
    if (name !== currentRoom.name) {
      setRoomName(name);
    }
    onClose();
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(currentRoom.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const expireOptions = [
    { value: 'never', label: 'Never' },
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Room Settings"
      icon={<Settings className="w-4 h-4 text-[var(--color-accent)]" />}
      className={className}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Room ID */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">Room Code</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg px-3 py-2">
              <span className="font-mono text-lg text-[var(--color-accent)]">{currentRoom.id}</span>
            </div>
            <Button variant="secondary" size="icon" onClick={copyRoomId}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Room Name */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">Room Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Project Files"
            className="w-full bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Max Members */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            <Users className="w-4 h-4 inline mr-1" />
            Max Members
          </label>
          <div className="flex gap-2">
            {[2, 4, 8, 16].map((num) => (
              <button
                key={num}
                onClick={() => setMaxMembers(num)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  maxMembers === num
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--surface-glass)] text-[var(--text-muted)] hover:bg-[var(--surface-glass-strong)]'
                )}
              >
                {num}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Current: {currentRoom.members.length} / {maxMembers}
          </p>
        </div>

        {/* Auto Expire */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Auto Expire
          </label>
          <div className="grid grid-cols-4 gap-2">
            {expireOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAutoExpire(opt.value as typeof autoExpire)}
                className={cn(
                  'py-2 rounded-lg text-sm font-medium transition-colors',
                  autoExpire === opt.value
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--surface-glass)] text-[var(--text-muted)] hover:bg-[var(--surface-glass-strong)]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Require Approval */}
        <div className="flex items-center justify-between glass rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">Require Approval</p>
              <p className="text-xs text-[var(--text-muted)]">New members must be approved</p>
            </div>
          </div>
          <Switch checked={requireApproval} onChange={setRequireApproval} />
        </div>

        {/* Debug Console */}
        <div className="flex items-center justify-between glass rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">Debug Console</p>
              <p className="text-xs text-[var(--text-muted)]">Show logs for power users (Ctrl+Shift+D)</p>
            </div>
          </div>
          <Switch checked={debugEnabled} onChange={setDebugEnabled} />
        </div>

        {/* Security note */}
        <div className="glass rounded-lg p-3 border border-[var(--border-soft)]">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">End-to-End Encrypted</p>
              <p className="text-xs text-[var(--text-muted)]">
                All file transfers are encrypted. The server never sees your data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

