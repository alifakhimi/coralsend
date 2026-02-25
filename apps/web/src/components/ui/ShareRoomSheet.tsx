'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Button, MemberList, SheetSection, CopyableField, SheetTip } from '@/components/ui';
import { Share2, Camera, Shield, Check } from 'lucide-react';

export interface ShareRoomSheetProps {
  /** Room code (e.g. JUPMD7). */
  roomCode: string;
  /** Optional room name for badge. */
  roomName?: string | null;
  /** Full URL to share (for QR and link copy). */
  shareUrl: string;
  /** Current copy key: 'code' | 'link' | null. */
  copiedKey: 'code' | 'link' | null;
  /** Copy room code to clipboard. */
  onCopyCode: () => void | Promise<void>;
  /** Share link (Web Share API or copy). */
  onShareLink: () => void | Promise<void>;
  /** Member count for heading. */
  memberCount: number;
  /** Optional retry handler for member list. */
  onRetryConnection?: (deviceId: string) => void;
}

/** Share sheet content: QR, room code, share button, tips, members. Reusable and theme-aware. */
export function ShareRoomSheet({
  roomCode,
  roomName,
  shareUrl,
  copiedKey,
  onCopyCode,
  onShareLink,
  memberCount,
  onRetryConnection,
}: ShareRoomSheetProps) {
  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex flex-row flex-wrap items-center justify-center gap-4">
        <div
          className="shrink-0 rounded-xl border border-[var(--border-soft)] bg-(--color-white) p-3 shadow-lg"
          aria-hidden
        >
          <QRCodeSVG value={shareUrl} size={150} level="H" />
        </div>
        <SheetSection
          title="Room code"
          className="flex-1 flex-shrink-0 space-y-3 w-full"
        >
          <div className="flex flex-col gap-2">
            <CopyableField
              label={roomName}
              value={roomCode}
              hint="This code is your room key. Anyone with it can join directly."
              copied={copiedKey === 'code'}
              onCopy={onCopyCode}
              valueSize="lg"
              className="flex-nowrap"
            />
            <Button
              variant="secondary"
              onClick={onShareLink}
              className="w-full mt-4"
            >
              {copiedKey === 'link' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {copiedKey === 'link' ? 'Link copied' : 'Share'}
            </Button>
          </div>
        </SheetSection>
      </div>

      <div className="flex flex-col gap-1">
        <SheetTip variant="info" icon={<Camera className="h-4 w-4" />}>
          <p>
            Scan this QR code with your camera to join the room instantly.
          </p>
        </SheetTip>
        <SheetTip variant="warning" icon={<Shield className="h-4 w-4" />}>
          <p>
            <strong>Security tip: </strong>
            This room code works like an access key—share it only with people you trust.
          </p>
        </SheetTip>
      </div>

      <SheetSection
        title={`Members (${memberCount})`}
        description={memberCount === 1 ? "You're the only one here." : `${memberCount} members in this room.`}
      >
        <MemberList layout="list" onRetryConnection={onRetryConnection} />
      </SheetSection>
    </div>
  );
}
