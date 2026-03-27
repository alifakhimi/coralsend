import { getSiteUrl } from '@/lib/site';

export async function GET() {
  const siteUrl = getSiteUrl();
  const body = [
    '# CoralSend',
    '',
    '> Browser-based peer-to-peer file transfer over WebRTC.',
    '',
    '## Product',
    `- Homepage: ${siteUrl}/`,
    `- App: ${siteUrl}/app`,
    `- Guide: ${siteUrl}/guide`,
    `- Changelog: ${siteUrl}/changelog`,
    '',
    '## Key properties',
    '- No account required to start file sharing',
    '- File bytes are sent directly between peers',
    '- Data channels are encrypted in transit using DTLS',
    '',
    '## Crawling',
    `- Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

