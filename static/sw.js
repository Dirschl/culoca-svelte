// Legacy service worker cleanup.
// If a browser still has an older Culoca service worker registered,
// this script clears old caches and unregisters itself.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })()
  );
});

self.addEventListener('fetch', () => {
  // Intentionally passthrough-only while unregistering.
});
