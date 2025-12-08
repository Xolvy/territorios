"use client";

import { useEffect, useState } from "react";

export function useServiceWorker() {
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Registrar Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("✅ Service Worker registrado exitosamente");
          setSwRegistration(registration);

          // Detectar actualizaciones
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("❌ Error registrando Service Worker:", error);
        });
    }

    // Detectar estado de conexión
    const handleOnline = () => {
      setIsOffline(false);
      console.log("🌐 Conexión restaurada");
    };

    const handleOffline = () => {
      setIsOffline(true);
      console.log("📴 Sin conexión - modo offline activado");
    };

    // Estado inicial
    setIsOffline(!navigator.onLine);

    // Listeners para cambios de conexión
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const updateServiceWorker = () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
      setUpdateAvailable(false);
      window.location.reload();
    }
  };

  return {
    isOffline,
    updateAvailable,
    updateServiceWorker,
  };
}
