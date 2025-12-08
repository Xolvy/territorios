"use client";

import React, { useState, useEffect } from "react";
import { phoneService } from "../../lib/phoneServiceAdvanced";
import { userService } from "../../lib/userService";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";

interface FirebaseStatusData {
  phoneNumbers: {
    count: number;
    loading: boolean;
    error?: string;
  };
  users: {
    count: number;
    loading: boolean;
    error?: string;
  };
  auth: {
    connected: boolean;
    user?: string;
    role?: string;
  };
  connection: {
    status: "connected" | "disconnected" | "checking";
    lastCheck: Date;
  };
}

export const FirebaseStatus: React.FC = () => {
  const { firebaseUser, appUser, loading: authLoading } = useFirebaseAuth();
  const [status, setStatus] = useState<FirebaseStatusData>({
    phoneNumbers: { count: 0, loading: true },
    users: { count: 0, loading: true },
    auth: { connected: false },
    connection: { status: "checking", lastCheck: new Date() },
  });

  const checkPhoneNumbers = async () => {
    setStatus((prev) => ({
      ...prev,
      phoneNumbers: { ...prev.phoneNumbers, loading: true, error: undefined },
    }));

    try {
      const result = await phoneService.requestPhoneNumbers();
      const stats = await phoneService.getPhoneStats();
      setStatus((prev) => ({
        ...prev,
        phoneNumbers: {
          count: stats.total,
          loading: false,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        phoneNumbers: {
          count: 0,
          loading: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        },
      }));
    }
  };

  const checkUsers = async () => {
    setStatus((prev) => ({
      ...prev,
      users: { ...prev.users, loading: true, error: undefined },
    }));

    try {
      const users = await userService.getAllUsers();
      setStatus((prev) => ({
        ...prev,
        users: {
          count: users.length,
          loading: false,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        users: {
          count: 0,
          loading: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        },
      }));
    }
  };

  const checkAll = React.useCallback(async () => {
    setStatus((prev) => ({
      ...prev,
      connection: { status: "checking", lastCheck: new Date() },
    }));

    try {
      await Promise.all([checkPhoneNumbers(), checkUsers()]);
      setStatus((prev) => ({
        ...prev,
        connection: { status: "connected", lastCheck: new Date() },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        connection: { status: "disconnected", lastCheck: new Date() },
      }));
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      setStatus((prev) => ({
        ...prev,
        auth: {
          connected: !!firebaseUser,
          user: appUser?.displayName || firebaseUser?.email || "Anónimo",
          role: appUser?.role || "Sin rol",
        },
      }));

      checkAll();
    }
  }, [firebaseUser, appUser, authLoading, checkAll]);

  const getStatusColor = (status: string | boolean) => {
    if (status === "connected" || status === true) return "text-emerald-400";
    if (status === "checking") return "text-amber-400";
    return "text-red-400";
  };

  const getStatusIcon = (status: string | boolean) => {
    if (status === "connected" || status === true) return "✅";
    if (status === "checking") return "🔄";
    return "❌";
  };

  return (
    <div className="p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden min-h-[600px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Estado de Firebase</h3>
        <button
          onClick={checkAll}
          disabled={status.connection.status === "checking"}
          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-200 rounded-lg transition-colors font-medium disabled:opacity-50"
        >
          {status.connection.status === "checking"
            ? "🔄 Verificando..."
            : "🔄 Actualizar"}
        </button>
      </div>

      {/* Estado de Conexión General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <h4 className="font-semibold text-sm text-white/80 mb-3">
            Conexión General
          </h4>
          <p
            className={`font-bold text-lg ${getStatusColor(
              status.connection.status
            )}`}
          >
            {getStatusIcon(status.connection.status)}{" "}
            {status.connection.status === "connected"
              ? "Conectado"
              : status.connection.status === "checking"
              ? "Verificando"
              : "Desconectado"}
          </p>
          <p className="text-xs text-white/60 mt-2">
            Última verificación:{" "}
            {status.connection.lastCheck.toLocaleTimeString()}
          </p>
        </div>

        {/* Estado de Autenticación */}
        <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <h4 className="font-semibold text-sm text-white/80 mb-3">
            Autenticación
          </h4>
          <p
            className={`font-bold text-lg ${getStatusColor(
              status.auth.connected
            )}`}
          >
            {getStatusIcon(status.auth.connected)}{" "}
            {status.auth.connected ? "Autenticado" : "No autenticado"}
          </p>
          {status.auth.connected && (
            <div className="text-xs text-white/70 mt-2 space-y-1">
              <p>Usuario: {status.auth.user}</p>
              <p>Rol: {status.auth.role}</p>
            </div>
          )}
        </div>

        {/* Estado de Datos */}
        <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <h4 className="font-semibold text-sm text-white/80 mb-3">
            Base de Datos
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Números:</span>
              <span
                className={`text-sm font-bold ${
                  status.phoneNumbers.error
                    ? "text-red-400"
                    : "text-emerald-400"
                }`}
              >
                {status.phoneNumbers.loading
                  ? "🔄"
                  : status.phoneNumbers.error
                  ? "❌"
                  : `📞 ${status.phoneNumbers.count}`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Usuarios:</span>
              <span
                className={`text-sm font-bold ${
                  status.users.error ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {status.users.loading
                  ? "🔄"
                  : status.users.error
                  ? "❌"
                  : `👥 ${status.users.count}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Errores */}
      {(status.phoneNumbers.error || status.users.error) && (
        <div className="p-4 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
          <h4 className="font-semibold text-sm text-red-300 mb-3">
            Errores Detectados:
          </h4>
          <div className="space-y-1">
            {status.phoneNumbers.error && (
              <p className="text-xs text-red-200">
                Números: {status.phoneNumbers.error}
              </p>
            )}
            {status.users.error && (
              <p className="text-xs text-red-200">
                Usuarios: {status.users.error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
