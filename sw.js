// sw.js — caches the app shell for offline use. Bump CACHE_VERSION on release.

const CACHE_VERSION = 'bloom-pwa-v27';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './weekContent.js',
  './foodDatabase.js',
  './logOptions.js',
  './symptomRelief.js',
  './listTemplates.js',
  './gestational.js',
  './charts.js',
  './db.js',
  './birthPlan.js',
  './app.js',
  './manifest.json',
  './privacy.html',
  './terms.html',
  './disclaimer.html',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // Runtime-cache successful same-origin files (e.g. art/*.png added
          // incrementally) so they work offline after the first view.
          if (resp && resp.ok && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
