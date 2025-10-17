"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { isFirebaseEnabled } from "@/lib/firebase";

interface ReadonlyConnectionStatusProps {
  readonly onRetry?: () => void;
}

export default function ConnectionStatus({
  onRetry,
}: ReadonlyConnectionStatusProps) {
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "blocked" | "offline" | "error"
  >("checking");
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const checkConnection = async () => {
    try {
      // Verificar si los errores de Firebase están deshabilitados
      const hideFirebaseErrors =
        process.env.NEXT_PUBLIC_HIDE_FIREBASE_ERRORS === "true";

      if (hideFirebaseErrors) {
        setConnectionStatus("connected");
        return;
      }

      // Verificar conectividad básica
      if (!navigator.onLine) {
        setConnectionStatus("offline");
        return;
      }

      // Verificar si Firebase está habilitado
      if (!isFirebaseEnabled) {
        setConnectionStatus("error");
        return;
      }

      // Intentar una conexión básica a Firebase
      try {
        const testUrl = "https://firestore.googleapis.com/";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(testUrl, {
          method: "HEAD",
          signal: controller.signal,
          mode: "no-cors",
        });

        clearTimeout(timeoutId);
        setConnectionStatus("connected");
      } catch (error: any) {
        console.warn("Firestore connection test failed:", error);

        // Detectar si es un bloqueo del cliente
        if (
          error.name === "TypeError" ||
          error.message?.includes("blocked") ||
          error.message?.includes("ERR_BLOCKED_BY_CLIENT")
        ) {
          setConnectionStatus("blocked");
        } else {
          setConnectionStatus("error");
        }
      }
    } catch (error) {
      console.error("Connection check failed:", error);
      setConnectionStatus("error");
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    setConnectionStatus("checking");
    checkConnection();
    if (onRetry) {
      onRetry();
    }
  };

  useEffect(() => {
    checkConnection();

    // Verificar conexión cada 30 segundos
    const interval = setInterval(checkConnection, 30000);

    // Escuchar cambios de conectividad
    const handleOnline = () => checkConnection();
    const handleOffline = () => setConnectionStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    // Verificar si los errores de Firebase están deshabilitados
    const hideFirebaseErrors =
      process.env.NEXT_PUBLIC_HIDE_FIREBASE_ERRORS === "true";

    if (hideFirebaseErrors) {
      setIsVisible(false);
      return;
    }

    // Mostrar solo si hay problemas de conexión
    setIsVisible(
      connectionStatus === "blocked" ||
        connectionStatus === "offline" ||
        connectionStatus === "error"
    );
  }, [connectionStatus]);

  if (!isVisible) return null;

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "blocked":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
          title: "Conexión Bloqueada",
          message:
            "Las conexiones a Firebase están siendo bloqueadas por tu navegador o extensiones.",
          bgColor: "bg-orange-500/20",
          borderColor: "border-orange-500/30",
          textColor: "text-orange-200",
          solutions: [
            "Desactiva temporalmente bloqueadores de anuncios",
            "Permite conexiones a firestore.googleapis.com",
            "Prueba en modo incógnito",
            "Cambia de navegador temporalmente",
          ],
        };
      case "offline":
        return {
          icon: <WifiOff className="w-5 h-5 text-red-500" />,
          title: "Sin Conexión",
          message: "No hay conexión a internet disponible.",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/30",
          textColor: "text-red-200",
          solutions: ["Verifica tu conexión a internet", "Intenta de nuevo"],
        };
      case "error":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          title: "Error de Conexión",
          message: "No se puede conectar a los servicios de Firebase.",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/30",
          textColor: "text-red-200",
          solutions: [
            "Verifica tu conexión a internet",
            "Refresca la página",
            "Contacta al administrador si persiste",
          ],
        };
      default:
        return {
          icon: <Wifi className="w-5 h-5 text-green-500" />,
          title: "Conectado",
          message: "Conexión estable con Firebase.",
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/30",
          textColor: "text-green-200",
          solutions: [],
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-md p-4 rounded-xl border backdrop-blur-md z-50 ${config.bgColor} ${config.borderColor}`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <h3 className={`font-semibold ${config.textColor}`}>
            {config.title}
          </h3>
          <p className={`text-sm opacity-90 ${config.textColor} mb-2`}>
            {config.message}
          </p>

          {config.solutions.length > 0 && (
            <div className="mb-3">
              <p className={`text-xs font-medium ${config.textColor} mb-1`}>
                Soluciones:
              </p>
              <ul
                className={`text-xs ${config.textColor} opacity-80 space-y-1`}
              >
                {config.solutions.map((solution, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{solution}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              disabled={connectionStatus === "checking"}
              className={`
                px-3 py-1 rounded-lg text-xs font-medium transition-colors
                ${
                  connectionStatus === "checking"
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                    : "bg-white/20 hover:bg-white/30 text-white"
                }
              `}
            >
              {connectionStatus === "checking" ? (
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Verificando...
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Reintentar {retryCount > 0 && `(${retryCount})`}
                </div>
              )}
            </button>

            <button
              onClick={() => setIsVisible(false)}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Ocultar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
