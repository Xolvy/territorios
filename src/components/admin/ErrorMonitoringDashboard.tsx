import React, { useState, useMemo } from "react";
import {
  useErrorMonitoring,
  ErrorReport,
  ErrorStats,
} from "../../hooks/useErrorMonitoring";

interface ErrorItemProps {
  error: ErrorReport;
  onResolve: (errorId: string) => void;
  onShowDetails: (error: ErrorReport) => void;
}

const ErrorItem: React.FC<ErrorItemProps> = ({
  error,
  onResolve,
  onShowDetails,
}) => {
  const severityColors = {
    low: "bg-blue-50 border-blue-200 text-blue-800",
    medium: "bg-yellow-50 border-yellow-200 text-yellow-800",
    high: "bg-orange-50 border-orange-200 text-orange-800",
    critical: "bg-red-50 border-red-200 text-red-800",
  };

  const severityIcons = {
    low: "ℹ️",
    medium: "⚠️",
    high: "🚨",
    critical: "🔥",
  };

  const typeIcons = {
    javascript: "🐛",
    promise: "🔄",
    network: "🌐",
    custom: "⚙️",
  };

  return (
    <div
      className={`p-4 rounded-lg border ${severityColors[error.severity]} ${
        error.resolved ? "opacity-50" : ""
      } transition-all duration-300`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{severityIcons[error.severity]}</span>
          <span className="text-lg">{typeIcons[error.type]}</span>
          <span className="font-semibold text-sm uppercase">
            {error.severity}
          </span>
          {error.occurenceCount > 1 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              {error.occurenceCount}x
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {error.timestamp.toLocaleTimeString()}
          </span>
          {!error.resolved && (
            <button
              onClick={() => onResolve(error.id)}
              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
            >
              Resolver
            </button>
          )}
        </div>
      </div>

      <div className="mb-2">
        <p className="font-medium text-sm mb-1">{error.message}</p>
        {error.filename && (
          <p className="text-xs opacity-75">
            📁 {error.filename}:{error.lineno}:{error.colno}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2 py-1 bg-gray-100 rounded">{error.type}</span>
          <span className="opacity-75">
            Session: {error.sessionId.slice(-8)}
          </span>
        </div>
        <button
          onClick={() => onShowDetails(error)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Ver detalles
        </button>
      </div>
    </div>
  );
};

interface ErrorDetailsModalProps {
  error: ErrorReport | null;
  onClose: () => void;
}

const ErrorDetailsModal: React.FC<ErrorDetailsModalProps> = ({
  error,
  onClose,
}) => {
  if (!error) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-bold">Detalles del Error</h3>
            <button
              onClick={onClose}
              className="text-2xl opacity-50 hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información básica */}
            <div>
              <h4 className="font-semibold mb-3">Información Básica</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>ID:</strong> {error.id}
                </div>
                <div>
                  <strong>Mensaje:</strong> {error.message}
                </div>
                <div>
                  <strong>Tipo:</strong> {error.type}
                </div>
                <div>
                  <strong>Severidad:</strong> {error.severity}
                </div>
                <div>
                  <strong>Ocurrencias:</strong> {error.occurenceCount}
                </div>
                <div>
                  <strong>Timestamp:</strong> {error.timestamp.toLocaleString()}
                </div>
                <div>
                  <strong>Resuelto:</strong> {error.resolved ? "Sí" : "No"}
                </div>
              </div>
            </div>

            {/* Información técnica */}
            <div>
              <h4 className="font-semibold mb-3">Información Técnica</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>URL:</strong> {error.url}
                </div>
                <div>
                  <strong>Archivo:</strong> {error.filename || "N/A"}
                </div>
                <div>
                  <strong>Línea:</strong> {error.lineno || "N/A"}
                </div>
                <div>
                  <strong>Columna:</strong> {error.colno || "N/A"}
                </div>
                <div>
                  <strong>Sesión:</strong> {error.sessionId}
                </div>
                <div>
                  <strong>User Agent:</strong>
                  <div className="text-xs mt-1 p-2 bg-gray-100 rounded break-all">
                    {error.userAgent}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stack Trace */}
          {error.stack && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Stack Trace</h4>
              <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
                {error.stack}
              </pre>
            </div>
          )}

          {/* Contexto adicional */}
          {error.context && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Contexto Adicional</h4>
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-x-auto">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: "blue" | "green" | "yellow" | "red";
  description?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  description,
}) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    red: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div
      className={`p-4 rounded-lg border ${colorClasses[color]} transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      {description && <p className="text-xs opacity-75">{description}</p>}
    </div>
  );
};

const ErrorMonitoringDashboard: React.FC = () => {
  const { errors, stats, markAsResolved, clearAllErrors, exportErrors } =
    useErrorMonitoring();
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);

  const filteredErrors = useMemo(() => {
    return errors.filter((error) => {
      if (filterSeverity !== "all" && error.severity !== filterSeverity)
        return false;
      if (filterType !== "all" && error.type !== filterType) return false;
      if (!showResolved && error.resolved) return false;
      return true;
    });
  }, [errors, filterSeverity, filterType, showResolved]);

  const handleExportErrors = () => {
    const data = exportErrors();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-report-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Error Monitoring Dashboard
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Monitoreo automático de errores en tiempo real
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportErrors}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            📄 Exportar
          </button>
          <button
            onClick={clearAllErrors}
            className="px-3 py-2 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors"
          >
            🗑️ Limpiar Todo
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Errores"
          value={stats.totalErrors}
          icon="📊"
          color="blue"
          description="Errores registrados en esta sesión"
        />
        <StatsCard
          title="Sin Resolver"
          value={stats.unresolvedErrors}
          icon="⚠️"
          color={stats.unresolvedErrors > 0 ? "red" : "green"}
          description="Errores que requieren atención"
        />
        <StatsCard
          title="Tasa de Errores"
          value={stats.errorRate}
          icon="⏱️"
          color={
            stats.errorRate > 5
              ? "red"
              : stats.errorRate > 2
              ? "yellow"
              : "green"
          }
          description="Errores por minuto"
        />
        <StatsCard
          title="Tipos de Error"
          value={Object.keys(stats.errorsByType).length}
          icon="🏷️"
          color="blue"
          description="Diferentes tipos de errores"
        />
      </div>

      {/* Distribución de errores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Severidad */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">
            📈 Errores por Severidad
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.errorsBySeverity).map(([severity, count]) => (
              <div key={severity} className="flex justify-between items-center">
                <span className="capitalize font-medium">{severity}</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Por Tipo */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">🏷️ Errores por Tipo</h3>
          <div className="space-y-3">
            {Object.entries(stats.errorsByType).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="capitalize font-medium">{type}</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Errores */}
      {stats.topErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">
            🔥 Errores Más Frecuentes
          </h3>
          <div className="space-y-3">
            {stats.topErrors.slice(0, 5).map((error, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-50 rounded"
              >
                <div className="flex-1 mr-4">
                  <p className="font-medium text-sm truncate">
                    {error.message}
                  </p>
                  <p className="text-xs text-gray-500">
                    Último: {error.lastSeen.toLocaleTimeString()}
                  </p>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  {error.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center space-x-4 space-y-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Severidad:</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="all">Todas</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Tipo:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="all">Todos</option>
              <option value="javascript">JavaScript</option>
              <option value="promise">Promise</option>
              <option value="network">Network</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Mostrar resueltos</span>
          </label>

          <div className="text-sm text-gray-500">
            Mostrando {filteredErrors.length} de {errors.length} errores
          </div>
        </div>
      </div>

      {/* Lista de Errores */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">📋 Lista de Errores</h3>
        {filteredErrors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">🎉 No hay errores que mostrar</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {filteredErrors.map((error) => (
              <ErrorItem
                key={error.id}
                error={error}
                onResolve={markAsResolved}
                onShowDetails={setSelectedError}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      <ErrorDetailsModal
        error={selectedError}
        onClose={() => setSelectedError(null)}
      />
    </div>
  );
};

export default ErrorMonitoringDashboard;
