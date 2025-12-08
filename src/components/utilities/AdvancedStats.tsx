"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";

interface ReadonlyAdvancedStatsProps {
  readonly className?: string;
}

const AdvancedStats: React.FC<ReadonlyAdvancedStatsProps> = ({ className }) => {
  const { state, getStats } = useUnifiedApp();
  const [timeRange, setTimeRange] = useState<
    "week" | "month" | "quarter" | "year"
  >("month");

  const stats = getStats();

  const advancedMetrics = useMemo(() => {
    const territories = Object.values(state.territories);
    const assignments = Object.values(state.assignments);
    const phoneNumbers = Object.values(state.phoneNumbers);
    const users = Object.values(state.users);

    // Cálculos de eficiencia
    const territoriesWithAssignments = territories.filter((t) =>
      assignments.some((a) => a.territoryId === t.id && a.estado === "activo")
    );

    const territoryUtilization =
      territories.length > 0
        ? (territoriesWithAssignments.length / territories.length) * 100
        : 0;

    // Análisis de teléfonos
    const phonesByStatus = phoneNumbers.reduce((acc, phone) => {
      acc[phone.estado] = (acc[phone.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Análisis de usuarios por rol
    const usersByRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Productividad (asignaciones completadas vs activas)
    const completedAssignments = assignments.filter(
      (a) => a.estado === "completado"
    ).length;
    const activeAssignments = assignments.filter(
      (a) => a.estado === "activo"
    ).length;
    const productivity =
      activeAssignments > 0
        ? (completedAssignments / (completedAssignments + activeAssignments)) *
          100
        : 0;

    return {
      territoryUtilization,
      phonesByStatus,
      usersByRole,
      productivity,
      totalBlocks: Object.keys(state.blocks).length,
      totalAddresses: Object.keys(state.addresses).length,
      avgBlocksPerTerritory:
        territories.length > 0
          ? Object.keys(state.blocks).length / territories.length
          : 0,
    };
  }, [state, timeRange]);

  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, string> = {
      "": "bg-gray-100 text-gray-600",
      Colgaron: "bg-red-100 text-red-600",
      Contestaron: "bg-green-100 text-green-600",
      "Buzón de voz": "bg-blue-100 text-blue-600",
      "No contestan": "bg-yellow-100 text-yellow-600",
      "Número incorrecto": "bg-red-100 text-red-600",
      "Teléfono descompuesto": "bg-gray-100 text-gray-600",
      "No llamar": "bg-red-100 text-red-600",
      Revisita: "bg-purple-100 text-purple-600",
      Estudio: "bg-green-100 text-green-600",
    };
    return colors[status] || "bg-gray-100 text-gray-600";
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Time Range Selector */}
      <div className="bg-white rounded-2xl shadow-sm border">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                📊 Estadísticas Avanzadas
              </h2>
              <p className="text-gray-600">
                Análisis detallado del rendimiento del sistema
              </p>
            </div>
            <div className="flex space-x-2">
              {(["week", "month", "quarter", "year"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  {range === "week" && "Semana"}
                  {range === "month" && "Mes"}
                  {range === "quarter" && "Trimestre"}
                  {range === "year" && "Año"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {advancedMetrics.territoryUtilization.toFixed(1)}%
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">
                Utilización Territorial
              </h3>
              <p className="text-sm text-gray-600">
                Territorios con asignaciones activas
              </p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-200 rounded-lg">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-600">
                  {advancedMetrics.productivity.toFixed(1)}%
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">Productividad</h3>
              <p className="text-sm text-gray-600">
                Asignaciones completadas vs activas
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-purple-600">
                  {stats.users.active}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">Usuarios Activos</h3>
              <p className="text-sm text-gray-600">
                De {stats.users.total} registrados
              </p>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-orange-200 rounded-lg">
                  <svg
                    className="w-5 h-5 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-orange-600">
                  {advancedMetrics.avgBlocksPerTerritory.toFixed(1)}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">
                Manzanas/Territorio
              </h3>
              <p className="text-sm text-gray-600">Promedio por territorio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phone Status Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              📞 Estados de Teléfonos
            </h3>
            <p className="text-sm text-gray-600">
              Distribución por estado de llamada
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Object.entries(advancedMetrics.phonesByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const percentage =
                    Object.values(advancedMetrics.phonesByStatus).reduce(
                      (a, b) => a + b,
                      0
                    ) > 0
                      ? (count /
                          Object.values(advancedMetrics.phonesByStatus).reduce(
                            (a, b) => a + b,
                            0
                          )) *
                        100
                      : 0;

                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            status
                          )}`}
                        >
                          {status || "Sin estado"}
                        </span>
                        <span className="text-sm text-gray-600">
                          {count} números
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* User Role Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              👥 Distribución de Roles
            </h3>
            <p className="text-sm text-gray-600">Usuarios por tipo de rol</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(advancedMetrics.usersByRole).map(
                ([role, count]) => {
                  const percentage =
                    stats.users.total > 0
                      ? (count / stats.users.total) * 100
                      : 0;
                  const roleColors: Record<string, string> = {
                    conductor: "bg-blue-500",
                    admin: "bg-green-500",
                    "super-admin": "bg-purple-500",
                  };
                  const roleLabels: Record<string, string> = {
                    conductor: "Conductores",
                    admin: "Administradores",
                    "super-admin": "Super Administradores",
                  };

                  return (
                    <div
                      key={role}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            roleColors[role] || "bg-gray-400"
                          }`}
                        ></div>
                        <span className="font-medium text-gray-900">
                          {roleLabels[role] || role}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">{count}</span>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            💡 Insights del Sistema
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">
                    Utilización de Territorios
                  </h4>
                  <p className="text-sm text-gray-600">
                    {(() => {
                      if (advancedMetrics.territoryUtilization > 80) {
                        return "Excelente aprovechamiento de territorios disponibles";
                      } else if (advancedMetrics.territoryUtilization > 60) {
                        return "Buen uso de territorios, considere asignar más";
                      } else {
                        return "Muchos territorios sin asignar, oportunidad de crecimiento";
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">
                    Rendimiento General
                  </h4>
                  <p className="text-sm text-gray-600">
                    {(() => {
                      if (advancedMetrics.productivity > 70) {
                        return "Excelente productividad en completar asignaciones";
                      } else if (advancedMetrics.productivity > 50) {
                        return "Buena productividad, hay margen de mejora";
                      } else {
                        return "Considere revisar procesos para mejorar eficiencia";
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedStats;
