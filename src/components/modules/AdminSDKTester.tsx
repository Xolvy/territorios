"use client";

import React, { useState, useEffect } from "react";

interface TestResults {
  isConfigured: boolean;
  statusEndpoint: any;
  connectionTest: any;
  updatePhoneEndpoint: any;
  error?: string;
}

export default function AdminSDKTester() {
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);

  // Verificar configuración al cargar el componente
  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      // Verificar desde el endpoint en lugar del código directo
      const response = await fetch("/api/admin/firebase-status");
      const statusData = await response.json();

      setResults({
        isConfigured: statusData.configured || false,
        statusEndpoint: statusData,
        connectionTest: null,
        updatePhoneEndpoint: null,
      });
    } catch (error: any) {
      console.log("❌ Error verificando configuración:", error);
      setResults({
        isConfigured: false,
        statusEndpoint: null,
        connectionTest: null,
        updatePhoneEndpoint: null,
        error: error.message,
      });
    }
  };

  const testAllEndpoints = async () => {
    setLoading(true);
    try {
      // 1. Test GET /api/admin/firebase-status
      const statusResponse = await fetch("/api/admin/firebase-status");
      const statusData = await statusResponse.json();

      // 2. Test POST /api/admin/firebase-status (conexión)
      const connectionResponse = await fetch("/api/admin/firebase-status", {
        method: "POST",
      });
      const connectionData = await connectionResponse.json();

      // 3. Test GET /api/admin/update-phone (info)
      const updatePhoneResponse = await fetch("/api/admin/update-phone");
      const updatePhoneData = await updatePhoneResponse.json();

      setResults({
        isConfigured: statusData.configured || false,
        statusEndpoint: statusData,
        connectionTest: connectionData,
        updatePhoneEndpoint: updatePhoneData,
      });
    } catch (error: any) {
      setResults({
        isConfigured: false,
        statusEndpoint: null,
        connectionTest: null,
        updatePhoneEndpoint: null,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        🔧 Verificación Firebase Admin SDK
      </h2>

      <div className="mb-4">
        <button
          onClick={testAllEndpoints}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Probando..." : "Probar Todos los Endpoints"}
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Verificación desde el código */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-lg mb-2">
              📋 Verificación desde API Endpoints
            </h3>
            <div className="flex items-center">
              {results.isConfigured ? (
                <span className="text-green-600 font-bold">
                  ✅ Admin SDK configurado
                </span>
              ) : (
                <span className="text-red-600 font-bold">
                  ❌ Admin SDK NO configurado
                </span>
              )}
            </div>
            {results.error && (
              <div className="mt-2 text-red-600 text-sm">
                Error: {results.error}
              </div>
            )}
          </div>

          {/* Estado del endpoint */}
          {results.statusEndpoint && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-bold text-lg mb-2">
                📊 GET /api/admin/firebase-status
              </h3>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(results.statusEndpoint, null, 2)}
              </pre>
            </div>
          )}

          {/* Test de conexión */}
          {results.connectionTest && (
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-bold text-lg mb-2">
                🔗 POST /api/admin/firebase-status
              </h3>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(results.connectionTest, null, 2)}
              </pre>
            </div>
          )}

          {/* Info de actualización de teléfono */}
          {results.updatePhoneEndpoint && (
            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-bold text-lg mb-2">
                📱 GET /api/admin/update-phone
              </h3>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(results.updatePhoneEndpoint, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
