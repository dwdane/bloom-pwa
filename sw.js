// sw.js — caches the app shell for offline use. Bump CACHE_VERSION on release.

const CACHE_VERSION = 'bloom-pwa-v6';
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request).catch(() => caches.match('./index.html'))
    )
  );
});
