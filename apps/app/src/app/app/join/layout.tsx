import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join Room - CoralSend',
  description:
    'Join a file transfer room by scanning a QR code, pasting a link, or entering a room code.',
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
