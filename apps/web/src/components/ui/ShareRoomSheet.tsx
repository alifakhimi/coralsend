'use client';

import { QRCodeSVG } from 'qrcode.react';
import { MemberList, SheetSection, CopyableField, SheetTip, ShareLinkButtons, Copyable } from '@/components/ui';
import { Camera, Shield } from 'lucide-react';

export interface ShareRoomSheetProps {
  /** Room code (e.g. JUPMD7) — displayed for reference; copy action uses link. */
  roomCode: string;
  /** Optional room name for badge. */
  roomName?: string | null;
  /** Full URL to share (for QR, copy link, and share). */
  shareUrl: string;
  /** Current copy key: 'link' when link was just copied. */
  copiedKey: 'link' | null;
  /** Copy room link to clipboard. */
  onCopyLink: () => void | Promise<void>;
  /** Share (title + message + link) via Web Share or copy link. */
  onShareLink: () => void | Promise<void>;
  /** Member count for heading. */
  memberCount: number;
  /** Optional retry handler for member list. */
  onRetryConnection?: (deviceId: string) => void;
}

/** Share sheet content: QR, room code, copy link + share, tips, members. Reusable and theme-aware. */
export function ShareRoomSheet({
  roomCode,
  roomName,
  shareUrl,
  copiedKey,
  onCopyLink,
  onShareLink,
  memberCount,
  onRetryConnection,
}: ShareRoomSheetProps) {
  return (
    <div className="flex flex-col gap-4 pb-12">

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

      <div className="flex flex-wrap items-stretch justify-center gap-4">
        <SheetSection
          title="Room code"
          className="flex-1 flex-shrink-0 space-y-3"
        >
          <div className='flex flex-1 flex-row flex-nowrap items-stretch justify-stretch gap-4'>
            <div className="flex flex-1 flex-col gap-2">
              <Copyable
                value={shareUrl}
                size='sm'
                className="flex flex-1 items-start flex-shrink-0"
              >
                <p className="text-2xl whitespace-nowrap font-mono font-bold text-[var(--color-accent)]">
                  {roomCode}</p>
              </Copyable>
              <ShareLinkButtons
                onCopyLink={onCopyLink}
                onShareLink={onShareLink}
                copiedKey={copiedKey}
                showCopyLink
                showShare
                size="sm"
                className="mt-2"
              />
            </div>

            <div className='flex flex-none h-full min-h-32 min-w-32 rounded-xl border border-[var(--border-soft)] bg-(--color-white) p-2 shadow-lg'>
              <QRCodeSVG
                value={shareUrl}
                size={20}
                level="L"
                fgColor="#000000"
                className='w-full h-full'
              />
            </div>
          </div>
        </SheetSection>
      </div>

      <SheetSection
        title={`Members (${memberCount})`}
        description={memberCount === 1 ? "You're the only one here." : `${memberCount} members in this room.`}
      >
        <MemberList
          layout="list"
          onRetryConnection={onRetryConnection}
          className="flex-1"
        />
      </SheetSection>
    </div>
  );
}
