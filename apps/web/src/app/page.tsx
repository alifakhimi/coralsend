import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { extractRoomId, isValidUUID } from '@/lib/utils';
import { WelcomeView } from '@/components/welcome/WelcomeView';
import { getSiteUrl } from '@/lib/site';

const TITLE = 'CoralSend - Fast Private File Transfer';
const DESCRIPTION =
  'Share files directly between devices with WebRTC. No account, no cloud storage, encrypted in transit. P2P file sharing that respects your privacy.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'file transfer',
    'p2p file sharing',
    'secure file transfer',
    'WebRTC',
    'encrypted transfer',
    'no account',
    'privacy',
    'peer to peer',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

type PageSearchParams = {
  room?: string | string[];
  'share-target'?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const roomParam = firstParam(params.room);
  const shareTarget = firstParam(params['share-target']);

  if (roomParam) {
    const roomId = extractRoomId(roomParam) || roomParam.toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(roomId) || isValidUUID(roomId)) {
      redirect(`/room/${roomId}`);
    }
  }

  if (shareTarget === '1') {
    redirect('/app?share-target=1');
  }

  const siteUrl = getSiteUrl();
  const appUrl = `${siteUrl}/app`;

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CoralSend',
    url: siteUrl,
    description:
      'Transfer files securely and directly between devices. No sign-up, no storage, just secure peer-to-peer file sharing.',
    potentialAction: {
      '@type': 'ViewAction',
      target: appUrl,
      name: 'Open App',
    },
  };

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'CoralSend',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    url: appUrl,
    sameAs: siteUrl,
    description:
      'Create a room, share the link, and send files straight to another device over encrypted WebRTC channels. P2P, encrypted, no account required.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <main className="page-shell overflow-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <div className="page-glow" />
      <div className="relative z-10">
        <WelcomeView />
      </div>
    </main>
  );
}
