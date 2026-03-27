import type { Metadata, Viewport } from 'next';
// import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { ASSETS } from '@/lib/constants';
import { getSiteUrl } from '@/lib/site';
import { PWAProvider } from '@/components/PWAProvider';
import './globals.css';

// const dmSans = DM_Sans({
//   subsets: ['latin'],
//   variable: '--font-dm-sans',
//   display: 'swap',
// });

// const jetbrainsMono = JetBrains_Mono({
//   subsets: ['latin'],
//   variable: '--font-jetbrains-mono',
//   display: 'swap',
// });

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'CoralSend - Secure P2P File Transfer',
  description: 'Transfer files securely and directly between devices. No sign-up, no storage, just secure peer-to-peer file sharing.',
  keywords: ['file transfer', 'p2p', 'secure', 'encrypted', 'file sharing', 'webrtc'],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  authors: [{ name: 'CoralSend' }],
  creator: 'CoralSend',
  manifest: ASSETS.manifest,
  icons: {
    icon: [
      { url: ASSETS.favicon16, sizes: '16x16', type: 'image/png' },
      { url: ASSETS.favicon32, sizes: '32x32', type: 'image/png' },
      { url: ASSETS.iconSvg, type: 'image/svg+xml' },
      { url: ASSETS.pwaIcon192, sizes: '192x192', type: 'image/png' },
      { url: ASSETS.pwaIcon512, sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: ASSETS.appleTouchIcon, sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'CoralSend - Secure P2P File Transfer',
    description: 'Transfer files securely and directly between devices. No sign-up, no storage, just secure peer-to-peer file sharing.',
    siteName: 'CoralSend',
    images: [{ url: ASSETS.ogImage, width: 1200, height: 630, alt: 'CoralSend' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CoralSend - Secure P2P File Transfer',
    description: 'Transfer files securely and directly between devices.',
    images: [ASSETS.ogImage],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CoralSend',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning /* className={`${dmSans.variable} ${jetbrainsMono.variable}`} */>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('coralsend_theme');if(t==='light'){document.documentElement.classList.add('light');}else if(t==='dark'){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <PWAProvider>{children}</PWAProvider>
      </body>
    </html>
  );
}
