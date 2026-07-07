/**
 * @file public/sw-custom.js
 * @description Xolvy Custom Service Worker — Background Sync para cierre de sesión offline.
 *
 * Este es el único service worker activo para la aplicación.
 * Se construye con VitePWA usando `injectManifest` desde `public/sw-custom.js`.
 * Usa la Background Sync API para encolar la petición a `finalizarSesionTelefonica`
 * cuando no hay red, y la procesa silenciosamente en cuanto el dispositivo vuelve online.
 *
 * ARQUITECTURA:
 * - La cola se guarda en IndexedDB via la librería nativa de BackgroundSync
 * - Al recuperar red, el SW llama directamente a la Cloud Function con el token
 *   almacenado en el request original (clonado antes del fallo de red)
 * - El nombre de la cola 'xolvy-session-sync' es el identificador del Background Sync tag
 *
 * REGISTRO: Ver modules/utils/background-sync.js para el registro desde el frontend.
 */

import { setCacheNameDetails } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

setCacheNameDetails({
    prefix: "territorios-shell-3-6-5",
    suffix: "v1",
    precache: "precache",
    runtime: "runtime",
});

precacheAndRoute(self.__WB_MANIFEST);

// ─── BACKGROUND SYNC QUEUE TAG ────────────────────────────────────────────────
const SYNC_TAG = "xolvy-session-sync";
const DB_NAME = "xolvy-sync-queue";
const DB_VERSION = 1;
const STORE_NAME = "pending-requests";

// ─── IndexedDB HELPERS ────────────────────────────────────────────────────────
const openDB = () =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });

const getAllPending = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
};

const deleteFromQueue = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
    });
};

// ─── CACHE CONFIG ─────────────────────────────────────────────────────────────
const CACHE_NAME = "xolvy-templates-v1";
const TEMPLATE_REGEX = /\/templates\/.+\.(pdf|xlsx)$/i;

// Lifecycle: Install & Activate
self.addEventListener("install", (_event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// ─── FETCH EVENT HANDLER (Offline Templates + External Libraries + Navigation Fallback) ──────────────────────────────────
const EXTERNAL_HOSTS = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "unpkg.com",
    "maps.googleapis.com",
];

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Estrategia CacheFirst para plantillas institucionales
    if (url.origin === self.location.origin && TEMPLATE_REGEX.test(url.pathname)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse.ok) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch(() => response);
                    return response || fetchPromise;
                });
            }),
        );
        return;
    }

    // CacheFirst para recursos externos importantes (fonts, librerías y mapas)
    if (EXTERNAL_HOSTS.some((host) => url.hostname.includes(host))) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(event.request);
                if (cached) return cached;
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (_e) {
                    return cached;
                }
            }),
        );
        return;
    }

    // Offline navigation fallback
    if (event.request.mode === "navigate" && event.request.method === "GET") {
        event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
    }
});

// ─── SYNC EVENT HANDLER (Background Sync para sesiones) ───────────────────────
self.addEventListener("sync", async (event) => {
    if (event.tag !== SYNC_TAG) return;

    event.waitUntil(
        (async () => {
            console.log("[SW:BackgroundSync] Processing queued session closures...");
            const pending = await getAllPending();

            if (!pending.length) {
                console.log("[SW:BackgroundSync] Queue is empty, nothing to process.");
                return;
            }

            for (const item of pending) {
                try {
                    // Re-fire the original Cloud Function request
                    const response = await fetch(item.url, {
                        method: "POST",
                        headers: item.headers,
                        body: item.body,
                    });

                    if (response.ok) {
                        console.log(`[SW:BackgroundSync] ✅ Request ${item.id} replayed successfully.`);
                        await deleteFromQueue(item.id);

                        // Notify all open clients (tabs) about the success
                        const clients = await self.clients.matchAll({ type: "window" });
                        clients.forEach((client) => {
                            client.postMessage({
                                type: "BACKGROUND_SYNC_COMPLETE",
                                payload: { requestId: item.id },
                            });
                        });
                    } else {
                        console.warn(
                            `[SW:BackgroundSync] ⚠️ Request ${item.id} failed with status ${response.status}. Will retry.`,
                        );
                        // Do NOT delete from queue — will retry on next sync
                    }
                } catch (err) {
                    console.error(`[SW:BackgroundSync] Network still unavailable for request ${item.id}:`, err);
                    // Do NOT delete — BackgroundSync will retry automatically
                    throw err; // Re-throw to signal partial failure to the browser
                }
            }
        })(),
    );
});

// ─── PUSH EVENT HANDLER (FCM Web Push) ────────────────────────────────────────
self.addEventListener("push", (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { notification: { title: "App Territorios", body: event.data.text() } };
    }

    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    event.waitUntil(
        self.registration.showNotification(title || "App Territorios", {
            body: body || "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [200, 100, 200],
            requireInteraction: data.tipo === "alerta_privacidad",
            data: {
                url: data.tipo === "alerta_privacidad" ? "/admin?alerta=privacidad" : "/",
                ...data,
            },
            actions: data.tipo === "alerta_privacidad" ? [{ action: "ver_reporte", title: "Ver Dashboard" }] : [],
        }),
    );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((c) => c.url.includes(self.location.origin));
            if (existing) {
                existing.focus();
                existing.navigate(targetUrl);
            } else {
                self.clients.openWindow(targetUrl);
            }
        }),
    );
});
