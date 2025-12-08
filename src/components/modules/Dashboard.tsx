"use client";

import React, { useState, useEffect, useRef } from "react";
import { Territory } from "@/types";
import {
  TOTAL_TERRITORIES,
  MANZANAS_POR_TERRITORIO,
} from "@/lib/firebaseService";

interface DashboardProps {
  territorios: Record<string, Territory>;
  onShowToast: (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => void;
}

// Chart utility - using Chart.js with canvas
const createChart = (
  canvas: HTMLCanvasElement,
  type: "bar" | "line" | "pie",
  data: any,
  options: any
) => {
  // Check if Chart.js is available
  if (typeof window !== "undefined" && (window as any).Chart) {
    const Chart = (window as any).Chart;
    return new Chart(canvas, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options,
      },
    });
  }
  return null;
};

// Load Chart.js script
const loadChartJS = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).Chart) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Chart.js"));
    document.head.appendChild(script);
  });
};

// KPI Card Component
const KPICard = ({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}) => {
  const colorClasses = {
    blue: "from-blue-500/20 to-cyan-500/20 text-cyan-300",
    green: "from-emerald-500/20 to-green-500/20 text-emerald-300",
    amber: "from-amber-500/20 to-orange-500/20 text-amber-300",
    red: "from-red-500/20 to-pink-500/20 text-red-300",
    purple: "from-purple-500/20 to-violet-500/20 text-purple-300",
  };

  return (
    <div className="relative backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6 hover:bg-white/[0.12] hover:border-white/[0.18] transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent rounded-3xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`p-3 rounded-2xl bg-gradient-to-br ${colorClasses[color]}`}
          >
            <span className="text-2xl">{icon}</span>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-white/60 text-sm">{title}</div>
            {subtitle && (
              <div className="text-white/40 text-xs mt-1">{subtitle}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Territory Coverage Chart Component
const TerritoryCoverageChart = ({
  territorios,
  selectedTerritory,
  onTerritorySelect,
}: {
  territorios: Record<string, Territory>;
  selectedTerritory: number | null;
  onTerritorySelect: (territory: number | null) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initChart = async () => {
      if (!canvasRef.current) return;

      try {
        await loadChartJS();

        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        let chartData;
        let chartTitle;

        if (selectedTerritory) {
          // Monthly coverage for specific territory
          chartTitle = `Cobertura Mensual: Territorio ${selectedTerritory}`;
          const territory = territorios[selectedTerritory.toString()];
          const monthlyCounts: Record<string, number> = {};

          if (territory?.historialAsignaciones) {
            territory.historialAsignaciones.forEach((asig) => {
              const month = asig.fechaDevolucion.substring(0, 7);
              monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
            });
          }

          const sortedMonths = Object.keys(monthlyCounts).sort();
          const monthNames = [
            "Ene",
            "Feb",
            "Mar",
            "Abr",
            "May",
            "Jun",
            "Jul",
            "Ago",
            "Sep",
            "Oct",
            "Nov",
            "Dic",
          ];

          chartData = {
            labels: sortedMonths.map((monthKey) => {
              const [year, month] = monthKey.split("-");
              return `${monthNames[parseInt(month) - 1]} ${year}`;
            }),
            datasets: [
              {
                label: "Veces Completado",
                data: sortedMonths.map((month) => monthlyCounts[month]),
                backgroundColor: sortedMonths.map(() => {
                  const r = Math.floor(Math.random() * 200);
                  const g = Math.floor(Math.random() * 200);
                  const b = Math.floor(Math.random() * 200);
                  return `rgba(${r}, ${g}, ${b}, 0.7)`;
                }),
                borderColor: sortedMonths.map(() => {
                  const r = Math.floor(Math.random() * 200);
                  const g = Math.floor(Math.random() * 200);
                  const b = Math.floor(Math.random() * 200);
                  return `rgb(${r}, ${g}, ${b})`;
                }),
                borderWidth: 1,
              },
            ],
          };
        } else {
          // General territory coverage
          chartTitle = "Cobertura General de Territorios";
          const labels = [];
          const data = [];

          for (let i = 1; i <= TOTAL_TERRITORIES; i++) {
            labels.push(`T ${i}`);
            const territory = territorios[i.toString()];
            const count = territory?.historialAsignaciones?.length || 0;
            data.push(count);
          }

          chartData = {
            labels,
            datasets: [
              {
                label: "Veces Completado",
                data,
                backgroundColor: "rgba(96, 165, 250, 0.7)",
                borderColor: "#60a5fa",
                borderWidth: 1,
              },
            ],
          };
        }

        const options = {
          plugins: {
            legend: {
              display: !!selectedTerritory,
              labels: { color: "#f8fafc" },
            },
            title: {
              display: true,
              text: chartTitle,
              color: "#f8fafc",
              font: { size: 16 },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: "#cbd5e1",
                stepSize: 1,
              },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            x: {
              ticks: { color: "#cbd5e1" },
              grid: { color: "transparent" },
            },
          },
        };

        chartRef.current = createChart(
          canvasRef.current,
          "bar",
          chartData,
          options
        );
        setIsLoading(false);
      } catch (error) {
        console.error("Error creating chart:", error);
        setIsLoading(false);
      }
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [territorios, selectedTerritory]);

  return (
    <div className="relative backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent rounded-3xl" />
      <div className="relative z-10">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            Análisis de Cobertura de Territorio
          </h3>
          <div className="flex gap-4 items-center">
            <label className="text-white/80">Seleccionar Territorio:</label>
            <select
              value={selectedTerritory || ""}
              onChange={(e) =>
                onTerritorySelect(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              className="px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">Ver cobertura general</option>
              {Array.from({ length: TOTAL_TERRITORIES }, (_, i) => i + 1).map(
                (num) => (
                  <option
                    key={num}
                    value={num}
                    style={{ color: "#000", background: "#fff" }}
                  >
                    Territorio {num}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {selectedTerritory && (
          <div className="mb-4 p-4 bg-white/5 rounded-2xl">
            <p className="text-lg text-white">
              El Territorio <strong>{selectedTerritory}</strong> se ha
              completado{" "}
              <strong>
                {territorios[selectedTerritory.toString()]
                  ?.historialAsignaciones?.length || 0}
              </strong>{" "}
              veces.
            </p>
          </div>
        )}

        <div className="relative h-80">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-white/70">Cargando gráfico...</span>
            </div>
          ) : (
            <canvas ref={canvasRef} className="w-full h-full"></canvas>
          )}
        </div>
      </div>
    </div>
  );
};

// Territory Status Distribution Chart
const TerritoryStatusChart = ({
  territorios,
}: {
  territorios: Record<string, Territory>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initChart = async () => {
      if (!canvasRef.current) return;

      try {
        await loadChartJS();

        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        // Calculate status distribution
        let assigned = 0,
          completed = 0,
          available = 0;

        for (let i = 1; i <= TOTAL_TERRITORIES; i++) {
          const territory = territorios[i.toString()];
          if (territory) {
            const activeAssignments =
              territory.asignaciones?.filter((a) => a.estado === "activo") ||
              [];
            if (activeAssignments.length > 0) {
              assigned++;
            } else if (territory.historialAsignaciones?.length > 0) {
              completed++;
            } else {
              available++;
            }
          } else {
            available++;
          }
        }

        const chartData = {
          labels: ["Asignados", "Completados", "Disponibles"],
          datasets: [
            {
              data: [assigned, completed, available],
              backgroundColor: [
                "rgba(251, 191, 36, 0.8)", // amber for assigned
                "rgba(34, 197, 94, 0.8)", // green for completed
                "rgba(148, 163, 184, 0.8)", // gray for available
              ],
              borderColor: [
                "rgb(251, 191, 36)",
                "rgb(34, 197, 94)",
                "rgb(148, 163, 184)",
              ],
              borderWidth: 2,
            },
          ],
        };

        const options = {
          plugins: {
            legend: {
              labels: { color: "#f8fafc" },
              position: "bottom" as const,
            },
            title: {
              display: true,
              text: "Estado de Territorios",
              color: "#f8fafc",
              font: { size: 16 },
            },
          },
        };

        chartRef.current = createChart(
          canvasRef.current,
          "pie",
          chartData,
          options
        );
        setIsLoading(false);
      } catch (error) {
        console.error("Error creating status chart:", error);
        setIsLoading(false);
      }
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [territorios]);

  return (
    <div className="relative backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent rounded-3xl" />
      <div className="relative z-10">
        <div className="relative h-80">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-white/70">Cargando gráfico...</span>
            </div>
          ) : (
            <canvas ref={canvasRef} className="w-full h-full"></canvas>
          )}
        </div>
      </div>
    </div>
  );
};

// Progress History Chart
const ProgressHistoryChart = ({
  territorios,
}: {
  territorios: Record<string, Territory>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initChart = async () => {
      if (!canvasRef.current) return;

      try {
        await loadChartJS();

        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        // Calculate monthly progress over the last 12 months
        const monthlyProgress: Record<string, number> = {};
        const now = new Date();

        // Initialize last 12 months
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          const monthKey = date.toISOString().slice(0, 7);
          monthlyProgress[monthKey] = 0;
        }

        // Count completions by month
        Object.values(territorios).forEach((territory) => {
          territory.historialAsignaciones?.forEach((asig) => {
            const month = asig.fechaDevolucion.substring(0, 7);
            if (monthlyProgress.hasOwnProperty(month)) {
              monthlyProgress[month]++;
            }
          });
        });

        const sortedMonths = Object.keys(monthlyProgress).sort();
        const monthNames = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ];

        const chartData = {
          labels: sortedMonths.map((monthKey) => {
            const [year, month] = monthKey.split("-");
            return `${monthNames[parseInt(month) - 1]} ${year}`;
          }),
          datasets: [
            {
              label: "Territorios Completados",
              data: sortedMonths.map((month) => monthlyProgress[month]),
              backgroundColor: "rgba(96, 165, 250, 0.2)",
              borderColor: "rgb(96, 165, 250)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        };

        const options = {
          plugins: {
            legend: {
              labels: { color: "#f8fafc" },
            },
            title: {
              display: true,
              text: "Progreso Mensual (Últimos 12 meses)",
              color: "#f8fafc",
              font: { size: 16 },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: "#cbd5e1",
                stepSize: 1,
              },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            x: {
              ticks: { color: "#cbd5e1" },
              grid: { color: "transparent" },
            },
          },
        };

        chartRef.current = createChart(
          canvasRef.current,
          "line",
          chartData,
          options
        );
        setIsLoading(false);
      } catch (error) {
        console.error("Error creating progress chart:", error);
        setIsLoading(false);
      }
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [territorios]);

  return (
    <div className="relative backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent rounded-3xl" />
      <div className="relative z-10">
        <div className="relative h-80">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-white/70">Cargando gráfico...</span>
            </div>
          ) : (
            <canvas ref={canvasRef} className="w-full h-full"></canvas>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
export const Dashboard: React.FC<DashboardProps> = ({
  territorios,
  onShowToast,
}) => {
  const [selectedTerritory, setSelectedTerritory] = useState<number | null>(
    null
  );

  // Calculate KPIs
  const calculateKPIs = () => {
    let assigned = 0,
      completed = 0,
      totalProgress = 0,
      territoriesWithProgress = 0;

    for (let i = 1; i <= TOTAL_TERRITORIES; i++) {
      const territory = territorios[i.toString()];
      if (territory) {
        const activeAssignments =
          territory.asignaciones?.filter((a) => a.estado === "activo") || [];
        if (activeAssignments.length > 0) {
          assigned++;
          const totalManzanas = MANZANAS_POR_TERRITORIO[i] || 1;
          const assignedManzanas = activeAssignments.reduce(
            (acc, a) => acc + (a.manzanas?.length || 0),
            0
          );
          totalProgress += assignedManzanas / totalManzanas;
          territoriesWithProgress++;
        } else if (territory.historialAsignaciones?.length > 0) {
          completed++;
        }
      }
    }

    const averageProgress =
      territoriesWithProgress > 0
        ? Math.round((totalProgress / territoriesWithProgress) * 100)
        : 0;

    return { assigned, completed, averageProgress };
  };

  const { assigned, completed, averageProgress } = calculateKPIs();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">
          Dashboard Administrativo
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Territorios Asignados"
            value={assigned}
            icon="🎯"
            color="amber"
          />
          <KPICard
            title="Territorios Completados"
            value={completed}
            icon="✅"
            color="green"
          />
          <KPICard
            title="Progreso Promedio"
            value={`${averageProgress}%`}
            icon="📈"
            color="blue"
          />
        </div>
      </div>

      {/* Territory Coverage Analysis */}
      <TerritoryCoverageChart
        territorios={territorios}
        selectedTerritory={selectedTerritory}
        onTerritorySelect={setSelectedTerritory}
      />

      {/* Additional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TerritoryStatusChart territorios={territorios} />
        <ProgressHistoryChart territorios={territorios} />
      </div>

      {/* Territory Summary Table */}
      <div className="relative backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent rounded-3xl" />
        <div className="relative z-10">
          <div className="p-6 border-b border-white/10">
            <h3 className="text-xl font-semibold text-white">
              Resumen Rápido por Territorio
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: TOTAL_TERRITORIES }, (_, i) => i + 1).map(
                (territoryNum) => {
                  const territory = territorios[territoryNum.toString()];
                  const activeAssignments =
                    territory?.asignaciones?.filter(
                      (a) => a.estado === "activo"
                    ) || [];
                  const historyCount =
                    territory?.historialAsignaciones?.length || 0;

                  let status = "Disponible";
                  let statusColor = "bg-white/10";

                  if (activeAssignments.length > 0) {
                    status = "Asignado";
                    statusColor = "bg-amber-500/20 border-amber-400/40";
                  } else if (historyCount > 0) {
                    status = "Completado";
                    statusColor = "bg-emerald-500/20 border-emerald-400/40";
                  }

                  return (
                    <div
                      key={territoryNum}
                      className={`p-4 rounded-2xl border ${statusColor} text-center transition-all hover:scale-105 cursor-pointer`}
                      onClick={() => setSelectedTerritory(territoryNum)}
                    >
                      <div className="text-lg font-bold text-white mb-1">
                        T{territoryNum}
                      </div>
                      <div className="text-xs text-white/70">{status}</div>
                      <div className="text-xs text-white/50">
                        {historyCount}x
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
