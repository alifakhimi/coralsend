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
  manifest: '/manifest.json',
} as const;

// Get base URL (origin only)
export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

// Get signaling server URL dynamically based on current location
export const getSignalingServerUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL?.trim();
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

const envStunUrl = process.env.NEXT_PUBLIC_STUN_URL?.trim();
const envTurnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
const envTurnUser = process.env.NEXT_PUBLIC_TURN_USER?.trim();
const envTurnPass = process.env.NEXT_PUBLIC_TURN_PASS?.trim();

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

