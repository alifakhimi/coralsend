import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog - CoralSend',
  description:
    'See what is new in CoralSend — release notes, improvements, and updates.',
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
