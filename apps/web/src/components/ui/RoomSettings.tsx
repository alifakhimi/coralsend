'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/store';
import { Button } from './Button';
import {
  Settings,
  X,
  Lock,
  Clock,
  Users,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';

interface RoomSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function RoomSettings({ isOpen, onClose, className }: RoomSettingsProps) {
  const currentRoom = useStore((s) => s.currentRoom);
  const setRoomName = useStore((s) => s.setRoomName);
  
  const [name, setName] = useState(currentRoom?.name || '');
  const [maxMembers, setMaxMembers] = useState(8);
  const [autoExpire, setAutoExpire] = useState<'never' | '1h' | '24h' | '7d'>('never');
  const [requireApproval, setRequireApproval] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !currentRoom) return null;

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
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', className)}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-400" />
            <h2 className="font-semibold text-white">Room Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Room ID */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Room Code</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                <span className="font-mono text-lg text-teal-400">{currentRoom.id}</span>
              </div>
              <Button variant="secondary" size="icon" onClick={copyRoomId}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Room Name */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Room Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project Files"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Max Members */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
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
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Current: {currentRoom.members.length} / {maxMembers}
            </p>
          </div>

          {/* Auto Expire */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
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
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Require Approval */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm text-white">Require Approval</p>
                <p className="text-xs text-slate-500">New members must be approved</p>
              </div>
            </div>
            <button
              onClick={() => setRequireApproval(!requireApproval)}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative',
                requireApproval ? 'bg-teal-500' : 'bg-slate-700'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  requireApproval ? 'translate-x-7' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Security note */}
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-300">End-to-End Encrypted</p>
                <p className="text-xs text-slate-500">
                  All file transfers are encrypted. The server never sees your data.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-slate-800">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

