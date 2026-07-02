/* ══════════════════════════════════════════
   LEXIS — Service Worker  |  sw.js
   Caches app shell for offline use
   ══════════════════════════════════════════ */

const CACHE_NAME = 'lexis-v2';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap',
];

// ── Install: cache app shell ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CACHE_URLS.map(url => cache.add(url).catch(() => {/* ignore failed external URLs */}))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for app shell,
//           network-first for API calls ────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for API calls
  if (
    url.hostname === 'api.dictionaryapi.dev' ||
    url.hostname === 'api.mymemory.translated.net' ||
    url.hostname === 'translate.googleapis.com' ||
    url.hostname.endsWith('.workers.dev')
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline.' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for everything else (app shell, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
