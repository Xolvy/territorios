import React, { useState, useMemo } from "react";
import {
  useAdvancedAnalytics,
  AnalyticsMetrics,
  ConversionGoal,
} from "../../hooks/useAdvancedAnalytics";

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  format?: "number" | "percentage" | "duration" | "currency";
  icon: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "stable";
  };
  color?: "blue" | "green" | "yellow" | "red" | "purple";
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  format = "number",
  icon,
  trend,
  color = "blue",
}) => {
  const formatValue = (val: number): string => {
    switch (format) {
      case "percentage":
        return `${val.toFixed(1)}%`;
      case "duration":
        if (val < 1000) return `${val.toFixed(0)}ms`;
        if (val < 60000) return `${(val / 1000).toFixed(1)}s`;
        return `${(val / 60000).toFixed(1)}m`;
      case "currency":
        return `$${val.toFixed(2)}`;
      default:
        return val.toLocaleString();
    }
  };

  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    red: "bg-red-50 border-red-200 text-red-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  };

  const trendIcons = {
    up: "📈",
    down: "📉",
    stable: "➡️",
  };

  return (
    <div
      className={`p-4 rounded-lg border ${colorClasses[color]} transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <div className="flex items-center text-xs">
            <span>{trendIcons[trend.direction]}</span>
            <span className="ml-1">{trend.value.toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="mb-2">
        <div className="text-2xl font-bold">
          {formatValue(value)}
          {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
        </div>
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
    </div>
  );
};

interface ChartProps {
  data: Record<string, number>;
  title: string;
  type: "bar" | "line" | "pie";
}

const SimpleChart: React.FC<ChartProps> = ({ data, title, type }) => {
  const entries = Object.entries(data);
  const maxValue = Math.max(...entries.map(([, value]) => value));

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">
          No hay datos disponibles
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="font-semibold text-lg mb-4">{title}</h3>
      <div className="space-y-3">
        {entries.slice(0, 10).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm font-medium truncate mr-4">{key}</span>
            <div className="flex items-center space-x-2">
              <div className="flex-1 min-w-20">
                <div className="bg-gray-200 rounded-full h-3 relative">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold min-w-12 text-right">
                {value.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface GoalManagerProps {
  goals: ConversionGoal[];
  onAddGoal: (goal: ConversionGoal) => void;
  onRemoveGoal: (goalId: string) => void;
}

const GoalManager: React.FC<GoalManagerProps> = ({
  goals,
  onAddGoal,
  onRemoveGoal,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<ConversionGoal>>({
    name: "",
    description: "",
    type: "event",
    value: 1,
    criteria: {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGoal.name && newGoal.type) {
      const goal: ConversionGoal = {
        id: `goal_${Date.now()}`,
        name: newGoal.name!,
        description: newGoal.description || "",
        type: newGoal.type!,
        value: newGoal.value || 1,
        criteria: newGoal.criteria || {},
      };
      onAddGoal(goal);
      setNewGoal({
        name: "",
        description: "",
        type: "event",
        value: 1,
        criteria: {},
      });
      setShowForm(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">🎯 Objetivos de Conversión</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Agregar Objetivo"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-gray-50 rounded-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={newGoal.name || ""}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={newGoal.type || "event"}
                onChange={(e) =>
                  setNewGoal({
                    ...newGoal,
                    type: e.target.value as ConversionGoal["type"],
                  })
                }
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="event">Evento</option>
                <option value="pageview">Vista de Página</option>
                <option value="duration">Duración</option>
                <option value="value">Valor</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">
              Descripción
            </label>
            <textarea
              value={newGoal.description || ""}
              onChange={(e) =>
                setNewGoal({ ...newGoal, description: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-md text-sm"
              rows={3}
            />
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Crear Objetivo
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {goals.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No hay objetivos configurados
          </p>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <h4 className="font-medium text-sm">{goal.name}</h4>
                <p className="text-xs text-gray-600">{goal.description}</p>
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs mt-1">
                  {goal.type}
                </span>
              </div>
              <button
                onClick={() => onRemoveGoal(goal.id)}
                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
              >
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AdvancedAnalyticsDashboard: React.FC = () => {
  const { metrics, trackEvent, addGoal, removeGoal, exportData } =
    useAdvancedAnalytics();
  const [goals, setGoals] = useState<ConversionGoal[]>([]);

  const handleAddGoal = (goal: ConversionGoal) => {
    setGoals([...goals, goal]);
    addGoal(goal);
  };

  const handleRemoveGoal = (goalId: string) => {
    setGoals(goals.filter((g) => g.id !== goalId));
    removeGoal(goalId);
  };

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-data-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTestEvent = () => {
    trackEvent("test_event", "user", {
      source: "analytics_dashboard",
      timestamp: new Date().toISOString(),
    });
  };

  if (!metrics) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando analytics...</p>
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
            Advanced Analytics Dashboard
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Análisis completo de usuarios y comportamiento
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTestEvent}
            className="px-3 py-2 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200 transition-colors"
          >
            🧪 Test Event
          </button>
          <button
            onClick={handleExportData}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            📊 Exportar Datos
          </button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Usuarios Totales"
          value={metrics.activeUsers}
          icon="👥"
          color="blue"
        />
        <MetricCard
          title="Sesiones"
          value={metrics.pageViews}
          icon="📱"
          color="green"
        />
        <MetricCard
          title="Tasa de Rebote"
          value={metrics.bounceRate}
          format="percentage"
          icon="⬅️"
          color={
            metrics.bounceRate > 70
              ? "red"
              : metrics.bounceRate > 40
              ? "yellow"
              : "green"
          }
        />
        <MetricCard
          title="Duración Promedio"
          value={metrics.averageSessionDuration}
          format="duration"
          icon="⏱️"
          color="purple"
        />
      </div>

      {/* Métricas de engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Páginas por Sesión"
          value={metrics.eventsPerSession}
          icon="📄"
          color="blue"
        />
        <MetricCard
          title="Eventos por Sesión"
          value={metrics.eventsPerSession}
          icon="🎯"
          color="green"
        />
        <MetricCard
          title="Tasa de Conversión"
          value={metrics.conversionRate}
          format="percentage"
          icon="💰"
          color={
            metrics.conversionRate > 5
              ? "green"
              : metrics.conversionRate > 2
              ? "yellow"
              : "red"
          }
        />
        <MetricCard
          title="Total Conversiones"
          value={Math.round(metrics.conversionRate * 100)}
          icon="🎉"
          color="green"
        />
      </div>

      {/* Gráficos y análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart
          data={metrics.topEvents.reduce((acc, item) => {
            acc[item.event] = item.count;
            return acc;
          }, {} as Record<string, number>)}
          title="📊 Eventos Más Populares"
          type="bar"
        />

        <SimpleChart
          data={metrics.topPages.reduce((acc, item) => {
            acc[item.page] = item.views;
            return acc;
          }, {} as Record<string, number>)}
          title="📄 Páginas Más Visitadas"
          type="bar"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart
          data={metrics.deviceTypes}
          title="📱 Distribución por Dispositivo"
          type="pie"
        />

        <SimpleChart
          data={metrics.browserTypes}
          title="🌐 Distribución por Navegador"
          type="pie"
        />
      </div>

      {/* Distribución temporal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart
          data={metrics.hourlyDistribution}
          title="🕐 Actividad por Hora"
          type="line"
        />

        <SimpleChart
          data={metrics.dailyDistribution}
          title="📅 Actividad por Día"
          type="line"
        />
      </div>

      {/* Objetivos de conversión */}
      <GoalManager
        goals={goals}
        onAddGoal={handleAddGoal}
        onRemoveGoal={handleRemoveGoal}
      />

      {/* Completaciones de objetivos */}
      <SimpleChart
        data={{
          conversiones: metrics.totalConversions,
          visitas: metrics.pageViews,
        }}
        title="🎯 Métricas de Conversión"
        type="bar"
      />

      {/* Resumen de insights */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-lg mb-3 text-blue-800">
          📈 Insights y Recomendaciones
        </h3>
        <div className="space-y-2 text-sm text-blue-700">
          {metrics.bounceRate > 70 && (
            <p>
              • Alto porcentaje de rebote ({metrics.bounceRate.toFixed(1)}%) -
              Considera mejorar el contenido de la página de inicio
            </p>
          )}
          {metrics.averageSessionDuration < 30000 && (
            <p>
              • Sesiones cortas (menos de 30 segundos) - Los usuarios no están
              muy comprometidos
            </p>
          )}
          {metrics.conversionRate < 2 && (
            <p>
              • Baja tasa de conversión ({metrics.conversionRate.toFixed(1)}%) -
              Revisa el flujo de usuario y las llamadas a la acción
            </p>
          )}
          {metrics.pagesPerSession < 2 && (
            <p>
              • Pocas páginas por sesión - Mejora la navegación interna y el
              contenido relacionado
            </p>
          )}
          {metrics.totalEvents < 10 && (
            <p>
              • Pocos eventos registrados - Considera implementar más tracking
              de interacciones
            </p>
          )}
          {metrics.totalConversions === 0 && goals.length > 0 && (
            <p>
              • Sin conversiones registradas - Revisa la configuración de
              objetivos o el flujo de conversión
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
