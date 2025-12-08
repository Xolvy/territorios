// Script para limpiar el cache y forzar recarga
if ("caches" in window) {
  caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      console.log("🗑️ Eliminando cache:", cacheName);
      caches.delete(cacheName);
    });
    console.log("✅ Cache limpiado, recargando página...");
    window.location.reload(true);
  });
} else {
  console.log("⚠️ Cache API no disponible, recargando página...");
  window.location.reload(true);
}
