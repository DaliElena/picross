const CACHE = 'picross-v7';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/styles.css',
  BASE + '/bundle.js',
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

  const url = new URL(e.request.url);

  // Google Fonts (CSS и файлы шрифтов) — cache-first с докэшированием,
  // чтобы шрифты работали офлайн после первого визита.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
      )
    );
    return;
  }

  // Часто меняющиеся файлы (страница и бандл) — network-first,
  // чтобы новые деплои подхватывались без ручной смены версии кэша.
  const isFresh = e.request.mode === 'navigate'
    || url.pathname.endsWith('/bundle.js')
    || url.pathname.endsWith('/css/styles.css')
    || url.pathname.endsWith('/index.html')
    || url.pathname === BASE + '/';

  if (isFresh) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached => {
            if (cached) return cached;
            // Навигация по любому адресу внутри приложения офлайн —
            // отдаём закэшированную оболочку.
            if (e.request.mode === 'navigate') return caches.match(BASE + '/index.html');
          })
        )
    );
    return;
  }

  // Остальные ассеты — cache-first (быстро и работает офлайн).
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
