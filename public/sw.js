/**
 * Levelo Service Worker
 * Pre-caches app shell, provides Stale-While-Revalidate for /libs and /monaco,
 * and enables instant offline resilience.
 */

const CACHE_NAME = 'levelo-v1';
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/explore',
  '/manifest.webmanifest',
  '/libs/phaser.min.js',
  '/libs/three.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-caching partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension / API requests
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Stale-While-Revalidate for static libraries and monaco
  if (url.pathname.startsWith('/libs/') || url.pathname.startsWith('/monaco/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Network first with cache fallback for navigation / app shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((res) => {
          return res || caches.match('/dashboard') || caches.match('/');
        });
      })
    );
    return;
  }

  // Cache-first for other static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
