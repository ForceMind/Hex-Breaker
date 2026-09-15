/* Hex Breaker offline shell. The version token is substituted at build time
   (see vite.config.ts), so every release ships a fresh cache name. */
const CACHE_NAME = 'hex-breaker-v__APP_VERSION__';
const APP_SHELL = ['./', './manifest.webmanifest', './icons/icon.svg', './assets/pwa-192.png', './assets/pwa-512.png'];

self.addEventListener('install', (event) => {
  // Optional art may 404 on a fresh deploy; precache shell entries one by one
  // so a single missing icon never aborts the whole install.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('hex-breaker-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Vite fingerprints every JS/CSS bundle in /assets/ with a content hash, so a
// cached response under one of those URLs can never go stale - the URL itself
// changes when the content does. Everything else the app fetches by a fixed,
// un-hashed name - the shell, the manifest, the icons, and the optional AI art
// (player sprites, tile faces, backgrounds) - can be republished under the
// same URL, so those go network-first with the cache purely as an offline
// fallback. (Note: Phaser art lives in /assets/ too, but un-hashed; network-
// first keeps it fresh and the cache still covers offline play.)
function isHashedAsset(url) {
  return /\/assets\/(index|phaser|rolldown-runtime)-[^/]+\.(js|css)$/.test(new URL(url).pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate' || !isHashedAsset(request.url)) {
    const cacheKey = request.mode === 'navigate' ? './' : request;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
          }
          return response;
        })
        .catch(() => caches.match(cacheKey)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
