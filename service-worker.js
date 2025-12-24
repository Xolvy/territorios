const CACHE_NAME = 'app-territorios-v5.0.3'; // Updated to match App Version
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js?v=5.0.3',
    '/manifest.json',
    '/firebase-config.js',
    '/data/firestore-services.js?v=5.0.3',
    '/modules/login.js?v=5.0.3',
    '/modules/admin-dashboard.js?v=5.0.3',
    '/modules/conductor-dashboard.js?v=5.0.3',
    '/modules/utils/helpers.js?v=5.0.3',
    '/modules/utils/theme-manager.js?v=5.0.3',
    '/modules/utils/intelligence.js?v=5.0.3',
    '/modules/report-s13.js?v=5.0.3',
    '/public/icon-192.svg',
    '/public/icon-512.svg',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching offline assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Removing old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

// Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
    // Ignore non-GET assignments
    if (event.request.method !== 'GET') return;

    // Ignore Firebase APIs (Firestore/Auth) and other cross-origin calls not in our list
    const isLocal = event.request.url.startsWith(self.location.origin);
    const isCachedAsset = ASSETS_TO_CACHE.includes(event.request.url);

    if (!isLocal && !isCachedAsset) return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);

            // 1. Return cached response immediately if available
            // This provides "Instant Loading" even if offline
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // 2. Async Update the cache with the fresh version
                if (networkResponse.ok) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                // Network failed
                console.log('[SW] Network failed, sticking to cache');
            });

            return cachedResponse || fetchPromise;
        }).catch(() => {
            // If both fail (no cache, no net), and it's navigation, show index
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});
