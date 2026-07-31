import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Room - CoralSend',
  description: 'Active file transfer room.',
  robots: { index: false, follow: false },
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
