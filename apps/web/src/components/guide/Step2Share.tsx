'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getBaseUrl } from '@/lib/constants';
import { Button, Card, MemberAvatarStack } from '@/components/ui';
import { Copy, Check, Share2 } from 'lucide-react';
import type { Room } from '@/store/store';

interface Step2ShareProps {
  room: Room;
  onNext: () => void;
  onSkipDemo: () => void;
}

export function Step2Share({ room, onNext, onSkipDemo }: Step2ShareProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const shareUrl = `${getBaseUrl()}/room/${room.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'CoralSend Room',
          text: `Join my room to receive files: ${room.id}`,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  const otherMembersCount = room.members.filter((m) => !m.isMe).length;
  const canProceed = otherMembersCount >= 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Share the link</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm mx-auto">
          Send this link to the person who should receive your files. They can open it on their device or scan the QR code. When they join, you can continue.
        </p>
      </div>

      <Card variant="bordered" className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="bg-white p-3 rounded-xl shrink-0">
            <QRCodeSVG value={shareUrl} size={140} level="H" />
          </div>
          <div className="flex-1 space-y-3 w-full min-w-0">
            <p className="text-sm text-[var(--text-muted)]">Room code</p>
            <p className="text-xl font-mono font-bold text-[var(--color-accent)] break-all">{room.id}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copySuccess ? 'Copied!' : 'Copy link'}
              </Button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button variant="secondary" size="sm" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card variant="bordered" className="p-4">
        <p className="text-sm text-[var(--text-muted)] mb-2">People in this room</p>
        <div className="flex items-center gap-2 flex-wrap">
          <MemberAvatarStack />
          {otherMembersCount === 0 ? (
            <span className="text-[var(--text-muted)] text-sm">Waiting for someone to join…</span>
          ) : (
            <span className="text-[var(--color-accent)] text-sm">{otherMembersCount} other member{otherMembersCount !== 1 ? 's' : ''} joined</span>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue
        </Button>
        <Button variant="ghost" size="sm" className="w-full text-[var(--text-muted)]" onClick={onSkipDemo}>
          Skip for demo
        </Button>
      </div>
    </div>
  );
}
