//  SNIPPETS CHEAT SHEET - EXTENSIONES REACT/NEXT.JS 2025
import React from "react";

export default function ReactSnippetsCheatSheet() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white mb-6">
            React Snippets Cheat Sheet
          </h1>

          <div className="text-white/80 space-y-4">
            <h2 className="text-xl font-semibold text-white">
              Snippets más útiles:
            </h2>

            <ul className="space-y-2 text-sm">
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">rfce</code>{" "}
                React Function Component Export
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">rafc</code>{" "}
                React Arrow Function Component
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">rfc</code> React
                Function Component
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">useState</code>{" "}
                Hook de estado
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">useEffect</code>{" "}
                Hook de efecto
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">
                  useContext
                </code>{" "}
                Hook de contexto
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">useMemo</code>{" "}
                Hook de memorización
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">
                  useCallback
                </code>{" "}
                Hook de callback
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">tsc</code>{" "}
                TypeScript Component
              </li>
              <li>
                <code className="bg-white/20 px-2 py-1 rounded">napi</code>{" "}
                Next.js API Route
              </li>
            </ul>

            <div className="mt-6 p-4 bg-blue-500/20 rounded-lg">
              <h3 className="font-semibold mb-2">Cómo usar:</h3>
              <ol className="text-sm space-y-1">
                <li>1. Escribe el snippet y presiona TAB</li>
                <li>2. VS Code completará automáticamente</li>
                <li>3. Usa TAB para navegar entre placeholders</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
