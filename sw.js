const CACHE = 'picross-v4';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/styles.css',
  BASE + '/js/puzzles.js',
  BASE + '/js/storage.js',
  BASE + '/js/game.js',
  BASE + '/js/ui.js',
  BASE + '/js/main.js',
  BASE + '/js/dataset.js',
  BASE + '/js/puzzles-dataset.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.svg',
  BASE + '/icons/icon-512.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
