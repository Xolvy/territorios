const CACHE_NAME = 'territorios-elite-v2.0.1';

const ASSETS_CORE = [
    '/',
    '/index.html',
    '/styles.css?v=2.0.1',
    '/app.js?v=2.0.1',
    '/manifest.json',
    '/firebase-config.js?v=2.0.1',
    '/data/firestore-services.js?v=2.0.1',
    '/modules/login.js?v=2.0.1',
    '/modules/admin-dashboard.js?v=2.0.1',
    '/modules/conductor-dashboard.js?v=2.0.1',
    '/modules/report-s13.js?v=2.0.1',
    '/modules/analytics-view.js?v=2.0.1',
    '/modules/utils/helpers.js?v=2.0.1',
    '/modules/utils/intelligence.js?v=2.0.1',
    '/modules/map-viewer.js?v=2.0.1',
    '/modules/utils/theme-manager.js?v=2.0.1',
    '/favicon.svg',
    '/icon-192.svg',
    '/icon-512.svg'
];

const ASSETS_EXTERNAL = [
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.gstatic.com/s/outfit/v11/QGYsz_ueSjtS_GSAp-0.woff2', // Cache specific font files
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

self.addEventListener('install', (event) => {
    // console.log('[SW] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([...ASSETS_CORE, ...ASSETS_EXTERNAL]);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            ).then(() => self.clients.claim());
        })
    );
});

// Message listener for skipWaiting
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * STRATEGY: Stale-While-Revalidate for Assets, Cache-First for Fonts/Libs
 */
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Bypass for Firebase/Analytics
    if (url.hostname.includes('firebase') || url.hostname.includes('google-optimizer') || url.hostname.includes('analytics')) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);

            // Strategy: Cache-First for CDNs (External libs)
            if (ASSETS_EXTERNAL.some(lib => event.request.url.includes(lib)) || url.hostname.includes('fonts.gstatic.com')) {
                if (cachedResponse) return cachedResponse;
            }

            // Strategy: Stale-While-Revalidate for Internal core
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse.ok) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                // Return cached or fallback to offline page
                if (event.request.mode === 'navigate') {
                    return cache.match('/index.html');
                }
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        })
    );
});
