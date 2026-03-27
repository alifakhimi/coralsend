/**
 * Service Worker for CoralSend PWA.
 * Handles share_target: when user shares files from another app to CoralSend,
 * intercept POST, store files in cache, redirect to app with ?share-target=1.
 */
const SHARE_CACHE = 'coralsend-share-target';

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isSharePost =
    (url.includes('action=share') || url.endsWith('/?action=share')) &&
    event.request.method === 'POST';

  if (!isSharePost) return;

  event.respondWith(
    (async () => {
      try {
        const formData = await event.request.formData();
        const fileList = formData.getAll('files');
        const files = Array.isArray(fileList) ? fileList : [fileList].filter(Boolean);

        if (files.length === 0) {
          const u = new URL(url);
          u.search = '?share-target=0';
          return Response.redirect(u.toString(), 303);
        }

        const cache = await caches.open(SHARE_CACHE);
        await cache.put('count', new Response(String(files.length), { headers: { 'Content-Type': 'text/plain' } }));

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file && typeof file.arrayBuffer === 'function') {
            const blob = file instanceof Blob ? file : await file.blob();
            const name = file.name || `shared-${i}`;
            const type = blob.type || 'application/octet-stream';
            const res = new Response(blob, {
              headers: {
                'Content-Type': type,
                'X-Shared-Filename': name,
              },
            });
            await cache.put(`file-${i}`, res);
          }
        }

        const u = new URL(url);
        u.search = '?share-target=1';
        return Response.redirect(u.toString(), 303);
      } catch (err) {
        console.error('[CoralSend SW] share_target error:', err);
        const u = new URL(url);
        u.search = '?share-target=0';
        return Response.redirect(u.toString(), 303);
      }
    })()
  );
});
