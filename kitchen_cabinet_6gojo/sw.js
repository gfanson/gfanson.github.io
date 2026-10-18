// Recipe Box offline support: keeps a copy of the app so it opens without internet.
// Recipes and photos are not stored here; they live in the app's on-device database.
const CACHE = 'recipe-box-v1';
const PAGE = './';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(PAGE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(PAGE);
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(PAGE, res.clone()); return res; });
    if (!cached) return net;
    // Use the newest version when the connection is good; fall back to the saved copy when offline or slow.
    const slow = new Promise(r => setTimeout(() => r(cached), 3000));
    return Promise.race([net.catch(() => cached), slow]);
  })());
});
