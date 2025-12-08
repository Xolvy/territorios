import React, { useState, useEffect, useMemo } from "react";
import {
  useAIPredictiveEngine,
  CallPrediction,
  TerritoryInsight,
  ConductorPerformance,
  AIRecommendation,
} from "../../hooks/useAIPredictiveEngine";
import {
  useRouteOptimization,
  OptimizedRoute,
  RouteOptimizationConfig,
  TerritoryCluster,
} from "../../hooks/useRouteOptimization";
import {
  useSmartRecommendations,
  SmartRecommendation,
  ConductorInsights,
  WeeklyRecommendationPlan,
} from "../../hooks/useSmartRecommendations";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  icon: string;
  color: "blue" | "green" | "yellow" | "red" | "purple";
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  icon,
  color,
  subtitle,
}) => {
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

  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    stable: "text-gray-600",
  };

  return (
    <div
      className={`p-6 rounded-xl border ${colorClasses[color]} transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            {subtitle && <p className="text-sm opacity-75">{subtitle}</p>}
          </div>
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 ${trendColors[trend]}`}>
            <span className="text-lg">{trendIcons[trend]}</span>
            {trendValue && (
              <span className="text-sm font-medium">{trendValue}</span>
            )}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="text-lg font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
};

interface PredictionCardProps {
  prediction: CallPrediction;
  onOptimizeRoute: (territory: string) => void;
}

