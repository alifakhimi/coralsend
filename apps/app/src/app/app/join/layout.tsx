import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join Room - CoralSend',
  description:
    'Join an encrypted file transfer room by scanning a QR code or pasting a complete secure invite.',
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
