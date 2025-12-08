"use client";

import React, { useState, useEffect } from "react";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useSimpleBrowserCompatibility } from "@/hooks/useSimpleBrowserCompatibility";
import ConnectionStatus from "@/components/ConnectionStatus";
import { ProductionOptimizer } from "@/components/ProductionOptimizer";

interface FirebaseConnectionWrapperProps {
  children: React.ReactNode;
  showConnectionStatus?: boolean;
  fallbackComponent?: React.ReactNode;
}

export default function FirebaseConnectionWrapper({
  children,
  showConnectionStatus = true,
  fallbackComponent,
}: FirebaseConnectionWrapperProps) {
  const { status, hasConnectionIssues, forceCheck, errorDetails } =
    useConnectionStatus();
  const { compatibility, isReady } = useSimpleBrowserCompatibility();
  const [showOfflineMode, setShowOfflineMode] = useState(false);

  // Interceptar errores de Firebase globalmente con detección de Simple Browser
  useEffect(() => {
    if (!compatibility) return;

    const isSimpleBrowser = compatibility.isSimpleBrowser;
    const originalError = console.error;

    console.error = (...args) => {
      const errorMessage = args.join(" ");

      // En Simple Browser, ser más tolerante con errores de red
      if (
        isSimpleBrowser &&
        (errorMessage.includes("ERR_BLOCKED_BY_CLIENT") ||
          errorMessage.includes("net::ERR_BLOCKED_BY_CLIENT") ||
          errorMessage.includes("Failed to load resource") ||
          errorMessage.includes("firestore.googleapis.com") ||
          errorMessage.includes("Firebase") ||
          errorMessage.includes("Cannot read properties of null") ||
          errorMessage.includes("onAuthStateChanged") ||
          errorMessage.includes("_delegate") ||
          errorMessage.includes("network"))
      ) {
        console.debug(
          "🔧 Simple Browser - Firebase error ignored:",
          errorMessage.substring(0, 100)
        );
        return; // No bloquear la aplicación en Simple Browser
      }

      // Detectar errores específicos de conexión bloqueada en navegadores normales
      if (
        !isSimpleBrowser &&
        (errorMessage.includes("ERR_BLOCKED_BY_CLIENT") ||
          errorMessage.includes("net::ERR_BLOCKED_BY_CLIENT") ||
          errorMessage.includes("Failed to load resource") ||
          errorMessage.includes("Cannot read properties of null") ||
          errorMessage.includes("onAuthStateChanged") ||
          errorMessage.includes("_delegate") ||
          errorMessage.includes("firestore.googleapis.com"))
      ) {
        console.warn(
          "🚫 Firebase connection issue detected - switching to offline mode"
        );
        setShowOfflineMode(true);
        return;
      }

      // Mostrar otros errores normalmente
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, [compatibility]);

  // Estado de carga mientras detectamos el navegador
  if (!isReady || !compatibility) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p>Inicializando compatibilidad...</p>
        </div>
      </div>
    );
  }

  // Componente de fallback para modo offline
  const OfflineFallback = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-lg w-full mx-4 border border-white/20">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">
            Conexión Bloqueada
          </h1>

          <p className="text-white/80 mb-6 leading-relaxed">
            Las conexiones a Firebase están siendo bloqueadas por tu navegador o
            extensiones de seguridad. Esto es común con bloqueadores de
            anuncios.
          </p>

          <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-blue-200 font-semibold mb-2">💡 Soluciones:</h3>
            <ul className="text-blue-100/80 text-sm space-y-1">
              <li>• Desactiva temporalmente tu bloqueador de anuncios</li>
              <li>
                • Permite conexiones a{" "}
                <code className="bg-black/20 px-1 rounded">
                  firestore.googleapis.com
                </code>
              </li>
              <li>• Prueba en una ventana de incógnito</li>
              <li>• Cambia de navegador temporalmente</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setShowOfflineMode(false);
                forceCheck();
              }}
              className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-200 rounded-lg transition-colors font-medium"
            >
              Reintentar Conexión
            </button>

            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-200 rounded-lg transition-colors font-medium"
            >
              Recargar Página
            </button>
          </div>

          {errorDetails && (
            <div className="mt-4 text-xs text-white/50 bg-black/20 rounded-lg p-2">
              Error: {errorDetails}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Mostrar fallback si hay problemas críticos de conexión o modo offline activado
  if (showOfflineMode || (status === "blocked" && hasConnectionIssues)) {
    return fallbackComponent || <OfflineFallback />;
  }

  return (
    <>
      <ProductionOptimizer />
      {children}
      {showConnectionStatus && <ConnectionStatus onRetry={forceCheck} />}
    </>
  );
}
