/// <reference lib="webworker" />

// Self-destructing Service Worker: clears any caches from the previous SW
// implementation and unregisters itself on activation. Existing clients with
// the old SW upgrade to this file on their next visit and are cleaned up.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {}
      try {
        await self.registration.unregister();
      } catch {}
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        try { client.navigate(client.url); } catch {}
      });
    })(),
  );
});