const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  onOptimizeRoute,
}) => {
  const successColor =
    prediction.successProbability > 0.7
      ? "text-green-600"
      : prediction.successProbability > 0.4
      ? "text-yellow-600"
      : "text-red-600";

  const confidenceColor =
    prediction.confidence > 0.8
      ? "text-blue-600"
      : prediction.confidence > 0.6
      ? "text-yellow-600"
      : "text-gray-600";

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-semibold text-lg">
            Territorio {prediction.territory}
          </h4>
          <p className="text-sm text-gray-600">
            Mejor horario: {prediction.bestTimeSlot}
          </p>
        </div>
        <button
          onClick={() => onOptimizeRoute(prediction.territory)}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
        >
          Optimizar Ruta
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-500">Probabilidad de Éxito</div>
          <div className={`text-xl font-bold ${successColor}`}>
            {(prediction.successProbability * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Duración Estimada</div>
          <div className="text-xl font-bold text-gray-800">
            {prediction.estimatedDuration} min
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-500">Confianza</span>
          <span className={`text-sm font-medium ${confidenceColor}`}>
            {(prediction.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: `${prediction.confidence * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Enfoque Recomendado:
        </div>
        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
          {prediction.recommendedApproach}
        </p>
      </div>

      {prediction.factors.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">
            Factores Clave:
          </div>
          <div className="flex flex-wrap gap-1">
            {prediction.factors.map((factor, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
              >
                {factor}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface RecommendationCardProps {
  recommendation: SmartRecommendation;
  onImplement: (id: string) => void;
  onDismiss: (id: string) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onImplement,
  onDismiss,
}) => {
  const priorityColors = {
    low: "border-blue-200 bg-blue-50",
    medium: "border-yellow-200 bg-yellow-50",
    high: "border-orange-200 bg-orange-50",
    critical: "border-red-200 bg-red-50",
  };

  const typeIcons = {
    performance: "📊",
    schedule: "🕐",
    territory: "🗺️",
    training: "🎓",
    strategy: "🎯",
    personal: "👤",
  };

  const difficultyIcons = {
    easy: "🟢",
    medium: "🟡",
    hard: "🔴",
  };

  return (
    <div
      className={`rounded-lg p-6 border-2 ${
        priorityColors[recommendation.priority]
      } mb-4`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">{typeIcons[recommendation.type]}</span>
          <div>
            <h4 className="font-semibold text-lg">{recommendation.title}</h4>
            <p className="text-sm text-gray-600 mt-1">
              {recommendation.description}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onImplement(recommendation.id)}
            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
          >
            Implementar
          </button>
          <button
            onClick={() => onDismiss(recommendation.id)}
            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-400 transition-colors"
          >
            Descartar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500">Prioridad</div>
          <div className="font-semibold capitalize">
            {recommendation.priority}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Confianza</div>
          <div className="font-semibold">
            {(recommendation.confidenceScore * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Dificultad</div>
          <div className="flex items-center space-x-1">
            <span>
              {difficultyIcons[recommendation.implementationDifficulty]}
            </span>
            <span className="font-semibold capitalize">
              {recommendation.implementationDifficulty}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Tiempo</div>
          <div className="font-semibold">{recommendation.timeToImplement}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Beneficio Esperado:
        </div>
        <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
          {recommendation.expectedBenefit}
        </p>
      </div>

      {recommendation.reasoning.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Análisis:
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            {recommendation.reasoning.map((reason, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.actionSteps.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Pasos de Acción:
          </div>
          <div className="space-y-2">
            {recommendation.actionSteps.slice(0, 3).map((step, index) => (
              <div key={step.id} className="flex items-start space-x-2 text-sm">
                <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-gray-800">{step.description}</div>
                  <div className="text-gray-500 text-xs">
                    ⏱️ {step.estimated_time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {recommendation.tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
};

interface TerritoryInsightCardProps {
  insight: TerritoryInsight;
  onSelectTerritory: (territory: string) => void;
}

const TerritoryInsightCard: React.FC<TerritoryInsightCardProps> = ({
  insight,
  onSelectTerritory,
}) => {
  const trendIcons = {
    up: "📈",
    down: "📉",
    stable: "➡️",
  };

  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    stable: "text-gray-600",
  };

  const successColor =
    insight.avgSuccessRate > 0.5
      ? "text-green-600"
      : insight.avgSuccessRate > 0.3
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-lg">
            Territorio {insight.territory}
          </h4>
          <div className="flex items-center space-x-2">
            <span
              className={`text-lg ${
                trendIcons[insight.trendDirection] ? "" : "text-gray-400"
              }`}
            >
              {trendIcons[insight.trendDirection]}
            </span>
            <span className={`text-sm ${trendColors[insight.trendDirection]}`}>
              {insight.trendDirection === "up"
                ? "Mejorando"
                : insight.trendDirection === "down"
                ? "Declinando"
                : "Estable"}
            </span>
          </div>
        </div>
        <button
          onClick={() => onSelectTerritory(insight.territory)}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
        >
          Analizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-500">Tasa de Éxito</div>
          <div className={`text-lg font-bold ${successColor}`}>
            {(insight.avgSuccessRate * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total Llamadas</div>
          <div className="text-lg font-bold text-gray-800">
            {insight.totalCalls}
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">Mejores Días</div>
        <div className="flex space-x-1">
          {insight.bestDays.map((day) => (
            <span
              key={day}
              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
            >
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][day]}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">Mejores Horarios</div>
        <div className="flex space-x-1">
          {insight.bestTimes.map((time) => (
            <span
              key={time}
              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs capitalize"
            >
              {time}
            </span>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Duración Promedio:{" "}
        <span className="font-semibold">
          {insight.avgCallDuration.toFixed(0)} min
        </span>
      </div>
    </div>
  );
};

interface RouteVisualizerProps {
  route: OptimizedRoute;
  clusters: TerritoryCluster[];
}

const RouteVisualizer: React.FC<RouteVisualizerProps> = ({
  route,
  clusters,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h3 className="font-semibold text-lg mb-4">Ruta Optimizada</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {route.points.length}
          </div>
          <div className="text-sm text-gray-600">Territorios</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {route.totalDistance.toFixed(1)} km
          </div>
          <div className="text-sm text-gray-600">Distancia Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.floor(route.estimatedTime / 60)}h {route.estimatedTime % 60}m
          </div>
          <div className="text-sm text-gray-600">Tiempo Estimado</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Eficiencia de Ruta
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full"
            style={{ width: `${route.efficiencyScore * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span className="font-semibold">
            {(route.efficiencyScore * 100).toFixed(1)}%
          </span>
          <span>100%</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Secuencia de Territorios
        </div>
        <div className="flex flex-wrap gap-2">
          {route.points.map((point, index) => (
            <div key={index} className="flex items-center space-x-1">
              <div className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">
                {index + 1}
              </div>
              <span className="text-sm">T{point.territory}</span>
              {index < route.points.length - 1 && (
                <span className="text-gray-400">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {route.recommendations.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">
            Recomendaciones
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            {route.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const ArtificialIntelligenceDashboard: React.FC = () => {
  const [selectedConductor, setSelectedConductor] = useState("C001");
  const [selectedTerritory, setSelectedTerritory] = useState("1");
  const [activeTab, setActiveTab] = useState<
    "overview" | "predictions" | "recommendations" | "routes" | "insights"
  >("overview");
  const [routeConfig, setRouteConfig] = useState<RouteOptimizationConfig>({
    maxTerritories: 6,
    maxTravelTime: 480, // 8 horas
    prioritizeSuccess: true,
    avoidRecentVisits: true,
    timeSlotPreference: "morning",
    conductorSkills: {
      territoryExperience: new Map(),
      timeSlotPreference: new Map([
        ["morning", 0.8],
        ["afternoon", 0.6],
      ]),
      avgCallDuration: 18,
      successRate: 0.45,
      adaptabilityScore: 0.7,
    },
  });

  const aiEngine = useAIPredictiveEngine();
  const routeEngine = useRouteOptimization();
  const smartRecs = useSmartRecommendations();

  const [predictions, setPredictions] = useState<CallPrediction[]>([]);
  const [territoryInsights, setTerritoryInsights] = useState<
    TerritoryInsight[]
  >([]);
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>(
    []
  );
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(
    null
  );
  const [conductorInsights, setConductorInsights] =
    useState<ConductorInsights | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyRecommendationPlan | null>(
    null
  );

  // Generar datos cuando cambia el conductor seleccionado
  useEffect(() => {
    if (!aiEngine.isLoading) {
      // Generar predicciones para varios territorios
      const newPredictions: CallPrediction[] = [];
      for (let i = 1; i <= 8; i++) {
        const prediction = aiEngine.predictCallSuccess(
          i.toString(),
          selectedConductor,
          "morning",
          1 // Lunes
        );
        newPredictions.push(prediction);
      }
      setPredictions(newPredictions);

      // Obtener insights de territorios
      const insights: TerritoryInsight[] = [];
      for (let i = 1; i <= 12; i++) {
        insights.push(aiEngine.getTerritoryInsights(i.toString()));
      }
      setTerritoryInsights(insights);

      // Obtener rendimiento del conductor
      const performance = aiEngine.getConductorPerformance(selectedConductor);

      // Generar recomendaciones inteligentes
      smartRecs.generateRecommendations(selectedConductor).then((recs) => {
        setRecommendations(recs);

        // Generar plan semanal
        const plan = smartRecs.generateWeeklyPlan(selectedConductor, recs);
        setWeeklyPlan(plan);
      });

      // Obtener insights del conductor
      const insights_conductor =
        smartRecs.getConductorInsights(selectedConductor);
      setConductorInsights(insights_conductor);
    }
  }, [selectedConductor, aiEngine, smartRecs]);

  const handleOptimizeRoute = async (territory?: string) => {
    const route = await routeEngine.optimizeRoute(
      selectedConductor,
      routeConfig
    );
    setOptimizedRoute(route);
  };

  const handleImplementRecommendation = (id: string) => {
    console.log("Implementing recommendation:", id);
    // Aquí se implementaría la lógica para marcar como implementada
  };

  const handleDismissRecommendation = (id: string) => {
    setRecommendations((prev) => prev.filter((rec) => rec.id !== id));
  };

  const aiMetrics = aiEngine.metrics;
  const routeMetrics = routeEngine.metrics;
  const recMetrics = smartRecs.metrics;

  if (aiEngine.isLoading || !aiMetrics) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Inicializando sistema de Inteligencia Artificial...
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
          <h2 className="text-3xl font-bold text-gray-900">
            🧠 Inteligencia Artificial
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Sistema avanzado de IA con predicciones, optimización y
            recomendaciones personalizadas
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedConductor}
            onChange={(e) => setSelectedConductor(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="C001">Conductor C001</option>
            <option value="C002">Conductor C002</option>
            <option value="C003">Conductor C003</option>
            <option value="C004">Conductor C004</option>
            <option value="C005">Conductor C005</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: "overview", label: "Resumen", icon: "📊" },
          { id: "predictions", label: "Predicciones", icon: "🔮" },
          { id: "recommendations", label: "Recomendaciones", icon: "💡" },
          { id: "routes", label: "Rutas IA", icon: "🗺️" },
          { id: "insights", label: "Insights", icon: "🎯" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center space-x-2 ${
              activeTab === tab.id
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* AI Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Predicciones IA"
              value={aiMetrics.totalPredictions}
              icon="🤖"
              color="blue"
              trend="up"
              trendValue="+12%"
              subtitle="Predicciones generadas"
            />
            <MetricCard
              title="Precisión Modelos"
              value={(aiMetrics.accuracyRate * 100).toFixed(1)}
              unit="%"
              icon="🎯"
              color="green"
              trend="up"
              trendValue="+2.1%"
              subtitle="Accuracy promedio"
            />
            <MetricCard
              title="Recomendaciones"
              value={recMetrics?.totalRecommendations || 0}
              icon="💡"
              color="purple"
              trend="up"
              trendValue="+8"
              subtitle="Sugerencias activas"
            />
            <MetricCard
              title="Rutas Optimizadas"
              value={routeMetrics?.totalRoutesOptimized || 0}
              icon="🗺️"
              color="yellow"
              trend="stable"
              subtitle="Rutas mejoradas"
            />
          </div>

          {/* System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-lg mb-4">
                🔧 Estado del Sistema IA
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Modelos Activos</span>
                  <span className="font-semibold">
                    {aiMetrics.modelsActive}/3
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Puntos de Datos</span>
                  <span className="font-semibold">
                    {aiMetrics.dataPoints.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Última Actualización</span>
                  <span className="text-sm text-gray-600">
                    {aiMetrics.lastModelUpdate.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Confianza Predictiva</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${aiMetrics.predictionConfidence * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {(aiMetrics.predictionConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-lg mb-4">
                📈 Impacto y Resultados
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Mejora en Eficiencia</span>
                  <span className="font-semibold text-green-600">
                    +
                    {(
                      (routeMetrics?.avgEfficiencyImprovement || 0) * 100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tasa de Aceptación</span>
                  <span className="font-semibold text-blue-600">
                    {((recMetrics?.acceptanceRate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Distancia Ahorrada</span>
                  <span className="font-semibold text-purple-600">
                    {(routeMetrics?.totalDistanceSaved || 0).toFixed(1)} km
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tendencia de Mejora</span>
                  <span className="font-semibold text-green-600">
                    +{(aiMetrics.improvementTrend * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <h3 className="font-semibold text-lg mb-4">🚀 Acciones Rápidas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleOptimizeRoute()}
                className="p-4 bg-white rounded-lg border border-blue-200 hover:shadow-md transition-shadow text-left"
              >
                <div className="text-2xl mb-2">🗺️</div>
                <div className="font-semibold">Optimizar Ruta</div>
                <div className="text-sm text-gray-600">
                  Generar ruta inteligente para {selectedConductor}
                </div>
              </button>

              <button
                onClick={() => setActiveTab("recommendations")}
                className="p-4 bg-white rounded-lg border border-purple-200 hover:shadow-md transition-shadow text-left"
              >
                <div className="text-2xl mb-2">💡</div>
                <div className="font-semibold">Ver Recomendaciones</div>
                <div className="text-sm text-gray-600">
                  Sugerencias personalizadas de IA
                </div>
              </button>

              <button
                onClick={() => aiEngine.trainModels()}
                disabled={aiEngine.isTraining}
                className="p-4 bg-white rounded-lg border border-green-200 hover:shadow-md transition-shadow text-left disabled:opacity-50"
              >
                <div className="text-2xl mb-2">🧠</div>
                <div className="font-semibold">
                  {aiEngine.isTraining ? "Entrenando..." : "Entrenar Modelos"}
                </div>
                <div className="text-sm text-gray-600">
                  Mejorar precisión de IA
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Predictions Tab */}
      {activeTab === "predictions" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold text-lg mb-4">
              🔮 Predicciones de Éxito - {selectedConductor}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {predictions.map((prediction) => (
                <PredictionCard
                  key={prediction.territory}
                  prediction={prediction}
                  onOptimizeRoute={handleOptimizeRoute}
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold text-lg mb-4">
              🗺️ Insights de Territorios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {territoryInsights.map((insight) => (
                <TerritoryInsightCard
                  key={insight.territory}
                  insight={insight}
                  onSelectTerritory={setSelectedTerritory}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">
                💡 Recomendaciones Inteligentes - {selectedConductor}
              </h3>
              <div className="text-sm text-gray-600">
                {recommendations.length} recomendaciones activas
              </div>
            </div>

            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onImplement={handleImplementRecommendation}
                    onDismiss={handleDismissRecommendation}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎉</div>
                <div className="text-lg font-semibold text-gray-800 mb-2">
                  ¡Excelente trabajo!
                </div>
                <div className="text-gray-600">
                  No hay recomendaciones pendientes en este momento.
                </div>
              </div>
            )}
          </div>

          {/* Conductor Insights */}
          {conductorInsights && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-lg mb-4">
                👤 Perfil del Conductor
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    Puntuación General
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {conductorInsights.overallScore.toFixed(0)}/100
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${conductorInsights.overallScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Tendencia</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {conductorInsights.trendDirection === "improving"
                        ? "📈"
                        : conductorInsights.trendDirection === "declining"
                        ? "📉"
                        : "➡️"}
                    </span>
                    <span className="font-semibold capitalize">
                      {conductorInsights.trendDirection === "improving"
                        ? "Mejorando"
                        : conductorInsights.trendDirection === "declining"
                        ? "Declinando"
                        : "Estable"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Satisfacción</div>
                  <div className="text-2xl font-bold text-green-600">
                    {conductorInsights.satisfactionLevel.toFixed(1)}/10
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Fortalezas Clave
                  </div>
                  <div className="space-y-1">
                    {conductorInsights.keyStrengths.map((strength, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-green-500">✓</span>
                        <span className="text-sm">{strength}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Áreas de Mejora
                  </div>
                  <div className="space-y-1">
                    {conductorInsights.primaryChallenges.map(
                      (challenge, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <span className="text-yellow-500">⚡</span>
                          <span className="text-sm">{challenge}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === "routes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">
                🗺️ Optimización de Rutas con IA
              </h3>
              <button
                onClick={() => handleOptimizeRoute()}
                disabled={routeEngine.isOptimizing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {routeEngine.isOptimizing ? "Optimizando..." : "Generar Ruta"}
              </button>
            </div>

            {/* Route Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Territorios
                </label>
                <input
                  type="number"
                  value={routeConfig.maxTerritories}
                  onChange={(e) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      maxTerritories: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  min="1"
                  max="15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiempo Máximo (min)
                </label>
                <input
                  type="number"
                  value={routeConfig.maxTravelTime}
                  onChange={(e) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      maxTravelTime: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  min="60"
                  max="600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horario Preferido
                </label>
                <select
                  value={routeConfig.timeSlotPreference}
                  onChange={(e) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      timeSlotPreference: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="morning">Mañana</option>
                  <option value="afternoon">Tarde</option>
                  <option value="evening">Noche</option>
                  <option value="any">Cualquiera</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={routeConfig.prioritizeSuccess}
                    onChange={(e) =>
                      setRouteConfig((prev) => ({
                        ...prev,
                        prioritizeSuccess: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Priorizar Éxito</span>
                </label>
              </div>
            </div>

            {optimizedRoute && (
              <RouteVisualizer
                route={optimizedRoute}
                clusters={routeEngine.getClusters()}
              />
            )}

            {!optimizedRoute && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🗺️</div>
                <div className="text-lg">Genera una ruta optimizada con IA</div>
                <div className="text-sm mt-2">
                  La IA analizará territorios, distancias y probabilidades de
                  éxito
                </div>
              </div>
            )}
          </div>

          {/* Route Metrics */}
          {routeMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Rutas Optimizadas</div>
                <div className="text-2xl font-bold text-blue-600">
                  {routeMetrics.totalRoutesOptimized}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Mejora Promedio</div>
                <div className="text-2xl font-bold text-green-600">
                  +{(routeMetrics.avgEfficiencyImprovement * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Distancia Ahorrada</div>
                <div className="text-2xl font-bold text-purple-600">
                  {routeMetrics.totalDistanceSaved.toFixed(1)} km
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Precisión Modelo</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {(routeMetrics.modelAccuracy * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          {/* Weekly Plan */}
          {weeklyPlan && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-lg mb-4">
                📅 Plan Semanal IA - {selectedConductor}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Objetivos Semanales
                  </div>
                  <ul className="space-y-1">
                    {weeklyPlan.weeklyGoals.map((goal, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <span className="text-blue-500">•</span>
                        <span className="text-sm">{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Áreas de Enfoque
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {weeklyPlan.focusAreas.map((area, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs capitalize"
                      >
                        {area.replace("-", " ")}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Métricas de Éxito
                  </div>
                  <ul className="space-y-1">
                    {weeklyPlan.successMetrics
                      .slice(0, 3)
                      .map((metric, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <span className="text-green-500">✓</span>
                          <span className="text-sm">{metric}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              {/* Daily Recommendations Preview */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Planificación Diaria
                </div>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                  {weeklyPlan.dailyRecommendations.map((day, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border text-center ${
                        index === 0 || index === 6
                          ? "bg-gray-50 border-gray-200"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="font-semibold text-sm">{day.day}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {day.primaryFocus}
                      </div>
                      <div className="text-xs mt-2 text-blue-600">
                        {day.recommendations.length} sugerencias
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Model Performance */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold text-lg mb-4">
              🧠 Rendimiento de Modelos IA
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">🔮</span>
                  <div>
                    <div className="font-semibold">Predictor de Éxito</div>
                    <div className="text-sm text-gray-600">v2.1.0</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">78%</div>
                <div className="text-sm text-gray-600">Precisión</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">🗺️</span>
                  <div>
                    <div className="font-semibold">Optimizador de Rutas</div>
                    <div className="text-sm text-gray-600">v1.8.0</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  87%
                </div>
                <div className="text-sm text-gray-600">Precisión</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <div className="font-semibold">Motor Recomendaciones</div>
                    <div className="text-sm text-gray-600">v1.5.0</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  82%
                </div>
                <div className="text-sm text-gray-600">Aceptación</div>
              </div>
            </div>
          </div>

          {/* Future Roadmap */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
            <h3 className="font-semibold text-lg mb-4">
              🚀 Próximas Características IA
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-purple-800 mb-2">
                  En Desarrollo
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    <span className="text-sm">
                      Predicción de clima para llamadas
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    <span className="text-sm">
                      Análisis de sentimientos en tiempo real
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    <span className="text-sm">
                      Asistente virtual de conversación
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-purple-800 mb-2">Planeado</h4>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span className="text-sm">
                      Deep learning para patrones complejos
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span className="text-sm">
                      Integración con sistemas externos
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span className="text-sm">
                      Personalización avanzada por región
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtificialIntelligenceDashboard;
