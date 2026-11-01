/* Varler Console service worker. Keeps the whole app on the device so it runs with no network. Only the app's
   own files are stored here; records live in IndexedDB and never pass through it. A new version waits until
   the user accepts it from the toast. precache.js is generated: npm run build:pwa */
importScripts('precache.js');
const CACHE = 'vc-' + self.PRECACHE.version;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', ...self.PRECACHE.files])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vc-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'update') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    if (hit) return hit;
    try { return await fetch(req); } catch (err) {
      if (req.mode === 'navigate') return c.match('./index.html');
      throw err;
    }
  }));
});
