"use client";

import React, { useState } from "react";
import {
  uploadPhoneNumbersFromCSV,
  clearAllPhoneNumbers,
  checkPhoneNumbersStatus,
} from "../../lib/phoneNumberManager";

interface DataStatus {
  totalNumbers: number;
  assignedNumbers: number;
  hasData: boolean;
}

export const PhoneNumberUploader: React.FC = () => {
  const [csvData, setCsvData] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [message, setMessage] = useState("");

  // Verificar estado actual de la base de datos
  const checkStatus = async () => {
    try {
      const currentStatus = await checkPhoneNumbersStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error("Error verificando estado:", error);
      setMessage("❌ Error verificando estado de la base de datos");
    }
  };

  // Limpiar todos los números existentes
  const handleClearAll = async () => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar TODOS los números telefónicos de Firebase?"
      )
    ) {
      return;
    }

    setIsClearing(true);
    setMessage("");

    try {
      await clearAllPhoneNumbers();
      setMessage(
        "✅ Todos los números telefónicos han sido eliminados de Firebase"
      );
      await checkStatus();
    } catch (error) {
      console.error("Error limpiando:", error);
      setMessage("❌ Error eliminando números de Firebase");
    } finally {
      setIsClearing(false);
    }
  };

  // Subir números nuevos a Firebase
  const handleUpload = async () => {
    if (!csvData.trim()) {
      setMessage("❌ Por favor ingresa datos CSV para subir");
      return;
    }

    if (!confirm("¿Proceder con la subida de números a Firebase?")) {
      return;
    }

    setIsUploading(true);
    setMessage("");

    try {
      await uploadPhoneNumbersFromCSV(csvData);
      setMessage("✅ Números telefónicos subidos exitosamente a Firebase");
      setCsvData(""); // Limpiar el área de texto
      await checkStatus();
    } catch (error) {
      console.error("Error subiendo:", error);
      setMessage("❌ Error subiendo números a Firebase");
    } finally {
      setIsUploading(false);
    }
  };

  // Cargar estado al montar el componente
  React.useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-semibold text-white mb-6">
        📱 Gestor de Números Telefónicos (Firebase)
      </h2>

      {/* Estado actual */}
      <div className="mb-6 p-4 bg-blue-500/20 border border-blue-400/50 rounded-lg">
        <h3 className="text-blue-300 font-medium mb-2">
          Estado Actual de la Base de Datos
        </h3>
        {status ? (
          <div className="space-y-1 text-sm">
            <p className="text-white">
              Total de números:{" "}
              <span className="font-bold">{status.totalNumbers}</span>
            </p>
            <p className="text-white">
              Números asignados:{" "}
              <span className="font-bold">{status.assignedNumbers}</span>
            </p>
            <p className={status.hasData ? "text-green-300" : "text-gray-300"}>
              Estado: {status.hasData ? "✅ Hay datos" : "⚪ Sin datos"}
            </p>
          </div>
        ) : (
          <p className="text-gray-300">Cargando estado...</p>
        )}
        <button
          onClick={checkStatus}
          className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          🔄 Actualizar Estado
        </button>
      </div>

      {/* Limpiar base de datos */}
      <div className="mb-6 p-4 bg-red-500/20 border border-red-400/50 rounded-lg">
        <h3 className="text-red-300 font-medium mb-2">Limpiar Base de Datos</h3>
        <p className="text-gray-300 text-sm mb-3">
          Elimina TODOS los números telefónicos existentes en Firebase.
        </p>
        <button
          onClick={handleClearAll}
          disabled={isClearing}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
        >
          {isClearing ? "🧹 Eliminando..." : "🗑️ Eliminar Todo"}
        </button>
      </div>

      {/* Subir nuevos números */}
      <div className="mb-6">
        <h3 className="text-green-300 font-medium mb-3">
          Subir Números a Firebase
        </h3>
        <p className="text-gray-300 text-sm mb-3">
          Pega aquí tus datos CSV. Formato esperado: <br />
          <code className="text-yellow-300">
            Nombre, Dirección, Teléfono, Asignado A, Estado
          </code>
        </p>
        <textarea
          value={csvData}
          onChange={(e) => setCsvData(e.target.value)}
          placeholder="GARCIA LOPEZ MARIA, AV. PRINCIPAL 123, 2987654, Juan Perez, No llamado"
          className="w-full h-32 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-vertical"
          disabled={isUploading}
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={handleUpload}
            disabled={isUploading || !csvData.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
          >
            {isUploading ? "📤 Subiendo..." : "📤 Subir a Firebase"}
          </button>
          <button
            onClick={() => setCsvData("")}
            disabled={isUploading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded transition-colors"
          >
            🧹 Limpiar Texto
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.includes("✅")
              ? "bg-green-500/20 border border-green-400/50 text-green-300"
              : message.includes("❌")
              ? "bg-red-500/20 border border-red-400/50 text-red-300"
              : "bg-blue-500/20 border border-blue-400/50 text-blue-300"
          }`}
        >
          {message}
        </div>
      )}

      {/* Instrucciones */}
      <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-400/50 rounded-lg">
        <h4 className="text-yellow-300 font-medium mb-2">
          📋 Instrucciones de Uso
        </h4>
        <ol className="text-gray-300 text-sm space-y-1">
          <li>
            1. <strong>Verificar estado:</strong> Revisa cuántos números hay
            actualmente
          </li>
          <li>
            2. <strong>Limpiar (opcional):</strong> Elimina todos los números
            existentes si quieres empezar limpio
          </li>
          <li>
            3. <strong>Preparar datos:</strong> Formatea tus números como CSV
            (una línea por número)
          </li>
          <li>
            4. <strong>Subir:</strong> Pega los datos y haz clic en &quot;Subir
            a Firebase&quot;
          </li>
          <li>
            5. <strong>Verificar:</strong> Confirma que los números se subieron
            correctamente
          </li>
        </ol>
      </div>
    </div>
  );
};
