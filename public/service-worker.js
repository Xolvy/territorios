const CACHE_NAME = 'territorios-jw-v1.9.3.3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css?v=1.9.3.3',
    '/app.js?v=1.9.3.3',
    '/manifest.json',
    '/firebase-config.js?v=1.9.3.3',
    '/data/firestore-services.js?v=1.9.3.3',
    '/modules/login.js?v=1.9.3.3',
    '/modules/admin-dashboard.js?v=1.9.3.3',
    '/modules/conductor-dashboard.js?v=1.9.3.3',
    '/modules/report-s13.js?v=1.9.3.3',
    '/modules/analytics-view.js?v=1.9.3.3',
    '/modules/utils/helpers.js?v=1.9.3.3',
    '/modules/utils/intelligence.js?v=1.9.3.3',
    '/modules/map-viewer.js?v=1.9.3.3',
    '/modules/utils/theme-manager.js?v=1.9.3.3',
    '/favicon.svg',
    '/icon-192.svg',
    '/icon-512.svg',
    '/public/favicon.svg',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
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
            self.clients.claim().catch(err => console.log("[SW] Claim failed (typical during updates):", err)),
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

// Stale-While-Revalidate Strategy with offline support for navigation
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Ignore external API calls that shouldn't be cached (except Google Fonts/CDNs used)
    const isFirebase = url.hostname.includes('firebasejs.extension.google.com') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('googleapis.com') && !url.hostname.includes('fonts');

    if (isFirebase) return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);

            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse.ok) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                // Network failed
                console.log('[SW] Network failed');

                // If it's a navigation request and we are offline, return index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }

                return null;
            });

            return cachedResponse || fetchPromise;
        })
    );
});





