"use client";

import { useState, useEffect } from "react";
import { useSimpleBrowserCompatibility } from "@/hooks/useSimpleBrowserCompatibility";

export const BrowserDiagnostic: React.FC = () => {
  const { compatibility, isReady } = useSimpleBrowserCompatibility();
  const [isMinimized, setIsMinimized] = useState(true);

  // Escuchar mensajes para toggle del diagnóstico
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "TOGGLE_BROWSER_DIAGNOSTIC") {
        setIsMinimized((prev) => !prev);
        // Activar flag global si no está activado
        if (typeof window !== "undefined") {
          (window as any).__SHOW_BROWSER_DIAGNOSTIC__ = true;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!isReady || !compatibility) {
    return null;
  }

  // Solo mostrar si hay problemas críticos o si se activa manualmente
  const hasCriticalIssues =
    !compatibility.hasAbortController || !compatibility.hasLocalStorage;
  const isDiagnosticEnabled =
    typeof window !== "undefined" &&
    (window as any).__SHOW_BROWSER_DIAGNOSTIC__ === true;

  const showDiagnostic = hasCriticalIssues || isDiagnosticEnabled;

  if (!showDiagnostic) {
    return null;
  }

  // Si está minimizado, solo mostrar un botón pequeño
  if (isMinimized && !hasCriticalIssues) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 left-4 z-50 bg-slate-900/90 backdrop-blur-md border border-white/20 rounded-full p-2 text-white hover:bg-slate-800/90 transition-colors"
        title="Mostrar diagnóstico del navegador"
      >
        🔧
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-slate-900/90 backdrop-blur-md border border-white/20 rounded-xl p-4 text-white text-sm max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <h4 className="font-semibold">Diagnóstico del Navegador</h4>
        </div>
        {!hasCriticalIssues && (
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Minimizar"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Simple Browser:</span>
          <span
            className={
              compatibility.isSimpleBrowser ? "text-blue-400" : "text-gray-400"
            }
          >
            {compatibility.isSimpleBrowser ? "✓ Sí" : "✗ No"}
          </span>
        </div>

        <div className="flex justify-between">
          <span>AbortController:</span>
          <span
            className={
              compatibility.hasAbortController
                ? "text-green-400"
                : "text-red-400"
            }
          >
            {compatibility.hasAbortController ? "✓ Sí" : "✗ No"}
          </span>
        </div>

        <div className="flex justify-between">
          <span>LocalStorage:</span>
          <span
            className={
              compatibility.hasLocalStorage ? "text-green-400" : "text-red-400"
            }
          >
            {compatibility.hasLocalStorage ? "✓ Sí" : "✗ No"}
          </span>
        </div>

        <div className="flex justify-between">
          <span>IndexedDB:</span>
          <span
            className={
              compatibility.hasIndexedDB ? "text-green-400" : "text-red-400"
            }
          >
            {compatibility.hasIndexedDB ? "✓ Sí" : "✗ No"}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Online:</span>
          <span
            className={
              compatibility.isOnline ? "text-green-400" : "text-red-400"
            }
          >
            {compatibility.isOnline ? "✓ Sí" : "✗ No"}
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-white/20 text-gray-400 text-xs">
          {compatibility.userAgent.substring(0, 40)}...
        </div>
      </div>

      {compatibility.isSimpleBrowser && (
        <div className="mt-3 p-2 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-200">
          💡 Modo Simple Browser detectado. Optimizaciones aplicadas para mejor
          compatibilidad.
        </div>
      )}

      {(!compatibility.hasAbortController ||
        !compatibility.hasLocalStorage) && (
        <div className="mt-3 p-2 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-200">
          ⚠️ Funcionalidades limitadas detectadas. Algunas características
          podrían no funcionar completamente.
        </div>
      )}
    </div>
  );
};

export default BrowserDiagnostic;
