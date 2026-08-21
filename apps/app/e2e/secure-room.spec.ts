import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

async function sha256(stream: NodeJS.ReadableStream): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

test('two contexts join securely, exchange encrypted chat, and transfer an encrypted file', async ({ browser }) => {
  const permissions = ['camera', 'microphone', 'clipboard-read', 'clipboard-write'];
  const creatorContext = await browser.newContext({ permissions });
  const joinerContext = await browser.newContext({ permissions });
  await joinerContext.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });
  const creator = await creatorContext.newPage();
  const joiner = await joinerContext.newPage();

  await creator.goto('/app');
  await creator.getByText('Create Room', { exact: true }).click();
  await expect(creator.getByRole('heading', { name: /^Room /u })).toBeVisible();
  await creator.getByRole('button', { name: 'Share room' }).click();
  await creator.getByRole('button', { name: /Copy link/u }).click();
  const invite = await creator.evaluate(() => navigator.clipboard.readText());
  expect(invite).toMatch(/\/room\/[A-Z0-9]{6}#k=[A-Za-z0-9_-]{43}$/u);
  expect(new URL(creator.url()).hash).toBe('');
  const inviteKey = new URL(invite).hash.slice(3);
  expect(await creator.evaluate(() => JSON.stringify(localStorage))).not.toContain(inviteKey);

  await joiner.goto(invite);
  await expect.poll(() => new URL(joiner.url()).hash).toBe('');
  await expect(joiner.getByText('2 members', { exact: true })).toBeVisible();
  await expect(creator.getByText('2 members', { exact: true })).toBeVisible();

  await creator.keyboard.press('Escape');
  await creator.getByText('No messages yet', { exact: true }).click();
  await creator.getByPlaceholder('Type a message...').fill('encrypted hello');
  await creator.getByPlaceholder('Type a message...').press('Enter');
  await expect(joiner.getByRole('button', { name: 'encrypted hello' })).toBeVisible();
  await joiner.getByRole('button', { name: 'encrypted hello' }).click();
  await expect(joiner.getByRole('dialog').getByText('encrypted hello', { exact: true })).toBeVisible();

  await creator.getByRole('button', { name: 'Close sheet' }).click();
  await joiner.getByRole('button', { name: 'Close sheet' }).click();
  await creator.getByRole('button', { name: /Outbox/u }).click();
  const body = Buffer.from('coralsend encrypted multi-chunk fixture\n'.repeat(4_000));
  await creator.locator('input[type="file"]').setInputFiles({
    name: 'fixture.txt',
    mimeType: 'text/plain',
    buffer: body,
  });
  await expect(creator.getByText('fixture.txt', { exact: true })).toBeVisible();
  await expect(joiner.getByText('fixture.txt', { exact: true })).toBeVisible();

  const downloadPromise = joiner.waitForEvent('download');
  await joiner.getByRole('button', { name: 'Save file' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  expect(await sha256(stream!)).toBe(createHash('sha256').update(body).digest('hex'));

  const retryBody = Buffer.alloc(32 * 1024 * 1024, 0x43);
  await creator.locator('input[type="file"]').setInputFiles({
    name: 'cancel-retry.bin',
    mimeType: 'application/octet-stream',
    buffer: retryBody,
  });
  await expect(joiner.getByText('cancel-retry.bin', { exact: true })).toBeVisible();
  await joiner.getByRole('button', { name: 'Save file' }).click();
  await expect(joiner.getByRole('button', { name: 'Cancel download' })).toBeVisible();
  await joiner.waitForTimeout(300);
  await joiner.getByRole('button', { name: 'Cancel download' }).click();
  await expect(joiner.getByRole('button', { name: 'Save file' })).toBeVisible();

  const retryDownloadPromise = joiner.waitForEvent('download');
  await joiner.getByRole('button', { name: 'Save file' }).click();
  const retryDownload = await retryDownloadPromise;
  const retryStream = await retryDownload.createReadStream();
  expect(retryStream).not.toBeNull();
  expect(await sha256(retryStream!)).toBe(createHash('sha256').update(retryBody).digest('hex'));

  await creatorContext.close();
  await joinerContext.close();
});

test('a locator without the fragment key cannot join and protocol v0 is rejected', async ({ page }) => {
  await page.goto('/room/ABC234');
  await expect(page).toHaveURL(/\/app$/u);

  const close = await page.evaluate(async () => new Promise<{ code: number; reason: string }>((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:8080/ws');
    socket.onerror = () => reject(new Error('WebSocket failed'));
    socket.onopen = () => socket.send(JSON.stringify({ version: 0, type: 'join', roomId: 'ABC234' }));
    socket.onclose = (event) => resolve({ code: event.code, reason: event.reason });
  }));
  expect(close).toEqual({ code: 1008, reason: 'unsupported_version' });
});

test('wrong keys and tampered encrypted payloads never render peer plaintext', async ({ browser }) => {
  const creatorContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const wrongKeyContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const wrongKeyPeer = await wrongKeyContext.newPage();

  await creator.goto('/app');
  await creator.getByText('Create Room', { exact: true }).click();
  await creator.getByRole('button', { name: 'Share room' }).click();
  await creator.getByRole('button', { name: /Copy link/u }).click();
  const invite = await creator.evaluate(() => navigator.clipboard.readText());
  const wrongInvite = invite.replace(/(#k=)(.)/u, (_match, prefix: string, first: string) => `${prefix}${first === 'A' ? 'B' : 'A'}`);
  await wrongKeyPeer.goto(wrongInvite);
  await expect(wrongKeyPeer.getByText('2 members', { exact: true })).toBeVisible();

  await creator.keyboard.press('Escape');
  await creator.getByText('No messages yet', { exact: true }).click();
  await creator.getByPlaceholder('Type a message...').fill('wrong-key-secret-marker');
  await creator.getByPlaceholder('Type a message...').press('Enter');
  await expect(wrongKeyPeer.getByText('wrong-key-secret-marker', { exact: true })).toHaveCount(0);

  const roomId = /\/room\/([A-Z0-9]{6})/u.exec(invite)?.[1];
  expect(roomId).toBeTruthy();
  await creator.evaluate(async (activeRoomId) => new Promise<void>((resolve, reject) => {
    const attackerId = '33333333-3333-4333-8333-333333333333';
    const socket = new WebSocket('ws://127.0.0.1:8080/ws');
    socket.onerror = () => reject(new Error('Raw test peer failed'));
    socket.onopen = () => socket.send(JSON.stringify({
      version: 1,
      type: 'join',
      roomId: activeRoomId,
      payload: { deviceId: attackerId },
    }));
    socket.onmessage = () => {
      const bytes = new TextEncoder().encode('tampered-filename-marker.txt'.padEnd(48, 'x'));
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      socket.send(JSON.stringify({
        version: 1,
        type: 'file-meta',
        roomId: activeRoomId,
        payload: {
          alg: 'A256GCM',
          iv: 'AAAAAAAAAAAAAAAA',
          ciphertext: btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, ''),
        },
      }));
      setTimeout(() => { socket.close(); resolve(); }, 250);
    };
  }), roomId!);
  await expect(creator.getByText('tampered-filename-marker.txt', { exact: true })).toHaveCount(0);

  await creatorContext.close();
  await wrongKeyContext.close();
});
