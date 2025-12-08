"use client";

import { useState, useEffect, useCallback } from "react";
import { isFirebaseEnabled } from "@/lib/firebase";

export type ConnectionStatus =
  | "checking"
  | "connected"
  | "blocked"
  | "offline"
  | "error"
  | "degraded";

interface UseConnectionStatusOptions {
  checkInterval?: number;
  enableAutoRetry?: boolean;
  maxRetries?: number;
}

export function useConnectionStatus(options: UseConnectionStatusOptions = {}) {
  const {
    checkInterval = 30000,
    enableAutoRetry = true,
    maxRetries = 3,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [retryCount, setRetryCount] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      setStatus("checking");
      setLastCheck(new Date());

      // Verificar conectividad básica
      if (!navigator.onLine) {
        setStatus("offline");
        setErrorDetails("No hay conexión a internet");
        return;
      }

      // Verificar si Firebase está habilitado
      if (!isFirebaseEnabled) {
        setStatus("error");
        setErrorDetails("Firebase no está configurado correctamente");
        return;
      }

      // Intentar múltiples URLs de Firebase
      const testUrls = [
        "https://firestore.googleapis.com/",
        "https://firebase.googleapis.com/",
      ];

      let hasSuccessfulConnection = false;
      let blockingDetected = false;

      for (const url of testUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
            mode: "no-cors",
          });

          clearTimeout(timeoutId);
          hasSuccessfulConnection = true;
          break;
        } catch (error: any) {
          console.warn(`Connection test failed for ${url}:`, error);

          // Detectar patrones de bloqueo
          if (
            error.name === "TypeError" ||
            error.message?.includes("blocked") ||
            error.message?.includes("ERR_BLOCKED_BY_CLIENT") ||
            error.message?.includes("net::ERR_BLOCKED_BY_CLIENT")
          ) {
            blockingDetected = true;
            setErrorDetails(
              "Conexiones bloqueadas por el navegador o extensiones"
            );
          }
        }
      }

      if (hasSuccessfulConnection) {
        setStatus("connected");
        setErrorDetails(null);
        setRetryCount(0);
      } else if (blockingDetected) {
        setStatus("blocked");
      } else {
        setStatus("error");
        setErrorDetails("No se puede establecer conexión con Firebase");
      }
    } catch (error: any) {
      console.error("Connection check failed:", error);
      setStatus("error");
      setErrorDetails(error.message || "Error desconocido de conexión");
    }
  }, []);

  const retry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1);
      checkConnection();
    }
  }, [retryCount, maxRetries, checkConnection]);

  const forceCheck = useCallback(() => {
    setRetryCount(0);
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    checkConnection();

    // Configurar verificación periódica
    const interval = setInterval(() => {
      if (
        status !== "connected" &&
        enableAutoRetry &&
        retryCount < maxRetries
      ) {
        retry();
      } else if (status === "connected") {
        checkConnection();
      }
    }, checkInterval);

    // Escuchar eventos de conectividad
    const handleOnline = () => {
      console.log("Network back online, checking connection...");
      forceCheck();
    };

    const handleOffline = () => {
      console.log("Network went offline");
      setStatus("offline");
      setErrorDetails("Conexión a internet perdida");
    };

    // Escuchar eventos de visibilidad para reconectar cuando la página vuelve a ser visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && status !== "connected") {
        console.log("Page became visible, checking connection...");
        setTimeout(forceCheck, 1000);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    status,
    retryCount,
    enableAutoRetry,
    maxRetries,
    checkInterval,
    retry,
    forceCheck,
    checkConnection,
  ]);

  return {
    status,
    retryCount,
    lastCheck,
    errorDetails,
    isConnected: status === "connected",
    hasConnectionIssues: ["blocked", "offline", "error"].includes(status),
    retry,
    forceCheck,
  };
}
