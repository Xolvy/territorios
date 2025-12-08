import React, { useState } from "react";
import {
  useEnterpriseScalability,
  ScalabilityAlert,
  ScalabilityRecommendation,
} from "../../hooks/useEnterpriseScalability";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: "healthy" | "warning" | "critical" | "emergency";
  trend?: "up" | "down" | "stable";
  icon: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  status,
  trend,
  icon,
  subtitle,
}) => {
  const statusColors = {
    healthy: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    critical: "bg-red-50 border-red-200 text-red-800",
    emergency: "bg-purple-50 border-purple-200 text-purple-800",
  };

  const trendIcons = {
    up: "📈",
    down: "📉",
    stable: "➡️",
  };

  const statusIcons = {
    healthy: "✅",
    warning: "⚠️",
    critical: "🚨",
    emergency: "🔥",
  };

  return (
    <div
      className={`p-4 rounded-lg border ${statusColors[status]} transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{icon}</span>
          <span className="text-lg">{statusIcons[status]}</span>
        </div>
        {trend && (
          <span className="text-lg" title={`Trend: ${trend}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <div className="mb-2">
        <div className="text-2xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
          {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
        </div>
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      {subtitle && <p className="text-xs opacity-75">{subtitle}</p>}
    </div>
  );
};

interface NodeHealthCardProps {
  nodeName: string;
  health: {
    cpu: number;
    memory: number;
    responseTime: number;
    requestsPerSecond: number;
    status: "healthy" | "warning" | "critical";
  };
}

const NodeHealthCard: React.FC<NodeHealthCardProps> = ({
  nodeName,
  health,
}) => {
  const statusColors = {
    healthy: "border-green-300",
    warning: "border-yellow-300",
    critical: "border-red-300",
  };

  const statusIcons = {
    healthy: "🟢",
    warning: "🟡",
    critical: "🔴",
  };

  return (
    <div
      className={`bg-white rounded-lg p-4 border-2 ${
        statusColors[health.status]
      } shadow-sm`}
    >
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-sm">{nodeName}</h4>
        <span className="text-lg">{statusIcons[health.status]}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">CPU</span>
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  health.cpu > 80
                    ? "bg-red-500"
                    : health.cpu > 65
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(health.cpu, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold w-10 text-right">
              {health.cpu.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Memory</span>
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  health.memory > 85
                    ? "bg-red-500"
                    : health.memory > 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(health.memory, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold w-10 text-right">
              {health.memory.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Response:</span>
          <span className="font-semibold">
            {health.responseTime.toFixed(0)}ms
          </span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-gray-600">RPS:</span>
          <span className="font-semibold">
            {health.requestsPerSecond.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface AlertItemProps {
  alert: ScalabilityAlert;
  onDismiss: (alertId: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onDismiss }) => {
  const severityColors = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    critical: "bg-red-50 border-red-200 text-red-800",
    emergency: "bg-purple-50 border-purple-200 text-purple-800",
  };

  const severityIcons = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
    emergency: "🔥",
  };

  return (
    <div
      className={`p-3 rounded-lg border ${severityColors[alert.severity]} mb-3`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-2 flex-1">
          <span className="text-lg">{severityIcons[alert.severity]}</span>
          <div>
            <h4 className="font-semibold text-sm">{alert.title}</h4>
            <p className="text-sm mt-1">{alert.message}</p>
            {alert.autoRemediation && (
              <p className="text-xs mt-2 opacity-80">
                <strong>Auto-remediation:</strong> {alert.autoRemediation}
              </p>
            )}
            <div className="flex items-center space-x-2 mt-2 text-xs opacity-75">
              <span>{alert.type}</span>
              <span>•</span>
              <span>{alert.timestamp.toLocaleTimeString()}</span>
              {alert.node && (
                <>
                  <span>•</span>
                  <span>{alert.node}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="text-lg opacity-50 hover:opacity-100 transition-opacity ml-2"
        >
          ×
        </button>
      </div>
    </div>
  );
};

interface RecommendationCardProps {
  recommendation: ScalabilityRecommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
}) => {
  const priorityColors = {
    low: "bg-blue-50 border-blue-200",
    medium: "bg-yellow-50 border-yellow-200",
    high: "bg-orange-50 border-orange-200",
    critical: "bg-red-50 border-red-200",
  };

  const categoryIcons = {
    scaling: "📈",
    optimization: "⚡",
    architecture: "🏗️",
    monitoring: "📊",
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        priorityColors[recommendation.priority]
      } mb-4`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">
            {categoryIcons[recommendation.category]}
          </span>
          <h4 className="font-semibold text-sm">{recommendation.title}</h4>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            recommendation.priority === "critical"
              ? "bg-red-100 text-red-700"
              : recommendation.priority === "high"
              ? "bg-orange-100 text-orange-700"
              : recommendation.priority === "medium"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {recommendation.priority}
        </span>
      </div>

      <p className="text-sm mb-3">{recommendation.description}</p>

      <div className="space-y-2 text-xs">
        <div>
          <strong>Impact:</strong> {recommendation.impact}
        </div>
        <div>
          <strong>Implementation:</strong> {recommendation.implementation}
        </div>
        <div className="flex justify-between">
          <span>
            <strong>Cost:</strong> {recommendation.estimatedCost}
          </span>
          <span>
            <strong>Time:</strong> {recommendation.timeframe}
          </span>
        </div>
      </div>
    </div>
  );
};

const EnterpriseScalabilityDashboard: React.FC = () => {
  const {
    metrics,
    alerts,
    recommendations,
    simulateLoad,
    dismissAlert,
    getScalabilityScore,
    isLoading,
  } = useEnterpriseScalability();

  const [loadTestUsers, setLoadTestUsers] = useState(100);

  if (isLoading || !metrics) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Inicializando monitoreo de escalabilidad...
          </p>
        </div>
      </div>
    );
  }

  const scalabilityScore = getScalabilityScore();
  const scoreColor =
    scalabilityScore >= 80
      ? "text-green-600"
      : scalabilityScore >= 60
      ? "text-yellow-600"
      : "text-red-600";
  const scoreBg =
    scalabilityScore >= 80
      ? "bg-green-50 border-green-200"
      : scalabilityScore >= 60
      ? "bg-yellow-50 border-yellow-200"
      : "bg-red-50 border-red-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Enterprise Scalability Dashboard
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Monitoreo de escalabilidad para miles de usuarios concurrentes
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`px-4 py-2 rounded-lg border ${scoreBg}`}>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Scalability Score:</span>
              <span className={`text-xl font-bold ${scoreColor}`}>
                {scalabilityScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Load Testing */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">
          🧪 Load Testing Simulator
        </h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Simular Usuarios:</label>
            <input
              type="number"
              value={loadTestUsers}
              onChange={(e) => setLoadTestUsers(Number(e.target.value))}
              className="px-3 py-2 border rounded-md w-20 text-sm"
              min="1"
              max="2000"
            />
          </div>
          <button
            onClick={() => simulateLoad(loadTestUsers)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            🚀 Simular Carga
          </button>
          <div className="text-sm text-gray-600">
            Usuarios actuales:{" "}
            <strong>{metrics.concurrentUsers.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            🚨 Alertas Críticas
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              {alerts.length}
            </span>
          </h3>
          <div className="max-h-64 overflow-y-auto">
            {alerts.slice(0, 5).map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onDismiss={dismissAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Usuarios Concurrentes"
          value={metrics.concurrentUsers}
          status={
            metrics.concurrentUsers > 500
              ? "critical"
              : metrics.concurrentUsers > 200
              ? "warning"
              : "healthy"
          }
          icon="👥"
          subtitle={`Máximo: ${metrics.maxConcurrentUsers}`}
        />

        <MetricCard
          title="Nodos Activos"
          value={metrics.activeNodes}
          status="healthy"
          icon="🖥️"
          subtitle={`${
            Object.values(metrics.nodeHealth).filter(
              (n) => n.status === "healthy"
            ).length
          }/${metrics.activeNodes} saludables`}
        />

        <MetricCard
          title="Cache Hit Rate"
          value={metrics.cacheHitRate.toFixed(1)}
          unit="%"
          status={
            metrics.cacheHitRate < 80
              ? "critical"
              : metrics.cacheHitRate < 90
              ? "warning"
              : "healthy"
          }
          icon="💾"
          subtitle={`${metrics.cacheNodes} nodos de cache`}
        />

        <MetricCard
          title="DB Connections"
          value={`${metrics.dbConnections}/${metrics.maxDbConnections}`}
          status={
            metrics.dbConnections / metrics.maxDbConnections > 0.9
              ? "critical"
              : metrics.dbConnections / metrics.maxDbConnections > 0.8
              ? "warning"
              : "healthy"
          }
          icon="🗄️"
          subtitle={`${metrics.queryResponseTime.toFixed(0)}ms avg response`}
        />
      </div>

      {/* Node Health Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">🖥️ Estado de Nodos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(metrics.nodeHealth).map(([nodeName, health]) => (
            <NodeHealthCard
              key={nodeName}
              nodeName={nodeName}
              health={health}
            />
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">📊 Métricas de Sistema</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">CPU Promedio</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{ width: `${metrics.cpuUsage}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-12 text-right">
                  {metrics.cpuUsage.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Memoria Cache</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{ width: `${metrics.cacheMemoryUsage}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-12 text-right">
                  {metrics.cacheMemoryUsage.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Uso de Disco</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-500 h-3 rounded-full"
                    style={{ width: `${metrics.diskUsage}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-12 text-right">
                  {metrics.diskUsage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">🌐 Red y Conectividad</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Ancho de Banda:</span>
              <span className="text-sm font-bold">
                {metrics.bandwidth.toFixed(0)} Mbps
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Latencia:</span>
              <span className="text-sm font-bold">
                {metrics.latency.toFixed(1)} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Pérdida de Paquetes:</span>
              <span className="text-sm font-bold">
                {metrics.packetLoss.toFixed(3)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">
                Retraso de Replicación:
              </span>
              <span className="text-sm font-bold">
                {metrics.dbReplicationLag.toFixed(1)} ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">
          💡 Recomendaciones de Escalabilidad
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recommendations.map((rec, index) => (
            <RecommendationCard key={index} recommendation={rec} />
          ))}
        </div>
      </div>

      {/* Architecture Overview */}
      <div className={`rounded-lg p-6 border ${scoreBg}`}>
        <h3 className="font-semibold text-lg mb-4">
          🏗️ Arquitectura Actual vs Objetivo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">✅ Implementado:</h4>
            <ul className="text-sm space-y-2">
              <li>• Lazy loading y code splitting</li>
              <li>• Monitoreo en tiempo real</li>
              <li>• Cache inteligente con TTL</li>
              <li>• Error tracking automático</li>
              <li>• Analytics avanzado de usuarios</li>
              <li>• Optimización de bundle</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-3">🎯 Próximo Nivel:</h4>
            <ul className="text-sm space-y-2">
              <li>• Auto-scaling horizontal</li>
              <li>• Redis cluster distribuido</li>
              <li>• Database read replicas</li>
              <li>• CDN global para assets</li>
              <li>• Observabilidad avanzada</li>
              <li>• Circuit breakers y fallbacks</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">
            📈 Capacidad Actual vs Objetivo
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {metrics.concurrentUsers}
              </div>
              <div className="text-blue-700">Usuarios Actuales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">5,000</div>
              <div className="text-green-700">Capacidad Objetivo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">50,000</div>
              <div className="text-purple-700">Potencial Máximo</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseScalabilityDashboard;
