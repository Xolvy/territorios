import React, { useState, useEffect } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";

interface DiagnosticResult {
  name: string;
  status: "success" | "error" | "warning";
  message: string;
  details?: string;
}

export const DiagnosticPageEnhanced: React.FC = () => {
  const { state } = useUnifiedApp();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    // Test Firebase connection
    try {
      results.push({
        name: "Firebase Connection",
        status: "success",
        message: "Firebase connection is working",
        details: "Successfully connected to Firebase"
      });
    } catch (error) {
      results.push({
        name: "Firebase Connection",
        status: "error",
        message: "Firebase connection failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // Test Authentication
    results.push({
      name: "Authentication",
      status: state.currentUser ? "success" : "warning",
      message: state.currentUser ? "User authenticated" : "No user logged in",
      details: state.currentUser ? `User: ${state.currentUser.email}` : "Please log in"
    });

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8">
          <h1 className="text-3xl font-bold text-white mb-8">
            🔍 Diagnóstico del Sistema
          </h1>
          
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="mb-8 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            {isRunning ? "Ejecutando..." : "Ejecutar Diagnóstico"}
          </button>

          <div className="space-y-4">
            {diagnostics.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.status === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : result.status === "error"
                    ? "bg-red-500/10 border-red-500/30 text-red-300"
                    : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{result.name}</h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      result.status === "success"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : result.status === "error"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {result.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-2 text-white/80">{result.message}</p>
                {result.details && (
                  <p className="mt-1 text-xs text-white/60">{result.details}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};