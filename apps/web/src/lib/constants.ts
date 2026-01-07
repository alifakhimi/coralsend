// Get signaling server URL dynamically based on current location
export const getSignalingServerUrl = (): string => {
  // Use environment variable if set (highest priority)
  // Check both at build time and runtime
  const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (envUrl) {
    // Return as-is, don't modify it
    console.log('Using NEXT_PUBLIC_SIGNALING_URL from env:', envUrl);
    return envUrl;
  }

  console.log('NEXT_PUBLIC_SIGNALING_URL not set, building URL dynamically');

  // Build URL dynamically from current location (fallback for development)
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    // If localhost or 127.0.0.1, use port 8080
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:8080/ws`;
    }

    // For production/remote, use same hostname but different port or subdomain
    // Option 1: Same hostname, different port (if server is on 8080)
    // Option 2: Use subdomain like ws.example.com
    // For now, we'll try same hostname with port 8080
    const port = window.location.port ? `:8080` : ':8080';
    return `${protocol}//${hostname}${port}/ws`;
  }

  // Fallback for SSR
  return 'ws://localhost:8080/ws';
};

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

