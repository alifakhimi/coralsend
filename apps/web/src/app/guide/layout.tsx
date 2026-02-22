import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Getting Started - CoralSend',
  description:
    'Learn how to use CoralSend to share files securely between devices with this step-by-step guide.',
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
