"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";

interface FirebaseStatus {
  configured: boolean;
  projectInfo: {
    projectId: string | null;
    appsInitialized: number;
  };
  environment: {
    hasProjectId: boolean;
    hasClientEmail: boolean;
    hasPrivateKey: boolean;
  };
  nextSteps: string;
}

interface ConnectionTest {
  success: boolean;
  message: string;
  configured: boolean;
  testResult?: {
    usersFound: number;
    sampleUser: any;
  };
  error?: string;
}

export const FirebaseAdminPanel: React.FC = () => {
  const [status, setStatus] = useState<FirebaseStatus | null>(null);
  const [connectionTest, setConnectionTest] = useState<ConnectionTest | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);

  // Cargar estado inicial
  useEffect(() => {
    loadFirebaseStatus();
  }, []);

  const loadFirebaseStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/firebase-status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error cargando estado de Firebase:", error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch("/api/admin/firebase-status", {
        method: "POST",
      });
      const data = await response.json();
      setConnectionTest(data);
    } catch (error: any) {
      console.error("Error probando conexión:", error);
      setConnectionTest({
        success: false,
        message: `Error de conexión: ${error.message}`,
        configured: false,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const StatusIcon = ({ condition }: { condition: boolean }) =>
    condition ? (
      <CheckCircle className="w-5 h-5 text-green-400" />
    ) : (
      <XCircle className="w-5 h-5 text-red-400" />
    );

  if (loading) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 animate-spin" />
          <span>Cargando estado de Firebase Admin SDK...</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg border border-red-500/50">
        <div className="flex items-center space-x-2 text-red-400">
          <XCircle className="w-5 h-5" />
          <span>Error cargando estado de Firebase Admin SDK</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex items-center space-x-2">
        <Shield className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Firebase Admin SDK</h2>
      </div>

      {/* Estado General */}
      <div
        className={`p-6 rounded-lg border ${
          status.configured
            ? "bg-green-900/20 border-green-500/50"
            : "bg-yellow-900/20 border-yellow-500/50"
        }`}
      >
        <div className="flex items-center space-x-3 mb-4">
          {status.configured ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          )}
          <span className="font-medium text-white">
            Estado: {status.configured ? "Configurado" : "No Configurado"}
          </span>
        </div>

        <div className="text-sm text-gray-300 mb-4">{status.nextSteps}</div>

        {/* Información del Proyecto */}
        <div className="bg-black/20 rounded p-4 mb-4">
          <h3 className="font-medium text-white mb-2">
            Información del Proyecto
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Project ID:</span>
              <span className="text-white">
                {status.projectInfo.projectId || "No configurado"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Apps inicializadas:</span>
              <span className="text-white">
                {status.projectInfo.appsInitialized}
              </span>
            </div>
          </div>
        </div>

        {/* Variables de Entorno */}
        <div className="bg-black/20 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Variables de Entorno</h3>
            <button
              onClick={() => setShowEnvVars(!showEnvVars)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              {showEnvVars ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">FIREBASE_PROJECT_ID:</span>
              <div className="flex items-center space-x-2">
                <StatusIcon condition={status.environment.hasProjectId} />
                {showEnvVars && status.environment.hasProjectId && (
                  <span className="text-xs text-gray-500">
                    conductores-9oct
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">FIREBASE_CLIENT_EMAIL:</span>
              <StatusIcon condition={status.environment.hasClientEmail} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">FIREBASE_PRIVATE_KEY:</span>
              <StatusIcon condition={status.environment.hasPrivateKey} />
            </div>
          </div>
        </div>
      </div>

      {/* Prueba de Conexión */}
      <div className="p-6 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">Prueba de Conexión</h3>
          <button
            onClick={testConnection}
            disabled={testingConnection || !status.configured}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              testingConnection
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : status.configured
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            {testingConnection ? "Probando..." : "Probar Conexión"}
          </button>
        </div>

        {connectionTest && (
          <div
            className={`p-4 rounded border ${
              connectionTest.success
                ? "bg-green-900/20 border-green-500/50"
                : "bg-red-900/20 border-red-500/50"
            }`}
          >
            <div className="flex items-center space-x-2 mb-2">
              <StatusIcon condition={connectionTest.success} />
              <span className="font-medium text-white">
                {connectionTest.success
                  ? "Conexión exitosa"
                  : "Error de conexión"}
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-2">
              {connectionTest.message}
            </p>

            {connectionTest.testResult && (
              <div className="text-xs text-gray-400">
                <p>
                  Usuarios encontrados: {connectionTest.testResult.usersFound}
                </p>
                {connectionTest.testResult.sampleUser && (
                  <p>
                    Usuario de prueba:{" "}
                    {connectionTest.testResult.sampleUser.uid}
                  </p>
                )}
              </div>
            )}

            {connectionTest.error && (
              <p className="text-xs text-red-400">
                Error: {connectionTest.error}
              </p>
            )}
          </div>
        )}

        {!status.configured && (
          <div className="text-sm text-gray-400">
            Configure Firebase Admin SDK para habilitar la prueba de conexión.
          </div>
        )}
      </div>

      {/* Instrucciones */}
      {!status.configured && (
        <div className="p-6 bg-blue-900/20 rounded-lg border border-blue-500/50">
          <h3 className="font-medium text-white mb-3">
            Cómo Configurar Firebase Admin SDK
          </h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <strong>1. Obtener credenciales:</strong>
              <p>
                Ve a Firebase Console → Configuración del proyecto → Cuentas de
                servicio → Generar nueva clave privada
              </p>
            </div>
            <div>
              <strong>2. Configurar variables de entorno:</strong>
              <div className="bg-black/40 rounded p-3 mt-2 font-mono text-xs">
                FIREBASE_PROJECT_ID=conductores-9oct
                <br />
                FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@conductores-9oct.iam.gserviceaccount.com
                <br />
                FIREBASE_PRIVATE_KEY=&quot;-----BEGIN PRIVATE
                KEY-----\n...\n-----END PRIVATE KEY-----\n&quot;
              </div>
            </div>
            <div>
              <strong>3. En producción (Azure Static Web Apps):</strong>
              <p>
                Configura las mismas variables en el portal de Azure o mediante
                GitHub Actions secrets
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
