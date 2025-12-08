"use client";

import React, { useState, useCallback } from "react";
import { phoneService } from "../../lib/phoneServiceAdvanced";
import type { PhoneRecord } from "../../lib/phoneServiceAdvanced";

interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
  status: "idle" | "processing" | "completed" | "error";
  message?: string;
}

// Función para formatear números de teléfono
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 8) {
    return `2${cleaned}`;
  }
  return cleaned;
};

// Función principal de carga
export const uploadPhoneNumbersToFirebase = async (
  csvData: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ created: number; skipped: number; errors: string[] }> => {
  if (!csvData.trim()) {
    console.log("⏳ No hay datos CSV para procesar...");
    return { created: 0, skipped: 0, errors: [] };
  }

  console.log("📝 Iniciando carga de números telefónicos a Firebase...");

  const lines = csvData.split("\n").filter((line) => line.trim());
  const phoneNumbers: Omit<PhoneRecord, "id" | "createdAt" | "updatedAt">[] =
    [];
  const errors: string[] = [];

  onProgress?.({
    current: 0,
    total: lines.length,
    percentage: 0,
    status: "processing",
    message: "Procesando archivo CSV...",
  });

  // Procesar las líneas del CSV
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      // Procesar cada línea del CSV (formato: propietario, direccion, numero)
      const parts = line
        .split(",")
        .map((part) => part.trim().replace(/"/g, ""));

      if (parts.length >= 3) {
        const [propietario, direccion, numero] = parts;

        if (propietario && direccion && numero) {
          phoneNumbers.push({
            propietario: propietario.toUpperCase(),
            direccion: direccion.toUpperCase(),
            numero: formatPhoneNumber(numero),
            publicador: undefined,
            estado: undefined,
            fechaAsignacion: undefined,
            fechaEstado: undefined,
            comentarios: "Importado desde CSV",
            isAsignado: false,
          });
        }
      }
    } catch (error) {
      errors.push(`Error en línea ${i + 1}: ${error}`);
    }

    // Reportar progreso del procesamiento
    if (i % 50 === 0 || i === lines.length - 1) {
      const percentage = Math.round(((i + 1) / lines.length) * 50); // 50% para procesamiento
      onProgress?.({
        current: i + 1,
        total: lines.length,
        percentage,
        status: "processing",
        message: `Procesando línea ${i + 1}/${lines.length}...`,
      });
    }
  }

  // Subir a Firebase usando carga masiva
  try {
    onProgress?.({
      current: 0,
      total: phoneNumbers.length,
      percentage: 50,
      status: "processing",
      message: "Subiendo a Firebase...",
    });

    const result = await phoneService.bulkCreatePhoneNumbers(phoneNumbers);

    onProgress?.({
      current: result.created,
      total: phoneNumbers.length,
      percentage: 100,
      status: "completed",
      message: `Completado: ${result.created} creados, ${result.skipped} omitidos`,
    });

    console.log(
      `✅ Carga completada: ${result.created} números creados, ${result.skipped} omitidos`
    );

    return {
      created: result.created,
      skipped: result.skipped,
      errors: [...errors, ...result.errors],
    };
  } catch (error) {
    console.error("❌ Error en la carga masiva:", error);
    onProgress?.({
      current: 0,
      total: phoneNumbers.length,
      percentage: 0,
      status: "error",
      message: `Error: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`,
    });
    throw error;
  }
};

// Componente de carga de números
export const PhoneNumberUploader: React.FC = () => {
  const [csvData, setCsvData] = useState("");
  const [progress, setProgress] = useState<UploadProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    status: "idle",
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type === "text/csv") {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setCsvData(content);
        };
        reader.readAsText(file);
      }
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!csvData.trim()) {
      alert("Por favor selecciona un archivo CSV primero");
      return;
    }

    try {
      await uploadPhoneNumbersToFirebase(csvData, setProgress);
    } catch (error) {
      console.error("Error en la carga:", error);
    }
  }, [csvData]);

  const resetUpload = useCallback(() => {
    setCsvData("");
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      status: "idle",
    });
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg border space-y-4">
      <h3 className="text-lg font-semibold">Cargar Números Telefónicos</h3>

      {progress.status === "idle" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar archivo CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato: propietario,direccion,numero
            </p>
          </div>

          {csvData && (
            <div className="p-3 bg-gray-50 rounded border">
              <p className="text-sm text-gray-700">
                📁 Archivo cargado (
                {csvData.split("\n").filter((l) => l.trim()).length} líneas)
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!csvData.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Subir Números a Firebase
          </button>
        </div>
      )}

      {progress.status === "processing" && (
        <div className="space-y-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-700">
            {progress.message} ({progress.percentage}%)
          </p>
        </div>
      )}

      {progress.status === "completed" && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-800">✅ Carga Completada</h4>
            <p className="text-sm text-green-700 mt-1">{progress.message}</p>
          </div>
          <button
            onClick={resetUpload}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            🔄 Cargar Otro Archivo
          </button>
        </div>
      )}

      {progress.status === "error" && (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-medium text-red-800">❌ Error en la Carga</h4>
            <p className="text-sm text-red-700 mt-1">{progress.message}</p>
          </div>
          <button
            onClick={resetUpload}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            🔄 Intentar de Nuevo
          </button>
        </div>
      )}
    </div>
  );
};
