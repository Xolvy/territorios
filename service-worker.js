const CACHE_NAME = 'app-territorios-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/modules/login.js',
    '/modules/admin-dashboard.js',
    '/modules/conductor-dashboard.js',
    '/modules/utils/helpers.js',
    '/public/icon-192.png',
    '/public/icon-512.png',
    '/data/firestore-services.js',
    '/firebase-config.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js'
];

self.addEventListener('install', (event) => {
    // Force new SW to enter the waiting phase
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Claim clients immediately
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // Basic cache-first strategy for static assets, network-first for data/others
    // Since we are using Firebase SDK in the browser, those requests go to firestore.googleapis.com
    // We should probably rely on Firebase offline persistence for data, and SW for static assets.

    const url = new URL(event.request.url);

    // Serve static files from cache
    if (ASSETS_TO_CACHE.some(asset => url.pathname.endsWith(asset) || url.href === asset)) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
