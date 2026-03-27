const DEFAULT_SITE_URL = 'http://localhost:3000';

function normalizeUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    return normalizeUrl(envUrl);
  }
  return DEFAULT_SITE_URL;
}

