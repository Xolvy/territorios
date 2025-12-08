// 🚀 Service Worker optimizado para Azure Static Web Apps
const CACHE_NAME = "app-conductores-azure-v1";
const STATIC_CACHE_NAME = "static-assets-v1";
const API_CACHE_NAME = "api-cache-v1";

// 📦 Recursos principales para cachear
const urlsToCache = [
  "/",
  "/admin",
  "/diagnostico",
  "/enhanced",
  "/manifest.json",
  "/offline.html", // Página offline personalizada
];

// 🎯 Recursos estáticos para cache a largo plazo
const staticAssets = ["/favicon.ico", "/icon-192.png", "/icon-512.png"];

// 🌐 APIs que pueden ser cacheadas temporalmente
const apiEndpoints = ["/api/health", "/api/azure-info"];

// 🔧 Instalar Service Worker con estrategia multi-cache
self.addEventListener("install", async function (event) {
  console.log("🔄 Azure SWA Service Worker: Instalando...");

  event.waitUntil(
    Promise.all([
      // Cache principal
      caches.open(CACHE_NAME).then((cache) => {
        console.log("✅ Cache principal creado");
        return cache.addAll(urlsToCache);
      }),
      // Cache de assets estáticos
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log("✅ Cache estático creado");
        return cache.addAll(staticAssets);
      }),
      // Preparar cache de API
      caches.open(API_CACHE_NAME).then(() => {
        console.log("✅ Cache de API preparado");
      }),
    ]).then(() => {
      console.log("✅ Service Worker: Todos los recursos cacheados");
      self.skipWaiting();
    })
  );
});

// Activar Service Worker y limpiar caches antiguos
self.addEventListener("activate", function (event) {
  console.log("🔄 Service Worker: Activando...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(
                "🗑️ Service Worker: Eliminando cache antiguo:",
                cacheName
              );
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("✅ Service Worker: Activado");
        return self.clients.claim();
      })
  );
});

// Interceptar peticiones de red para funcionalidad offline
self.addEventListener("fetch", function (event) {
  // Solo manejar peticiones GET y esquemas soportados
  if (event.request.method !== "GET") {
    return;
  }

  // Filtrar esquemas no soportados (chrome-extension, etc.)
  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si tenemos cache, devolverlo
      if (cachedResponse) {
        console.log(
          "📦 Service Worker: Sirviendo desde cache:",
          event.request.url
        );
        return cachedResponse;
      }

      // Si no hay cache, intentar red
      return fetch(event.request)
        .then((response) => {
          // Solo cachear respuestas exitosas
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Cachear la respuesta para futuro uso (solo para esquemas soportados)
          const responseToCache = response.clone();
          const requestUrl = new URL(event.request.url);

          // Solo cachear http y https, no chrome-extension u otros esquemas
          if (
            requestUrl.protocol === "http:" ||
            requestUrl.protocol === "https:"
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch((error) => {
                console.log(
                  "⚠️ Service Worker: No se pudo cachear:",
                  event.request.url,
                  error.message
                );
              });
            });
          }

          return response;
        })
        .catch(() => {
          console.log(
            "❌ Service Worker: Sin conexión, usando cache para:",
            event.request.url
          );
          // Si es una página, devolver la página principal desde cache
          if (event.request.destination === "document") {
            return caches.match("/");
          }
        });
    })
  );
});

// Manejar actualizaciones del Service Worker
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
