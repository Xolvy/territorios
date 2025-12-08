import React from "react";
import { useBundleOptimization } from "../../hooks/useBundleOptimization";

const BundleOptimizationDashboard: React.FC = () => {
  const {
    metrics,
    recommendations,
    exportAnalysis,
    getBundleScore,
    isOptimized,
  } = useBundleOptimization();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleExportAnalysis = () => {
    const analysis = exportAnalysis();
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bundle-analysis-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!metrics) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analizando bundle...</p>
        </div>
      </div>
    );
  }

  const bundleScore = getBundleScore();
  const scoreColor =
    bundleScore >= 80
      ? "text-green-600"
      : bundleScore >= 60
      ? "text-yellow-600"
      : "text-red-600";
  const scoreBg =
    bundleScore >= 80
      ? "bg-green-50 border-green-200"
      : bundleScore >= 60
      ? "bg-yellow-50 border-yellow-200"
      : "bg-red-50 border-red-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Bundle Optimization Dashboard
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Análisis de rendimiento y optimización del bundle
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`px-4 py-2 rounded-lg border ${scoreBg}`}>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                Score de Optimización:
              </span>
              <span className={`text-xl font-bold ${scoreColor}`}>
                {bundleScore}/100
              </span>
              <span className="text-lg">
                {isOptimized ? "✅" : bundleScore >= 60 ? "⚠️" : "❌"}
              </span>
            </div>
          </div>
          <button
            onClick={handleExportAnalysis}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
          >
            📊 Exportar Análisis
          </button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📦</span>
            <span className="text-2xl font-bold text-blue-600">
              {formatBytes(metrics.totalBundleSize)}
            </span>
          </div>
          <h3 className="font-semibold text-sm">Tamaño Total del Bundle</h3>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.loadedChunks.length} chunks cargados
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🧠</span>
            <span className="text-2xl font-bold text-purple-600">
              {((metrics.jsHeapSize / metrics.jsHeapSizeLimit) * 100).toFixed(
                1
              )}
              %
            </span>
          </div>
          <h3 className="font-semibold text-sm">Uso de Memoria JS</h3>
          <p className="text-xs text-gray-600 mt-1">
            {formatBytes(metrics.jsHeapSize)} /{" "}
            {formatBytes(metrics.jsHeapSizeLimit)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">💾</span>
            <span className="text-2xl font-bold text-green-600">
              {metrics.cacheHitRate.toFixed(1)}%
            </span>
          </div>
          <h3 className="font-semibold text-sm">Tasa de Cache Hit</h3>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.cachedResources} / {metrics.totalResources} recursos
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">⚡</span>
            <span className="text-2xl font-bold text-orange-600">
              {metrics.jsExecutionTime.toFixed(0)}ms
            </span>
          </div>
          <h3 className="font-semibold text-sm">Tiempo de Ejecución JS</h3>
          <p className="text-xs text-gray-600 mt-1">DOM Content Loaded</p>
        </div>
      </div>

      {/* Chunks Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">📋 Chunks Cargados</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(metrics.chunkLoadTimes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([chunk, time]) => (
                <div key={chunk} className="flex justify-between items-center">
                  <span className="text-sm font-medium truncate mr-4">
                    {chunk}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          time > 3000
                            ? "bg-red-500"
                            : time > 1500
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min((time / 5000) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold min-w-12 text-right">
                      {time.toFixed(0)}ms
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">📊 Recursos por Tamaño</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(metrics.resourceSizes)
              .filter(([url]) => url.includes(".js") || url.includes(".css"))
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([url, size]) => {
                const fileName = url.split("/").pop() || url;
                return (
                  <div key={url} className="flex justify-between items-center">
                    <span
                      className="text-sm font-medium truncate mr-4"
                      title={url}
                    >
                      {fileName}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              (size /
                                Math.max(
                                  ...Object.values(metrics.resourceSizes)
                                )) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold min-w-16 text-right">
                        {formatBytes(size)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Connection Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-lg mb-4">
          🌐 Información de Conexión
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl mb-2">📶</div>
            <div className="font-semibold">
              {metrics.effectiveType.toUpperCase()}
            </div>
            <div className="text-sm text-gray-600">Tipo Efectivo</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🔌</div>
            <div className="font-semibold">{metrics.connectionType}</div>
            <div className="text-sm text-gray-600">Tipo de Conexión</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">⏰</div>
            <div className="font-semibold">
              {metrics.timestamp.toLocaleTimeString()}
            </div>
            <div className="text-sm text-gray-600">Última Actualización</div>
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-4">
            💡 Recomendaciones de Optimización
          </h3>
          <div className="space-y-4">
            {recommendations.map((rec, index) => {
              const typeColors = {
                critical: "bg-red-50 border-red-200 text-red-800",
                warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
                info: "bg-blue-50 border-blue-200 text-blue-800",
              };

              const typeIcons = {
                critical: "🚨",
                warning: "⚠️",
                info: "ℹ️",
              };

              const impactBadges = {
                high: "bg-red-100 text-red-700",
                medium: "bg-yellow-100 text-yellow-700",
                low: "bg-green-100 text-green-700",
              };

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${typeColors[rec.type]}`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-xl">{typeIcons[rec.type]}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold text-sm">{rec.message}</h4>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            impactBadges[rec.impact]
                          }`}
                        >
                          {rec.impact} impact
                        </span>
                      </div>
                      <p className="text-sm opacity-90">{rec.solution}</p>
                      <div className="mt-2 text-xs opacity-75">
                        Categoría: {rec.category}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Summary */}
      <div className={`rounded-lg p-6 border ${scoreBg}`}>
        <h3 className="font-semibold text-lg mb-3">📈 Resumen de Estado</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">✅ Optimizaciones Activas:</h4>
            <ul className="text-sm space-y-1">
              <li>• Lazy loading de componentes implementado</li>
              <li>• Code splitting automático configurado</li>
              <li>• Compresión y minificación habilitada</li>
              {metrics.cacheHitRate > 50 && (
                <li>• Cache efectivo funcionando</li>
              )}
              {Object.keys(metrics.chunkLoadTimes).length > 3 && (
                <li>• Múltiples chunks para carga optimizada</li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">🎯 Próximos Pasos:</h4>
            <ul className="text-sm space-y-1">
              {bundleScore < 80 && (
                <li>
                  • Mejorar score de optimización actual: {bundleScore}/100
                </li>
              )}
              {metrics.totalBundleSize > 300000 && (
                <li>• Reducir tamaño del bundle principal</li>
              )}
              {metrics.cacheHitRate < 70 && (
                <li>• Optimizar estrategia de cache</li>
              )}
              {recommendations.length > 0 && (
                <li>
                  • Implementar {recommendations.length} recomendaciones
                  pendientes
                </li>
              )}
              <li>• Monitorear rendimiento en producción</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleOptimizationDashboard;
