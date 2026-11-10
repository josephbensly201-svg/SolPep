/* SòlPèp — service worker
 * Strategi: tout fichye aplikasyon an mete nan cache nan premye vizit la (precache).
 * Apre sa, aplikasyon an ouvri san entènèt. Fichye yo rafrechi an background
 * (stale-while-revalidate). Pou fòse yon mizajou, chanje VERSION anba a.
 */
const VERSION = 'v1.4.0';
const CACHE = `jere-sol-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/calc.js',
  './js/db.js',
  './js/format.js',
  './js/install.js',
  './js/schedule.js',
  './js/cloud.js',
  './js/version.js',
  './js/firebase-config.js',
  './js/views/settings.js',
  './js/ui.js',
  './js/lib/idb.js',
  './js/views/home.js',
  './js/views/group.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('jere-sol-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Paj admin: toujou rezo a (pa janm cache, pa janm ranplase pa index.html).
  if (/\/admin\.(html|js|css)$/.test(url.pathname)) return;

  // Navigasyon (ouvri paj la): toujou sèvi ak index.html nan cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req))
    );
    return;
  }

  // Lòt fichye: cache dabò, epi rafrechi an background.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});

/* ---------- Notifikasyon push ---------- */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { data: { body: event.data ? event.data.text() : '' } }; }
  const d = payload.data || {};
  const n = payload.notification || {};
  const title = d.title || n.title || 'SòlPèp';
  const body = d.body || n.body || '';

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focused = wins.find((c) => c.focused);
    if (focused) { focused.postMessage({ type: 'push', data: { title, body } }); return; }   // app la louvri: ti mesaj anndan
    await self.registration.showNotification(title, {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: d.tag || undefined,
      data: { url: d.url || './' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const c of wins) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
