"use client";

import { useEffect, useState } from "react";

interface BrowserCompatibility {
  isSimpleBrowser: boolean;
  userAgent: string;
  hasAbortController: boolean;
  hasLocalStorage: boolean;
  hasIndexedDB: boolean;
  supportsServiceWorker: boolean;
  isOnline: boolean;
}

export const useSimpleBrowserCompatibility = () => {
  const [compatibility, setCompatibility] =
    useState<BrowserCompatibility | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkCompatibility = () => {
      try {
        const userAgent = window.navigator?.userAgent || "";

        // Detección exhaustiva del Simple Browser
        const isSimpleBrowser = Boolean(
          userAgent.includes("Code") ||
            userAgent.includes("Electron") ||
            userAgent.includes("VSCode") ||
            userAgent.toLowerCase().includes("vscode") ||
            // Verificar contexto de VS Code
            typeof (window as any).vscode !== "undefined" ||
            // Verificar si estamos en un iframe (común en Simple Browser)
            window.parent !== window ||
            // Verificar falta de APIs comunes
            !window.AbortController
        );

        const compatibility: BrowserCompatibility = {
          isSimpleBrowser,
          userAgent,
          hasAbortController: typeof window.AbortController !== "undefined",
          hasLocalStorage: (() => {
            try {
              return typeof window.localStorage !== "undefined";
            } catch {
              return false;
            }
          })(),
          hasIndexedDB: typeof window.indexedDB !== "undefined",
          supportsServiceWorker: "serviceWorker" in navigator,
          isOnline: navigator.onLine,
        };

        setCompatibility(compatibility);
        setIsReady(true);

        // Log de diagnóstico en desarrollo
        if (process.env.NODE_ENV === "development") {
          console.debug("🔧 Browser Compatibility Check:", compatibility);
        }
      } catch (error) {
        console.debug("Error checking browser compatibility:", error);
        // Fallback conservador
        setCompatibility({
          isSimpleBrowser: true, // Asumir Simple Browser en caso de error
          userAgent: "",
          hasAbortController: false,
          hasLocalStorage: false,
          hasIndexedDB: false,
          supportsServiceWorker: false,
          isOnline: true,
        });
        setIsReady(true);
      }
    };

    // Verificar inmediatamente
    checkCompatibility();

    // Escuchar cambios de conexión
    const handleOnlineChange = () => {
      if (compatibility) {
        setCompatibility((prev) =>
          prev ? { ...prev, isOnline: navigator.onLine } : null
        );
      }
    };

    window.addEventListener("online", handleOnlineChange);
    window.addEventListener("offline", handleOnlineChange);

    return () => {
      window.removeEventListener("online", handleOnlineChange);
      window.removeEventListener("offline", handleOnlineChange);
    };
  }, []);

  return { compatibility, isReady };
};

export default useSimpleBrowserCompatibility;
