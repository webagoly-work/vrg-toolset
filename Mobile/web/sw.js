// VRG Mobile web (WP M36): cache-first, so the app opens offline and changes only when the user takes an update
// (Frissítés → Frissítés most, which the page allows only to approved devices while the release lock is on).
const CACHE = 'vrg-mobile-web';
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/device.js', 'js/qr.js', 'js/mark.js', 'palettes.json',
  'img/mark.svg', 'manifest.webmanifest', 'version.json'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;          // GitHub, the trust list: always the network
  if (e.request.cache === 'no-store') return;                                     // the update check asks the network itself
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && u.pathname.includes('/icons/')) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
    return r;
  })));
});

// Frissítés most: fetch every file again, then tell the page to reload
self.addEventListener('message', e => {
  if (e.data !== 'refresh') return;
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => fetch(f, { cache: 'reload' }).then(r => r.ok && c.put(f, r)))))
    .then(() => self.clients.matchAll()).then(cs => cs.forEach(c => c.postMessage('refreshed'))));
});
