/* =============================================================================
   PUSH EVOLUTION 100+  ·  service-worker.js
   Offline-first app shell. Bump CACHE when you change any file below, otherwise
   installed devices keep serving the old copy.
   ============================================================================= */

const CACHE = 'push-evolution-v1';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* ---- install: precache the shell ---- */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---- activate: drop old versions ---- */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---- fetch: cache first, network as a top-up ----
   The app makes no API calls, so a cache hit is always the right answer.
   Anything new that arrives over the network is stored for the next launch. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          // Offline and not cached: navigations fall back to the shell.
          req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
        );
    })
  );
});

/* ---- daily reminder notification ---- */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

/* ---- allow the page to trigger a notification or an update ---- */
self.addEventListener('message', (e) => {
  const data = e.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'NOTIFY') {
    self.registration.showNotification('Push Evolution 100+', {
      body: data.body || 'Your evolution mission awaits',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'pe-daily'
    });
  }
});
