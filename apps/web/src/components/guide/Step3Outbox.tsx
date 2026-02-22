'use client';

import { useRef } from 'react';
import { Card, FileList } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Send, Plus, ShieldCheck } from 'lucide-react';
import type { Room } from '@/store/store';

interface Step3OutboxProps {
  room: Room;
  onShareFile: (file: File) => void;
  onEnterRoom: () => void;
}

export function Step3Outbox({ room, onShareFile, onEnterRoom }: Step3OutboxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => onShareFile(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const outboxCount = room.files.filter((f) => f.direction === 'outbox').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Send a file</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm mx-auto">
          Choose a file to share. It goes directly to the other person&apos;s device—nothing is stored or uploaded to any server.
        </p>
      </div>

      <Card variant="bordered" className="p-4 flex items-start gap-3 border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)]">
        <ShieldCheck className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--text-primary)]">
          <p className="font-medium text-[var(--text-primary)] mb-1">Private and secure</p>
          <p>Your file is never stored anywhere and is not uploaded to a server. It is sent directly between devices using encrypted P2P transfer.</p>
        </div>
      </Card>

      <Card variant="bordered" className="flex flex-col overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[var(--color-accent)]" />
              <h3 className="font-semibold text-[var(--text-primary)]">Outbox</h3>
              <span className="text-sm text-[var(--text-muted)]">({outboxCount})</span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-accent-subtle)]"
              aria-label="Add file"
            >
              <Plus className="w-3.5 h-3.5" />
              Add File
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Select a file to share with others in the room.</p>
        </div>
        <div className="min-h-[120px] overflow-y-auto">
          <FileList
            direction="outbox"
            hideHeader
            hideFilters
            onDownload={() => { }}
            onCopyTextFile={async () => false}
          />
        </div>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <Button variant="primary" className="w-full" onClick={onEnterRoom}>
        Enter room
      </Button>
    </div>
  );
}
