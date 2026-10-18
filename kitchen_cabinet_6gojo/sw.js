// Recipe Box offline support: keeps a copy of the app and its logo so it opens without internet.
// Recipes and photos are not stored here; they live in the app's on-device database.
const CACHE = 'recipe-box-v2';
const PAGE = './';
const LOGO = '/assets/images/recipe_box/app_logo_3.png';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.add(PAGE);
    try { await c.add(LOGO); } catch (err) {}
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The logo: use the saved copy, refresh it in the background.
  if (url.origin === location.origin && url.pathname === LOGO) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE), hit = await cache.match(LOGO);
      const net = fetch(req).then(res => { if (res.ok) cache.put(LOGO, res.clone()); return res; });
      return hit || net;
    })());
    return;
  }

  // The app page: newest version when online, saved copy when offline or slow.
  if (req.mode !== 'navigate') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(PAGE);
    const net = fetch(req).then(res => { if (res.ok) cache.put(PAGE, res.clone()); return res; });
    if (!cached) return net;
    const slow = new Promise(r => setTimeout(() => r(cached), 3000));
    return Promise.race([net.catch(() => cached), slow]);
  })());
});
