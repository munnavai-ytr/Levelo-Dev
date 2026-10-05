/**
 * Levelo Service Worker
 * Pre-caches app shell, provides Stale-While-Revalidate for /libs and /monaco,
 * and enables instant offline resilience.
 */

const CACHE_NAME = 'levelo-v1';
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.webmanifest',
  '/icon.svg',
  '/libs/phaser.min.js',
  '/libs/three.min.js',
  '/monaco/vs/loader.js',
  '/monaco/vs/editor/editor.main.js',
  '/monaco/vs/editor/editor.main.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache assets individually to avoid one failing asset breaking the whole install
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Precache skipped for ${url}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests and http/https schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Stale-While-Revalidate for /libs, /monaco, and static assets
  const isStaticAsset = 
    url.pathname.startsWith('/libs/') || 
    url.pathname.startsWith('/monaco/') || 
    url.pathname.startsWith('/_next/static/');

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        // Return cached immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise || fetch(request);
      })
    );
    return;
  }

  // Navigation requests: Network first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedMatch = await cache.match(request);
          if (cachedMatch) return cachedMatch;
          const dashboardFallback = await cache.match('/dashboard');
          if (dashboardFallback) return dashboardFallback;
          return cache.match('/');
        })
    );
  }
});
