import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CoralSend App - File Transfer',
  description:
    'Transfer files directly between devices. No account required, no cloud storage, encrypted peer-to-peer sharing.',
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
