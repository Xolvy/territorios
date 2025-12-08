"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";

interface ReadonlyExportToolsProps {
  readonly className?: string;
}

export interface ExportOptions {
  readonly format: "json" | "csv" | "xlsx";
  readonly includeTerritorios: boolean;
  readonly includeUsuarios: boolean;
  readonly includeAsignaciones: boolean;
  readonly includeTelefonos: boolean;
  readonly dateRange?: {
    readonly start: string;
    readonly end: string;
  };
}

const ExportTools: React.FC<ReadonlyExportToolsProps> = ({ className }) => {
  const { state, getStats } = useUnifiedApp();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "json",
    includeTerritorios: true,
    includeUsuarios: false,
    includeAsignaciones: true,
    includeTelefonos: false,
  });
  const [isExporting, setIsExporting] = useState(false);

  const stats = useMemo(() => getStats(), [getStats]);

  const formatDataAsCSV = useCallback(
    (data: any[], headers: string[]): string => {
      const csvRows = [];
      csvRows.push(headers.join(","));

      for (const row of data) {
        const values = headers.map((header) => {
          const value = row[header];
          return typeof value === "string" && value.includes(",")
            ? `"${value}"`
            : value;
        });
        csvRows.push(values.join(","));
      }

      return csvRows.join("\n");
    },
    []
  );

  const exportData = useCallback(async () => {
    setIsExporting(true);

    try {
      const exportData: any = {
        metadata: {
          exportDate: new Date().toISOString(),
          systemStats: stats,
          options: exportOptions,
        },
      };

      // Incluir territorios
      if (exportOptions.includeTerritorios) {
        exportData.territorios = state.territories;
        exportData.manzanas = state.blocks;
        exportData.direcciones = state.addresses;
      }

      // Incluir usuarios
      if (exportOptions.includeUsuarios) {
        // Remover información sensible
        exportData.usuarios = Object.values(state.users).map((user) => ({
          uid: user.uid,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        }));
      }

      // Incluir asignaciones
      if (exportOptions.includeAsignaciones) {
        exportData.asignaciones = state.assignments;
      }

      // Incluir teléfonos
      if (exportOptions.includeTelefonos) {
        // Remover números reales por privacidad
        exportData.telefonos = Object.values(state.phoneNumbers).map(
          (phone) => ({
            id: phone.id,
            status: phone.estado,
            addressId: phone.addressId,
            lastContacted: phone.fechaUltimaLlamada,
            notes: phone.comentarios,
          })
        );
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (exportOptions.format) {
        case "json":
          content = JSON.stringify(exportData, null, 2);
          filename = `export-territorios-${
            new Date().toISOString().split("T")[0]
          }.json`;
          mimeType = "application/json";
          break;

        case "csv": {
          // Para CSV, exportar cada sección por separado
          const csvSections: string[] = [];

          if (exportOptions.includeTerritorios && exportData.territorios) {
            csvSections.push("=== TERRITORIOS ===");
            csvSections.push(
              formatDataAsCSV(exportData.territorios, [
                "id",
                "numero",
                "descripcion",
                "isActive",
              ])
            );
            csvSections.push("");
          }

          if (exportOptions.includeAsignaciones && exportData.asignaciones) {
            csvSections.push("=== ASIGNACIONES ===");
            csvSections.push(
              formatDataAsCSV(exportData.asignaciones, [
                "id",
                "conductorId",
                "territoryId",
                "assignedAt",
                "status",
              ])
            );
            csvSections.push("");
          }

          content = csvSections.join("\n");
          filename = `export-territorios-${
            new Date().toISOString().split("T")[0]
          }.csv`;
          mimeType = "text/csv";
          break;
        }

        case "xlsx": {
          // Para XLSX, usar JSON como fallback por ahora
          content = JSON.stringify(exportData, null, 2);
          filename = `export-territorios-${
            new Date().toISOString().split("T")[0]
          }.xlsx.json`;
          mimeType = "application/json";
          break;
        }

        default:
          throw new Error("Formato no soportado");
      }

      // Crear y descargar archivo
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al exportar:", error);
      alert("Error al exportar los datos. Por favor, inténtelo de nuevo.");
    } finally {
      setIsExporting(false);
    }
  }, [state, exportOptions, stats, formatDataAsCSV]);

  const updateExportOptions = useCallback((updates: Partial<ExportOptions>) => {
    setExportOptions((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${className}`}>
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              📥 Exportar Datos
            </h2>
            <p className="text-gray-600">Descargar información del sistema</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Formato de exportación */}
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-3">
            Formato de exportación
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["json", "csv", "xlsx"] as const).map((format) => (
              <button
                key={format}
                onClick={() => updateExportOptions({ format })}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  exportOptions.format === format
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">{format.toUpperCase()}</div>
                <div className="text-xs text-gray-500">
                  {format === "json" && "Datos estructurados"}
                  {format === "csv" && "Hoja de cálculo"}
                  {format === "xlsx" && "Excel (próximamente)"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selección de datos */}
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-3">
            Datos a incluir
          </legend>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
              <input
                id="include-territories"
                type="checkbox"
                checked={exportOptions.includeTerritorios}
                onChange={(e) =>
                  updateExportOptions({ includeTerritorios: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="include-territories"
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium text-gray-900">
                  Territorios y Manzanas
                </div>
                <div className="text-sm text-gray-500">
                  {stats.territories.total} territorios,{" "}
                  {Object.keys(state.blocks).length} manzanas
                </div>
              </label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
              <input
                id="include-users"
                type="checkbox"
                checked={exportOptions.includeUsuarios}
                onChange={(e) =>
                  updateExportOptions({ includeUsuarios: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="include-users" className="flex-1 cursor-pointer">
                <div className="font-medium text-gray-900">
                  Usuarios (sin info. sensible)
                </div>
                <div className="text-sm text-gray-500">
                  {stats.users.total} usuarios registrados
                </div>
              </label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
              <input
                id="include-assignments"
                type="checkbox"
                checked={exportOptions.includeAsignaciones}
                onChange={(e) =>
                  updateExportOptions({ includeAsignaciones: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="include-assignments"
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium text-gray-900">Asignaciones</div>
                <div className="text-sm text-gray-500">
                  {stats.assignments.active} asignaciones activas
                </div>
              </label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
              <input
                id="include-phones"
                type="checkbox"
                checked={exportOptions.includeTelefonos}
                onChange={(e) =>
                  updateExportOptions({ includeTelefonos: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="include-phones" className="flex-1 cursor-pointer">
                <div className="font-medium text-gray-900">
                  Teléfonos (sin números reales)
                </div>
                <div className="text-sm text-gray-500">
                  {Object.keys(state.phoneNumbers).length} números registrados
                </div>
              </label>
            </div>
          </div>
        </fieldset>

        {/* Botón de exportación */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            Se respeta la privacidad de datos sensibles
          </div>
          <button
            onClick={exportData}
            disabled={
              isExporting ||
              (!exportOptions.includeTerritorios &&
                !exportOptions.includeUsuarios &&
                !exportOptions.includeAsignaciones &&
                !exportOptions.includeTelefonos)
            }
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isExporting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Exportando...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Exportar Datos</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportTools;
