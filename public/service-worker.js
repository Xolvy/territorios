const CACHE_NAME = 'territorios-hard-sync-v2.4.0.5';

const ASSETS_CORE = [
    '/',
    '/index.html',
    '/styles.css?v=2.4.0.5',
    '/app.js?v=2.4.0.5',
    '/manifest.json',
    '/firebase-config.js?v=2.4.0.5',
    '/data/firestore-services.js?v=2.4.0.5',
    '/modules/login.js?v=2.4.0.5',
    '/modules/admin-dashboard.js?v=2.4.0.5',
    '/modules/conductor-dashboard.js?v=2.4.0.5',
    '/modules/report-s13.js?v=2.4.0.5',
    '/modules/analytics-view.js?v=2.4.0.5',
    '/modules/utils/helpers.js?v=2.4.0.5',
    '/modules/utils/intelligence.js?v=2.4.0.5',
    '/modules/map-viewer.js?v=2.4.0.5',
    '/modules/utils/theme-manager.js?v=2.4.0.5',
    '/modules/utils/pwa-manager.js?v=2.4.0.5',
    '/favicon.svg',
    '/icon-192.svg',
    '/icon-512.svg'
];

const ASSETS_EXTERNAL = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/leaflet-image@0.4.0/leaflet-image.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const assets = [...ASSETS_CORE, ...ASSETS_EXTERNAL];
            for (const asset of assets) {
                try {
                    await cache.add(asset);
                } catch (err) { }
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            ).then(async () => {
                try {
                    await self.clients.claim();
                } catch (e) {
                    console.warn("Clients claim failed:", e);
                }
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.hostname.includes('firebase') || url.hostname.includes('google-optimizer') || url.hostname.includes('analytics')) return;

    if (url.hostname.includes('firebasestorage.googleapis.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;
                try {
                    const networkResponse = await fetch(event.request, { mode: 'cors' });
                    if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (e) { return null; }
            })
        );
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            if (ASSETS_EXTERNAL.some(lib => event.request.url.includes(lib)) || url.hostname.includes('fonts.gstatic.com')) {
                if (cachedResponse) return cachedResponse;
            }
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') return cache.match('/index.html');
                return cachedResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});
