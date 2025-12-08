"use client";

import { useEffect, useState } from "react";

export const ProductionOptimizer: React.FC = () => {
  const [browserInfo, setBrowserInfo] = useState<{
    isSimpleBrowser: boolean;
    userAgent: string;
    hasAbortController: boolean;
  } | null>(null);

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === "undefined") return;

    // Diagnosticar el entorno antes de aplicar optimizaciones
    const diagnosticTimeout = setTimeout(() => {
      try {
        const userAgent = window.navigator?.userAgent || "";
        const hasAbortController =
          typeof window.AbortController !== "undefined";

        // Detección más exhaustiva del Simple Browser
        const isSimpleBrowser =
          userAgent.includes("Code") ||
          userAgent.includes("Electron") ||
          userAgent.includes("VSCode") ||
          userAgent.toLowerCase().includes("vscode") ||
          !hasAbortController ||
          // Verificar si estamos en el contexto de VS Code
          (typeof window.parent !== "undefined" && window.parent !== window) ||
          // Verificar propiedades específicas del Simple Browser
          typeof (window as any).vscode !== "undefined";

        setBrowserInfo({
          isSimpleBrowser,
          userAgent,
          hasAbortController,
        });

        // Solo aplicar optimizaciones en producción y fuera del Simple Browser
        const isProduction = process.env.NODE_ENV === "production";

        if (process.env.NODE_ENV === "development") {
          console.debug("🔧 ProductionOptimizer - Desarrollo detectado:", {
            userAgent: userAgent.substring(0, 50) + "...",
            isSimpleBrowser,
            hasAbortController,
            environment: "development",
          });
        }

        // Solo optimizar si NO es Simple Browser y ES producción
        if (isProduction && !isSimpleBrowser) {
          // Aplicar optimizaciones seguras
          const originalWarn = console.warn;
          console.warn = (...args: any[]) => {
            const message = String(args[0] || "");
            // Silenciar warnings específicos de Firebase/Firestore
            if (
              message.includes("firestore.googleapis.com") ||
              message.includes("BloomFilter") ||
              message.includes("Firestore") ||
              message.includes("Firebase")
            ) {
              return;
            }
            originalWarn.apply(console, args);
          };
        }
      } catch (error) {
        console.debug("ProductionOptimizer error (ignorado):", error);
      }
    }, 50); // Reducido el timeout para carga más rápida

    return () => clearTimeout(diagnosticTimeout);
  }, []);

  // En desarrollo, mostrar información de diagnóstico
  if (process.env.NODE_ENV === "development" && browserInfo) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "10px",
          left: "10px",
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "8px",
          borderRadius: "4px",
          fontSize: "10px",
          zIndex: 9999,
          maxWidth: "200px",
        }}
      >
        🔧 Browser: {browserInfo.isSimpleBrowser ? "Simple Browser" : "Regular"}
        <br />
        AbortController: {browserInfo.hasAbortController ? "✓" : "✗"}
      </div>
    );
  }

  return null;
};

export default ProductionOptimizer;
