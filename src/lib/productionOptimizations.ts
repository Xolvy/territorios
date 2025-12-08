/**
 * Optimizaciones específicas para producción
 * Reduce errores de red y mejora rendimiento
 */

import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";

export const setupProductionOptimizations = () => {
  // Verificar si estamos en producción
  const isProduction = process.env.NODE_ENV === "production";

  // Detectar si estamos en Simple Browser de VS Code o entornos similares
  const isSimpleBrowser =
    typeof window !== "undefined" &&
    (window.navigator.userAgent.includes("Code") ||
      window.navigator.userAgent.includes("Electron") ||
      !window.fetch || // Simple Browser puede no tener fetch completo
      !window.AbortController); // Simple Browser puede no soportar AbortController

  if (isProduction && !isSimpleBrowser) {
    // Configuraciones específicas para producción (solo en navegadores completos)

    // 1. Suprimir warnings innecesarios de Firebase
    if (typeof window !== "undefined") {
      // Suprimir warnings de Firebase en la consola
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        const message = args[0];

        // Filtrar warnings específicos de Firebase que no son críticos
        if (typeof message === "string") {
          if (
            message.includes("firestore.googleapis.com") ||
            message.includes("identitytoolkit.googleapis.com") ||
            message.includes("BloomFilter") ||
            message.includes("net::ERR_BLOCKED_BY_CLIENT") ||
            message.includes("Failed to load resource")
          ) {
            return; // No mostrar estos warnings
          }
        }

        originalWarn.apply(console, args);
      };
    }

    // 2. Configurar timeouts más cortos para evitar colgados (solo si fetch y AbortController están disponibles)
    if (
      typeof window !== "undefined" &&
      window.fetch &&
      window.AbortController
    ) {
      const originalFetch = window.fetch;
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const modifiedInit: RequestInit = {
          ...init,
          signal: controller.signal,
        };

        return originalFetch(input, modifiedInit).finally(() => {
          clearTimeout(timeoutId);
        });
      };
    }
  }
};

export const logWithEnvironment = (message: string, data?: any) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message, data || "");
  }
};

export const errorWithEnvironment = (message: string, error?: any) => {
  if (process.env.NODE_ENV === "development") {
    console.error(message, error || "");
  } else {
    // En producción, solo loggear errores críticos
    if (
      error?.code &&
      (error.code.includes("auth/") || error.code.includes("firestore/"))
    ) {
      console.error(message, error.code);
    }
  }
};
