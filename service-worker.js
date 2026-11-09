/* SòlPèp — service worker
 * Strategi: tout fichye aplikasyon an mete nan cache nan premye vizit la (precache).
 * Apre sa, aplikasyon an ouvri san entènèt. Fichye yo rafrechi an background
 * (stale-while-revalidate). Pou fòse yon mizajou, chanje VERSION anba a.
 */
const VERSION = 'v1.3.0';
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
