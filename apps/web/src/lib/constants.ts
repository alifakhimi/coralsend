import { logger } from "./logger";

/** Public asset URLs (generated from coralsend-logo.png via npm run generate-assets) */
export const ASSETS = {
  favicon16: '/favicon-16x16.png',
  favicon32: '/favicon-32x32.png',
  iconSvg: '/icon.svg',
  appleTouchIcon: '/apple-touch-icon.png',
  ogImage: '/og.png',
  logo: '/coralsend-logo.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
  iconMaskable192: '/icon-maskable-192.png',
  iconMaskable512: '/icon-maskable-512.png',
  pwaIcon192: '/pwa-icon-192.png',
  pwaIcon512: '/pwa-icon-512.png',
  pwaIconMaskable192: '/pwa-icon-maskable-192.png',
  pwaIconMaskable512: '/pwa-icon-maskable-512.png',
  manifest: '/manifest.json',
} as const;

// Get base URL (origin only)
export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

/** Full URL to join or share a room. Use for QR codes, copy link, Web Share, etc. */
export function getRoomShareUrl(roomId: string): string {
  return `${getBaseUrl()}/room/${roomId}`;
}

/** Default title for room share (Web Share API). */
export const ROOM_SHARE_TITLE = 'CoralSend Room';

/** Build structured payload for room share: title, message text, and URL. */
export function getRoomSharePayload(roomId: string, shareUrl: string): {
  title: string;
  text: string;
  url: string;
} {
  return {
    title: ROOM_SHARE_TITLE,
    text: `Join my room to receive files: ${roomId}\n${shareUrl}`,
    url: shareUrl,
  };
}

// Get signaling server URL dynamically based on current location
export const getSignalingServerUrl = (): string => {
  const envUrl = process.env.WEB_SIGNALING_URL?.trim();
  logger.debug("General", `process.env:`, JSON.stringify(process.env));
  logger.debug("General", `envUrl WEB_SIGNALING_URL ${envUrl}`);
  
  if (envUrl) {
    return envUrl;
  }

  // Build URL dynamically from current location (fallback for development)
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    // If localhost or 127.0.0.1, use port 8080
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:8080/ws`;
    }

    return `${protocol}//${window.location.host}/ws`;
  }

  // Fallback for SSR
  return 'ws://localhost:8080/ws';
};

const envStunUrl = process.env.STUN_URL?.trim();
const envTurnUrl = process.env.TURN_URL?.trim();
const envTurnUser = process.env.TURN_USER?.trim();
const envTurnPass = process.env.TURN_PASS?.trim();

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: envStunUrl || 'stun:stun.l.google.com:19302' },
];

if (envTurnUrl && envTurnUser && envTurnPass) {
  ICE_SERVERS.push({
    urls: envTurnUrl,
    username: envTurnUser,
    credential: envTurnPass,
  });
}

/** App version (injected at build from package.json or env) */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

/** Social links — all from env; only non-empty values should be displayed */
export const SOCIAL_LINKS = {
  github: process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || '',
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL?.trim() || '',
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim() || '',
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || '',
  linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() || '',
} as const;

