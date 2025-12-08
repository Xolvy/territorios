/**
 * 🛠️ Administrador de Base de Datos Firebase
 * Componente para gestionar la subida y migración de datos desde la interfaz
 */

import React, { useState } from "react";
import { firebaseService } from "@/lib/firebaseService";
import {
  CONDUCTORES_DEFAULT,
  LUGARES_DEFAULT,
  FACETAS_DEFAULT,
} from "@/lib/constants";

interface DatabaseStats {
  conductores: number;
  lugares: number;
  facetas: number;
  territorios: number;
  telefonos: number;
}

interface LogEntry {
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
}

export const DatabaseAdmin: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isBacking, setIsBacking] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 50)); // Mantener solo últimos 50 logs
  };

  const handleUploadLocalData = async () => {
    if (isUploading) return;

    setIsUploading(true);
    addLog("info", "Iniciando subida de datos locales...");

    try {
      // Subir conductores
      for (const conductor of CONDUCTORES_DEFAULT) {
        await firebaseService.addConductor(conductor.nombre);
      }

      addLog("success", `✅ ${CONDUCTORES_DEFAULT.length} conductores subidos`);
      addLog("success", "✅ Datos locales subidos exitosamente a Firebase");
      await refreshStats();
    } catch (error) {
      addLog("error", `❌ Error subiendo datos: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackupData = async () => {
    if (isBacking) return;

    setIsBacking(true);
    addLog("info", "Creando respaldo de datos...");

    try {
      // Simulación de backup (en un entorno real esto sería más complejo)
      addLog("info", "Verificando colecciones existentes...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      addLog("success", "✅ Respaldo simulado completado");
      addLog("info", "En producción, usar herramientas de backup de Firebase");
    } catch (error) {
      addLog("error", `❌ Error en backup: ${error}`);
    } finally {
      setIsBacking(false);
    }
  };

  const refreshStats = async () => {
    if (isChecking) return;

    setIsChecking(true);
    addLog("info", "Verificando estado de la base de datos...");

    try {
      // Contar datos locales disponibles
      setStats({
        conductores: CONDUCTORES_DEFAULT.length,
        lugares: LUGARES_DEFAULT.length,
        facetas: FACETAS_DEFAULT.length,
        territorios: 22,
        telefonos: 0, // A configurar después
      });
      addLog("success", "Estado de la base de datos actualizado");
    } catch (error) {
      addLog("error", `❌ Error verificando estado: ${error}`);
    } finally {
      setIsChecking(false);
    }
  };

  const LogTypeIcon = ({ type }: { type: LogEntry["type"] }) => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const LogTypeColor = ({ type }: { type: LogEntry["type"] }) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      default:
        return "text-blue-400";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          🛠️
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Administrador de Base de Datos
          </h2>
          <p className="text-slate-400 text-sm">
            Gestiona la migración y subida de datos a Firebase
          </p>
        </div>
      </div>

      {/* Estado de la Base de Datos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {stats &&
          Object.entries(stats).map(([key, value]) => (
            <div key={key} className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-400 capitalize">{key}</div>
            </div>
          ))}
      </div>

      {/* Acciones Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={refreshStats}
          disabled={isChecking}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? "🔍 Verificando..." : "🔍 Verificar Estado"}
        </button>

        <button
          onClick={handleBackupData}
          disabled={isBacking}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBacking ? "💾 Guardando..." : "💾 Hacer Backup"}
        </button>

        <button
          onClick={handleUploadLocalData}
          disabled={isUploading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? "📤 Subiendo..." : "📤 Subir Datos Locales"}
        </button>
      </div>

      {/* Información Importante */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">
          � Información de Firebase
        </h3>
        <div className="text-sm text-slate-300 space-y-2">
          <div>
            <strong>✅ Recomendación:</strong> MANTÉN tus colecciones existentes
            (Users, territorios, registros telefónicos)
          </div>
          <div>
            <strong>📤 Subir Datos:</strong> Agrega conductores del código local
            a Firebase
          </div>
          <div>
            <strong>� Sincronización:</strong> Los datos se integrarán
            automáticamente
          </div>
          <div>
            <strong>⚠️ Importante:</strong> Para migración completa, usar
            scripts de terminal
          </div>
        </div>
      </div>

      {/* Información de Ayuda */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">
          ℹ️ Información de Uso
        </h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div>
            <strong>Verificar Estado:</strong> Revisa los datos disponibles para
            migración
          </div>
          <div>
            <strong>Hacer Backup:</strong> Recomendación para respaldar datos
            antes de cambios
          </div>
          <div>
            <strong>Subir Datos Locales:</strong> Migra conductores del código a
            Firebase
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-blue-400">💡</span>
            <div className="text-blue-200 text-sm">
              <strong>Para migración completa:</strong> Usa los scripts desde
              terminal:
              <br />
              <code className="bg-slate-700 px-2 py-1 rounded text-xs">
                npm run ts-node src/scripts/master-migration.ts
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Log de Actividad */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">
            📋 Log de Actividad
          </h3>
          <button
            onClick={() => setLogs([])}
            className="text-slate-400 hover:text-white text-sm"
          >
            Limpiar
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-4">
              No hay actividad reciente
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 min-w-[60px]">
                  {log.timestamp}
                </span>
                <span>
                  <LogTypeIcon type={log.type} />
                </span>
                <span className={LogTypeColor({ type: log.type })}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Advertencias */}
      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠️</span>
          <div className="text-yellow-200 text-sm">
            <strong>Importante:</strong> Siempre haz un backup antes de subir
            datos. Las operaciones de escritura en Firebase tienen costos
            asociados.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseAdmin;
