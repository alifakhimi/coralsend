#!/usr/bin/env node
/**
 * Generate all web assets from apps/web/public/coralsend-logo.png
 * Run from repo root: node apps/web/scripts/generate-assets.mjs
 */

import sharp from 'sharp';
import toIco from 'to-ico';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const APP_DIR = join(ROOT, 'src', 'app');
const LOGO_PATH = join(PUBLIC, 'coralsend-logo.png');
const THEME_BG = '#0f172a';

async function main() {
  const logo = sharp(LOGO_PATH);
  const meta = await logo.metadata();
  const size = Math.min(meta.width ?? 512, meta.height ?? 512);

  // Helper: resize logo to square
  const square = (s) =>
    logo
      .clone()
      .resize(s, s)
      .png();

  // 1. Favicons & icons
  const favicon16 = await logo.clone().resize(16, 16).png().toBuffer();
  const favicon32 = await logo.clone().resize(32, 32).png().toBuffer();
  await sharp(favicon16).toFile(join(PUBLIC, 'favicon-16x16.png'));
  await sharp(favicon32).toFile(join(PUBLIC, 'favicon-32x32.png'));

  // favicon.ico (multi-size for app dir – Next.js serves this at /favicon.ico)
  const faviconIco = await toIco([favicon16, favicon32]);
  writeFileSync(join(APP_DIR, 'favicon.ico'), faviconIco);

  await square(180).toFile(join(PUBLIC, 'apple-touch-icon.png'));
  await square(192).toFile(join(PUBLIC, 'icon-192.png'));
  await square(512).toFile(join(PUBLIC, 'icon-512.png'));

  // 2. Maskable icons (logo at 80% in center for safe zone)
  const maskableSizes = [192, 512];
  for (const s of maskableSizes) {
    const padding = Math.round(s * 0.1);
    const logoSize = s - 2 * padding;
    const padded = await logo
      .clone()
      .resize(logoSize, logoSize)
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: s,
        height: s,
        channels: 4,
        background: THEME_BG,
      },
    })
      .composite([{ input: padded, left: padding, top: padding }])
      .png()
      .toFile(join(PUBLIC, `icon-maskable-${s}.png`));
  }

  // 3. Open Graph image 1200x630
  const ogW = 1200;
  const ogH = 630;
  const logoMax = Math.min(ogW, ogH) * 0.5;
  const ogLogoBuf = await logo.clone().resize(Math.round(logoMax), Math.round(logoMax)).png().toBuffer();
  const left = Math.round((ogW - Math.round(logoMax)) / 2);
  const top = Math.round((ogH - Math.round(logoMax)) / 2);
  await sharp({
    create: {
      width: ogW,
      height: ogH,
      channels: 4,
      background: THEME_BG,
    },
  })
    .composite([{ input: ogLogoBuf, left, top }])
    .png()
    .toFile(join(PUBLIC, 'og.png'));

  // 4. icon.svg – embed 32x32 favicon as data URL so it scales from one file
  const b64 = favicon32.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" width="32" height="32">
  <image width="32" height="32" href="data:image/png;base64,${b64}"/>
</svg>`;
  writeFileSync(join(PUBLIC, 'icon.svg'), svg, 'utf8');

  console.log('Generated: favicon.ico, favicon-16x16, favicon-32x32, apple-touch-icon, icon-192, icon-512, icon-maskable-192, icon-maskable-512, og.png, icon.svg');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
