import React, { useState, useMemo } from "react";
import {
  usePerformanceMonitoring,
  PerformanceMetrics,
  PerformanceAlert,
} from "../../hooks/usePerformanceMonitoring";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: "good" | "warning" | "critical";
  description: string;
  trend?: "up" | "down" | "stable";
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  status,
  description,
  trend,
}) => {
  const statusColors = {
    good: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    critical: "bg-red-50 border-red-200 text-red-800",
  };

  const trendIcons = {
    up: "↗️",
    down: "↘️",
    stable: "→",
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 ${statusColors[status]} transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        {trend && (
          <span className="text-lg" title={`Trend: ${trend}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <div className="flex items-baseline space-x-1 mb-2">
        <span className="text-2xl font-bold">
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-sm opacity-75">{unit}</span>}
      </div>
      <p className="text-xs opacity-75">{description}</p>
    </div>
  );
};

interface AlertItemProps {
  alert: PerformanceAlert;
  onDismiss: (id: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onDismiss }) => {
  const alertColors = {
    warning: "bg-yellow-100 border-yellow-400 text-yellow-800",
    error: "bg-orange-100 border-orange-400 text-orange-800",
    critical: "bg-red-100 border-red-400 text-red-800",
  };

  const alertIcons = {
    warning: "⚠️",
    error: "🚨",
    critical: "🔥",
  };

  return (
    <div
      className={`p-3 rounded-lg border-l-4 ${
        alertColors[alert.type]
      } mb-2 last:mb-0`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-2">
          <span className="text-lg">{alertIcons[alert.type]}</span>
          <div>
            <p className="font-medium text-sm">{alert.message}</p>
            <p className="text-xs opacity-75 mt-1">
              {alert.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="text-lg opacity-50 hover:opacity-100 transition-opacity"
          title="Dismiss alert"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const PerformanceDashboard: React.FC = () => {
  const { metrics, alerts, isMonitoring, clearAlerts } =
    usePerformanceMonitoring();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set()
  );

  const getMetricStatus = (
    value: number | null,
    thresholds: { good: number; warning: number }
  ): "good" | "warning" | "critical" => {
    if (value === null) return "good";
    if (value <= thresholds.good) return "good";
    if (value <= thresholds.warning) return "warning";
    return "critical";
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const activeAlerts = useMemo(() => {
    return alerts.filter((alert) => !dismissedAlerts.has(alert.id));
  }, [alerts, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => {
      const newSet = new Set(prev);
      newSet.add(alertId);
      return newSet;
    });
  };

  if (!isMonitoring || !metrics) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Inicializando monitoreo de rendimiento...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Performance Dashboard
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Monitoreo en tiempo real - Última actualización:{" "}
            {metrics.timestamp.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Activo</span>
          </div>
          {activeAlerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors"
            >
              Limpiar Alertas ({activeAlerts.length})
            </button>
          )}
        </div>
      </div>

      {/* Alertas Críticas */}
      {activeAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            🚨 Alertas Activas
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              {activeAlerts.length}
            </span>
          </h3>
          <div className="max-h-40 overflow-y-auto">
            {activeAlerts.slice(0, 5).map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onDismiss={handleDismissAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Core Web Vitals */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">📊 Core Web Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="LCP"
            value={metrics.lcp || 0}
            unit="ms"
            status={getMetricStatus(metrics.lcp, { good: 2500, warning: 4000 })}
            description="Largest Contentful Paint"
          />
          <MetricCard
            title="FID"
            value={metrics.fid || 0}
            unit="ms"
            status={getMetricStatus(metrics.fid, { good: 100, warning: 300 })}
            description="First Input Delay"
          />
          <MetricCard
            title="CLS"
            value={metrics.cls || 0}
            status={getMetricStatus(metrics.cls, { good: 0.1, warning: 0.25 })}
            description="Cumulative Layout Shift"
          />
          <MetricCard
            title="FCP"
            value={metrics.fcp || 0}
            unit="ms"
            status={getMetricStatus(metrics.fcp, { good: 1800, warning: 3000 })}
            description="First Contentful Paint"
          />
          <MetricCard
            title="TTFB"
            value={metrics.ttfb || 0}
            unit="ms"
            status={getMetricStatus(metrics.ttfb, { good: 600, warning: 1500 })}
            description="Time to First Byte"
          />
        </div>
      </div>

      {/* Métricas de Sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memoria y Rendimiento */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">
            💾 Memoria y Rendimiento
          </h3>
          <div className="space-y-4">
            <MetricCard
              title="Uso de Memoria JS"
              value={metrics.memoryUsagePercent}
              unit="%"
              status={getMetricStatus(metrics.memoryUsagePercent, {
                good: 70,
                warning: 85,
              })}
              description={`${formatBytes(
                metrics.usedJSMemory
              )} / ${formatBytes(metrics.totalJSMemory)}`}
            />
            <MetricCard
              title="Tiempo de Carga"
              value={metrics.pageLoadTime}
              unit="ms"
              status={getMetricStatus(metrics.pageLoadTime, {
                good: 3000,
                warning: 5000,
              })}
              description="Tiempo total de carga de la página"
            />
            <MetricCard
              title="Tiempo en Página"
              value={formatTime(metrics.timeOnPage)}
              status="good"
              description="Tiempo que el usuario ha estado en la página"
            />
          </div>
        </div>

        {/* Conectividad y Errores */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">
            🌐 Conectividad y Errores
          </h3>
          <div className="space-y-4">
            <MetricCard
              title="Tipo de Conexión"
              value={metrics.effectiveType.toUpperCase()}
              status="good"
              description={`${metrics.connectionType} - ${metrics.downlink} Mbps`}
            />
            <MetricCard
              title="Latencia (RTT)"
              value={metrics.rtt}
              unit="ms"
              status={getMetricStatus(metrics.rtt, { good: 100, warning: 300 })}
              description="Round Trip Time de la conexión"
            />
            <MetricCard
              title="Errores Detectados"
              value={metrics.errorCount}
              status={
                metrics.errorCount === 0
                  ? "good"
                  : metrics.errorCount < 5
                  ? "warning"
                  : "critical"
              }
              description={
                metrics.lastErrorTime
                  ? `Último error: ${metrics.lastErrorTime.toLocaleTimeString()}`
                  : "Sin errores detectados"
              }
            />
          </div>
        </div>
      </div>

      {/* Métricas de Usuario */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">👥 Métricas de Usuario</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Usuarios Activos"
            value={metrics.activeUsers}
            status="good"
            description="Usuarios activos en tiempo real"
          />
          <MetricCard
            title="Tasa de Rebote"
            value={metrics.bounceRate}
            unit="%"
            status={getMetricStatus(metrics.bounceRate, {
              good: 40,
              warning: 70,
            })}
            description="Porcentaje de usuarios que salen inmediatamente"
          />
          <MetricCard
            title="Sesión Promedio"
            value={formatTime(metrics.timeOnPage)}
            status="good"
            description="Duración promedio de la sesión"
          />
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-lg mb-3 text-blue-800">
          💡 Recomendaciones de Optimización
        </h3>
        <div className="space-y-2 text-sm text-blue-700">
          {metrics.lcp && metrics.lcp > 2500 && (
            <p>
              • Optimizar LCP: Considera lazy loading de imágenes y optimización
              de servidor
            </p>
          )}
          {metrics.fid && metrics.fid > 100 && (
            <p>
              • Mejorar FID: Reduce el trabajo del hilo principal y optimiza
              JavaScript
            </p>
          )}
          {metrics.cls && metrics.cls > 0.1 && (
            <p>
              • Reducir CLS: Define dimensiones para imágenes y evita contenido
              dinámico arriba del fold
            </p>
          )}
          {metrics.memoryUsagePercent > 80 && (
            <p>
              • Optimizar memoria: Considera implementar virtual scrolling y
              limpieza de listeners
            </p>
          )}
          {metrics.errorCount > 0 && (
            <p>
              • Revisar errores: {metrics.errorCount} errores detectados
              requieren atención
            </p>
          )}
          {metrics.rtt > 200 && (
            <p>
              • Optimizar para conexiones lentas: Implementa service workers y
              cache agresivo
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
