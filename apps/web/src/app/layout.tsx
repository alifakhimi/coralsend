import type { Metadata, Viewport } from 'next';
import { ASSETS } from '@/lib/constants';
import './globals.css';

export const metadata: Metadata = {
  title: 'CoralSend - Secure P2P File Transfer',
  description: 'Transfer files securely and directly between devices. No sign-up, no storage, just secure peer-to-peer file sharing.',
  keywords: ['file transfer', 'p2p', 'secure', 'encrypted', 'file sharing', 'webrtc'],
  authors: [{ name: 'CoralSend' }],
  creator: 'CoralSend',
  manifest: ASSETS.manifest,
  icons: {
    icon: [
      { url: ASSETS.favicon16, sizes: '16x16', type: 'image/png' },
      { url: ASSETS.favicon32, sizes: '32x32', type: 'image/png' },
      { url: ASSETS.iconSvg, type: 'image/svg+xml' },
    ],
    apple: [{ url: ASSETS.appleTouchIcon, sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
