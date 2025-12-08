import { useState, useEffect, useCallback, useMemo } from "react";

// Interfaces para el sistema de IA predictiva
interface CallPattern {
  timeSlot: string; // "morning", "afternoon", "evening", "night"
  dayOfWeek: number; // 0-6 (domingo a sábado)
  month: number; // 1-12
  territory: string;
  duration: number; // minutos
  outcome: "successful" | "no-answer" | "busy" | "callback" | "not-interested";
  conductorId: string;
  timestamp: number;
}

interface PredictiveModel {
  accuracy: number;
  lastTrained: number;
  totalSamples: number;
  version: string;
}

interface CallPrediction {
  territory: string;
  bestTimeSlot: string;
  successProbability: number;
  estimatedDuration: number;
  confidence: number;
  recommendedApproach: string;
  factors: string[];
}

interface TerritoryInsight {
  territory: string;
  avgSuccessRate: number;
  bestDays: number[];
  bestTimes: string[];
  avgCallDuration: number;
  totalCalls: number;
  trendDirection: "up" | "down" | "stable";
  seasonalPatterns: SeasonalPattern[];
}

interface SeasonalPattern {
  month: number;
  successRate: number;
  volume: number;
  avgDuration: number;
}

interface ConductorPerformance {
  conductorId: string;
  avgSuccessRate: number;
  bestTerritories: string[];
  strongTimeSlots: string[];
  improvementAreas: string[];
  predictedPerformance: number;
  personalityProfile: "analytical" | "social" | "persistent" | "adaptive";
}

interface AIRecommendation {
  id: string;
  type: "territory" | "schedule" | "approach" | "training";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  expectedImprovement: string;
  confidence: number;
  actionRequired: string;
  deadline?: Date;
  relatedData: any;
}

interface AIMetrics {
  totalPredictions: number;
  accuracyRate: number;
  modelsActive: number;
  dataPoints: number;
  lastModelUpdate: Date;
  predictionConfidence: number;
  improvementTrend: number;
}

// Clase principal del motor de IA predictiva
class AIPredictiveEngine {
  private patterns: Map<string, CallPattern[]> = new Map();
  private models: Map<string, PredictiveModel> = new Map();
  private subscribers: Set<(metrics: AIMetrics) => void> = new Set();
  private isTraining = false;

  constructor() {
    this.initializeModels();
    this.generateSampleData();
  }

  private initializeModels() {
    // Modelo de predicción de éxito de llamadas
    this.models.set("call-success", {
      accuracy: 0.78,
      lastTrained: Date.now(),
      totalSamples: 1250,
      version: "1.0.0",
    });

    // Modelo de optimización temporal
    this.models.set("time-optimization", {
      accuracy: 0.82,
      lastTrained: Date.now(),
      totalSamples: 980,
      version: "1.0.0",
    });

    // Modelo de asignación de territorios
    this.models.set("territory-assignment", {
      accuracy: 0.75,
      lastTrained: Date.now(),
      totalSamples: 750,
      version: "1.0.0",
    });
  }

  private generateSampleData() {
    const territories = Array.from({ length: 22 }, (_, i) =>
      (i + 1).toString()
    );
    const conductors = ["C001", "C002", "C003", "C004", "C005"];
    const timeSlots = ["morning", "afternoon", "evening", "night"];
    const outcomes: CallPattern["outcome"][] = [
      "successful",
      "no-answer",
      "busy",
      "callback",
      "not-interested",
    ];

    // Generar 2000 patrones de llamadas sintéticos
    for (let i = 0; i < 2000; i++) {
      const pattern: CallPattern = {
        timeSlot: timeSlots[Math.floor(Math.random() * timeSlots.length)],
        dayOfWeek: Math.floor(Math.random() * 7),
        month: Math.floor(Math.random() * 12) + 1,
        territory: territories[Math.floor(Math.random() * territories.length)],
        duration: Math.floor(Math.random() * 45) + 5, // 5-50 minutos
        outcome: outcomes[this.getWeightedRandomOutcome()],
        conductorId: conductors[Math.floor(Math.random() * conductors.length)],
        timestamp:
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000), // Últimos 30 días
      };

      const key = `${pattern.territory}-${pattern.conductorId}`;
      if (!this.patterns.has(key)) {
        this.patterns.set(key, []);
      }
      this.patterns.get(key)!.push(pattern);
    }
  }

  private getWeightedRandomOutcome(): number {
    const weights = [0.35, 0.25, 0.15, 0.15, 0.1]; // successful, no-answer, busy, callback, not-interested
    const random = Math.random();
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random <= sum) return i;
    }
    return weights.length - 1;
  }

  // Predicción de éxito de llamada
  predictCallSuccess(
    territory: string,
    conductorId: string,
    timeSlot: string,
    dayOfWeek: number
  ): CallPrediction {
    const key = `${territory}-${conductorId}`;
    const historicalData = this.patterns.get(key) || [];

    // Análisis de patrones históricos
    const relevantCalls = historicalData.filter(
      (call) => call.timeSlot === timeSlot && call.dayOfWeek === dayOfWeek
    );

    let successRate = 0.35; // Base rate
    let estimatedDuration = 15; // Duración base
    let confidence = 0.5; // Confianza base

    if (relevantCalls.length > 0) {
      const successfulCalls = relevantCalls.filter(
        (call) => call.outcome === "successful"
      );
      successRate = successfulCalls.length / relevantCalls.length;
      estimatedDuration =
        relevantCalls.reduce((sum, call) => sum + call.duration, 0) /
        relevantCalls.length;
      confidence = Math.min(0.95, 0.3 + relevantCalls.length * 0.05);
    }

    // Factores que influyen en la predicción
    const factors = this.analyzePredictionFactors(
      territory,
      conductorId,
      timeSlot,
      dayOfWeek
    );

    return {
      territory,
      bestTimeSlot: this.getBestTimeSlot(territory, conductorId),
      successProbability: Math.min(
        0.95,
        successRate * (1 + Math.random() * 0.2 - 0.1)
      ),
      estimatedDuration: Math.round(estimatedDuration),
      confidence,
      recommendedApproach: this.getRecommendedApproach(successRate, factors),
      factors,
    };
  }

  private analyzePredictionFactors(
    territory: string,
    conductorId: string,
    timeSlot: string,
    dayOfWeek: number
  ): string[] {
    const factors: string[] = [];

    if (timeSlot === "morning") factors.push("Mejor receptividad matutina");
    if (dayOfWeek >= 1 && dayOfWeek <= 5) factors.push("Día laboral favorable");
    if (parseInt(territory) <= 10) factors.push("Territorio de alta densidad");

    const key = `${territory}-${conductorId}`;
    const historicalData = this.patterns.get(key) || [];

    if (historicalData.length > 50)
      factors.push("Experiencia histórica abundante");
    if (this.getConductorSuccessRate(conductorId) > 0.4)
      factors.push("Conductor experimentado");

    return factors;
  }

  private getBestTimeSlot(territory: string, conductorId: string): string {
    const key = `${territory}-${conductorId}`;
    const historicalData = this.patterns.get(key) || [];

    const timeSlotStats = new Map<string, { success: number; total: number }>();

    historicalData.forEach((call) => {
      if (!timeSlotStats.has(call.timeSlot)) {
        timeSlotStats.set(call.timeSlot, { success: 0, total: 0 });
      }
      const stats = timeSlotStats.get(call.timeSlot)!;
      stats.total++;
      if (call.outcome === "successful") stats.success++;
    });

    let bestSlot = "morning";
    let bestRate = 0;

    timeSlotStats.forEach((stats, slot) => {
      const rate = stats.success / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        bestSlot = slot;
      }
    });

    return bestSlot;
  }

  private getRecommendedApproach(
    successRate: number,
    factors: string[]
  ): string {
    if (successRate > 0.6)
      return "Enfoque directo - alta probabilidad de éxito";
    if (successRate > 0.4)
      return "Enfoque consultivo - establecer rapport primero";
    if (factors.includes("Día laboral favorable"))
      return "Enfoque flexible - adaptarse a disponibilidad";
    return "Enfoque persistente - múltiples intentos necesarios";
  }

  // Análisis de territorio con insights avanzados
  getTerritoryInsights(territory: string): TerritoryInsight {
    const territoryData = Array.from(this.patterns.values())
      .flat()
      .filter((call) => call.territory === territory);

    if (territoryData.length === 0) {
      return this.getDefaultTerritoryInsight(territory);
    }

    const successfulCalls = territoryData.filter(
      (call) => call.outcome === "successful"
    );
    const avgSuccessRate = successfulCalls.length / territoryData.length;

    // Análisis por día de la semana
    const dayStats = new Map<number, { success: number; total: number }>();
    territoryData.forEach((call) => {
      if (!dayStats.has(call.dayOfWeek)) {
        dayStats.set(call.dayOfWeek, { success: 0, total: 0 });
      }
      const stats = dayStats.get(call.dayOfWeek)!;
      stats.total++;
      if (call.outcome === "successful") stats.success++;
    });

    const bestDays = Array.from(dayStats.entries())
      .sort((a, b) => b[1].success / b[1].total - a[1].success / a[1].total)
      .slice(0, 3)
      .map(([day]) => day);

    // Análisis temporal
    const timeStats = new Map<string, number>();
    territoryData.forEach((call) => {
      timeStats.set(call.timeSlot, (timeStats.get(call.timeSlot) || 0) + 1);
    });

    const bestTimes = Array.from(timeStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([time]) => time);

    // Patrones estacionales
    const seasonalPatterns = this.calculateSeasonalPatterns(territoryData);

    return {
      territory,
      avgSuccessRate,
      bestDays,
      bestTimes,
      avgCallDuration:
        territoryData.reduce((sum, call) => sum + call.duration, 0) /
        territoryData.length,
      totalCalls: territoryData.length,
      trendDirection: this.calculateTrend(territoryData),
      seasonalPatterns,
    };
  }

  private getDefaultTerritoryInsight(territory: string): TerritoryInsight {
    return {
      territory,
      avgSuccessRate: 0.35,
      bestDays: [1, 2, 3], // Lunes, Martes, Miércoles
      bestTimes: ["morning", "afternoon"],
      avgCallDuration: 15,
      totalCalls: 0,
      trendDirection: "stable",
      seasonalPatterns: [],
    };
  }

  private calculateSeasonalPatterns(data: CallPattern[]): SeasonalPattern[] {
    const monthStats = new Map<
      number,
      { success: number; total: number; totalDuration: number }
    >();

    data.forEach((call) => {
      if (!monthStats.has(call.month)) {
        monthStats.set(call.month, { success: 0, total: 0, totalDuration: 0 });
      }
      const stats = monthStats.get(call.month)!;
      stats.total++;
      stats.totalDuration += call.duration;
      if (call.outcome === "successful") stats.success++;
    });

    return Array.from(monthStats.entries()).map(([month, stats]) => ({
      month,
      successRate: stats.success / stats.total,
      volume: stats.total,
      avgDuration: stats.totalDuration / stats.total,
    }));
  }

  private calculateTrend(data: CallPattern[]): "up" | "down" | "stable" {
    if (data.length < 10) return "stable";

    const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
    const midPoint = Math.floor(sortedData.length / 2);

    const firstHalf = sortedData.slice(0, midPoint);
    const secondHalf = sortedData.slice(midPoint);

    const firstSuccess =
      firstHalf.filter((call) => call.outcome === "successful").length /
      firstHalf.length;
    const secondSuccess =
      secondHalf.filter((call) => call.outcome === "successful").length /
      secondHalf.length;

    const difference = secondSuccess - firstSuccess;

    if (difference > 0.05) return "up";
    if (difference < -0.05) return "down";
    return "stable";
  }

  // Análisis de rendimiento del conductor
  getConductorPerformance(conductorId: string): ConductorPerformance {
    const conductorData = Array.from(this.patterns.values())
      .flat()
      .filter((call) => call.conductorId === conductorId);

    if (conductorData.length === 0) {
      return this.getDefaultConductorPerformance(conductorId);
    }

    const successfulCalls = conductorData.filter(
      (call) => call.outcome === "successful"
    );
    const avgSuccessRate = successfulCalls.length / conductorData.length;

    // Mejores territorios
    const territoryStats = new Map<
      string,
      { success: number; total: number }
    >();
    conductorData.forEach((call) => {
      if (!territoryStats.has(call.territory)) {
        territoryStats.set(call.territory, { success: 0, total: 0 });
      }
      const stats = territoryStats.get(call.territory)!;
      stats.total++;
      if (call.outcome === "successful") stats.success++;
    });

    const bestTerritories = Array.from(territoryStats.entries())
      .filter(([_, stats]) => stats.total >= 5) // Mínimo 5 llamadas
      .sort((a, b) => b[1].success / b[1].total - a[1].success / a[1].total)
      .slice(0, 3)
      .map(([territory]) => territory);

    // Mejores horarios
    const timeStats = new Map<string, { success: number; total: number }>();
    conductorData.forEach((call) => {
      if (!timeStats.has(call.timeSlot)) {
        timeStats.set(call.timeSlot, { success: 0, total: 0 });
      }
      const stats = timeStats.get(call.timeSlot)!;
      stats.total++;
      if (call.outcome === "successful") stats.success++;
    });

    const strongTimeSlots = Array.from(timeStats.entries())
      .sort((a, b) => b[1].success / b[1].total - a[1].success / a[1].total)
      .slice(0, 2)
      .map(([time]) => time);

    return {
      conductorId,
      avgSuccessRate,
      bestTerritories,
      strongTimeSlots,
      improvementAreas: this.getImprovementAreas(avgSuccessRate, conductorData),
      predictedPerformance: this.predictFuturePerformance(
        avgSuccessRate,
        conductorData.length
      ),
      personalityProfile: this.analyzePersonalityProfile(conductorData),
    };
  }

  private getDefaultConductorPerformance(
    conductorId: string
  ): ConductorPerformance {
    return {
      conductorId,
      avgSuccessRate: 0.35,
      bestTerritories: [],
      strongTimeSlots: ["morning"],
      improvementAreas: ["Necesita más experiencia"],
      predictedPerformance: 0.4,
      personalityProfile: "adaptive",
    };
  }

  private getImprovementAreas(
    successRate: number,
    data: CallPattern[]
  ): string[] {
    const areas: string[] = [];

    if (successRate < 0.3) areas.push("Técnicas de apertura de conversación");
    if (successRate < 0.4) areas.push("Manejo de objeciones");

    const avgDuration =
      data.reduce((sum, call) => sum + call.duration, 0) / data.length;
    if (avgDuration < 10) areas.push("Prolongar conversaciones productivas");
    if (avgDuration > 30) areas.push("Optimizar tiempo por llamada");

    const callbackRate =
      data.filter((call) => call.outcome === "callback").length / data.length;
    if (callbackRate > 0.2) areas.push("Seguimiento de callbacks pendientes");

    return areas.length > 0 ? areas : ["Mantener consistencia actual"];
  }

  private predictFuturePerformance(
    currentRate: number,
    experience: number
  ): number {
    // Predicción basada en curva de aprendizaje
    const experienceFactor = Math.min(1.2, 1 + experience / 500);
    const basePrediction = currentRate * experienceFactor;

    // Agregar factor aleatorio pequeño para simular variabilidad
    return Math.min(0.85, basePrediction + (Math.random() * 0.1 - 0.05));
  }

  private analyzePersonalityProfile(
    data: CallPattern[]
  ): ConductorPerformance["personalityProfile"] {
    const avgDuration =
      data.reduce((sum, call) => sum + call.duration, 0) / data.length;
    const callbackRate =
      data.filter((call) => call.outcome === "callback").length / data.length;
    const successRate =
      data.filter((call) => call.outcome === "successful").length / data.length;

    if (avgDuration > 25 && callbackRate > 0.15) return "social";
    if (successRate > 0.45 && avgDuration < 20) return "analytical";
    if (callbackRate > 0.25) return "persistent";
    return "adaptive";
  }

  private getConductorSuccessRate(conductorId: string): number {
    const conductorData = Array.from(this.patterns.values())
      .flat()
      .filter((call) => call.conductorId === conductorId);

    if (conductorData.length === 0) return 0.35;

    const successfulCalls = conductorData.filter(
      (call) => call.outcome === "successful"
    );
    return successfulCalls.length / conductorData.length;
  }

  // Generar recomendaciones inteligentes
  generateRecommendations(): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    let recommendationId = 1;

    // Recomendaciones basadas en territorios
    const territories = Array.from({ length: 22 }, (_, i) =>
      (i + 1).toString()
    );
    territories.forEach((territory) => {
      const insight = this.getTerritoryInsights(territory);

      if (insight.avgSuccessRate < 0.25 && insight.totalCalls > 20) {
        recommendations.push({
          id: `rec_${recommendationId++}`,
          type: "territory",
          priority: "high",
          title: `Territorio ${territory} necesita estrategia diferente`,
          description: `Éxito del ${(insight.avgSuccessRate * 100).toFixed(
            1
          )}% está por debajo del promedio`,
          expectedImprovement: "+15-20% en tasa de éxito",
          confidence: 0.78,
          actionRequired: `Revisar horarios óptimos: ${insight.bestTimes.join(
            ", "
          )}`,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          relatedData: insight,
        });
      }
    });

    // Recomendaciones basadas en conductores
    const conductors = ["C001", "C002", "C003", "C004", "C005"];
    conductors.forEach((conductorId) => {
      const performance = this.getConductorPerformance(conductorId);

      if (performance.avgSuccessRate > 0.5) {
        recommendations.push({
          id: `rec_${recommendationId++}`,
          type: "training",
          priority: "medium",
          title: `${conductorId} puede entrenar a otros`,
          description: `Éxito del ${(performance.avgSuccessRate * 100).toFixed(
            1
          )}% - compartir mejores prácticas`,
          expectedImprovement: "+10-15% para el equipo",
          confidence: 0.85,
          actionRequired: "Asignar rol de mentor",
          relatedData: performance,
        });
      }

      if (performance.improvementAreas.length > 2) {
        recommendations.push({
          id: `rec_${recommendationId++}`,
          type: "training",
          priority: "medium",
          title: `Capacitación personalizada para ${conductorId}`,
          description: `Enfocar en: ${performance.improvementAreas
            .slice(0, 2)
            .join(", ")}`,
          expectedImprovement: "+8-12% en rendimiento",
          confidence: 0.72,
          actionRequired: "Programar sesión de entrenamiento",
          relatedData: performance,
        });
      }
    });

    // Recomendaciones de horarios óptimos
    const timeSlotAnalysis = this.analyzeOptimalTiming();
    if (timeSlotAnalysis.improvement > 0.1) {
      recommendations.push({
        id: `rec_${recommendationId++}`,
        type: "schedule",
        priority: "high",
        title: "Optimizar horarios de llamadas",
        description: `Cambiar a horarios óptimos puede mejorar ${(
          timeSlotAnalysis.improvement * 100
        ).toFixed(1)}%`,
        expectedImprovement: `+${(timeSlotAnalysis.improvement * 100).toFixed(
          1
        )}% en conversiones`,
        confidence: 0.81,
        actionRequired: `Concentrar llamadas en ${timeSlotAnalysis.bestSlot}`,
        relatedData: timeSlotAnalysis,
      });
    }

    return recommendations.slice(0, 8); // Limitar a 8 recomendaciones principales
  }

  private analyzeOptimalTiming(): {
    improvement: number;
    bestSlot: string;
    currentEfficiency: number;
  } {
    const allData = Array.from(this.patterns.values()).flat();
    const timeSlotStats = new Map<string, { success: number; total: number }>();

    allData.forEach((call) => {
      if (!timeSlotStats.has(call.timeSlot)) {
        timeSlotStats.set(call.timeSlot, { success: 0, total: 0 });
      }
      const stats = timeSlotStats.get(call.timeSlot)!;
      stats.total++;
      if (call.outcome === "successful") stats.success++;
    });

    let bestSlot = "morning";
    let bestRate = 0;
    let currentRate = 0;

    timeSlotStats.forEach((stats, slot) => {
      const rate = stats.success / stats.total;
      currentRate += rate * (stats.total / allData.length); // Promedio ponderado

      if (rate > bestRate) {
        bestRate = rate;
        bestSlot = slot;
      }
    });

    return {
      improvement: bestRate - currentRate,
      bestSlot,
      currentEfficiency: currentRate,
    };
  }

  // Métricas del sistema de IA
  getAIMetrics(): AIMetrics {
    const totalPatterns = Array.from(this.patterns.values()).reduce(
      (sum, patterns) => sum + patterns.length,
      0
    );

    let totalAccuracy = 0;
    let modelCount = 0;

    this.models.forEach((model) => {
      totalAccuracy += model.accuracy;
      modelCount++;
    });

    const avgAccuracy = modelCount > 0 ? totalAccuracy / modelCount : 0;

    return {
      totalPredictions: totalPatterns * 3, // Simulamos que cada patrón genera 3 predicciones
      accuracyRate: avgAccuracy,
      modelsActive: this.models.size,
      dataPoints: totalPatterns,
      lastModelUpdate: new Date(
        Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)
      ),
      predictionConfidence: 0.76 + Math.random() * 0.15,
      improvementTrend: 0.12 + Math.random() * 0.08,
    };
  }

  // Entrenar modelos (simulado)
  async trainModels(): Promise<void> {
    this.isTraining = true;

    // Simular entrenamiento
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Actualizar accuracy de modelos
    this.models.forEach((model, key) => {
      const improvement = Math.random() * 0.05; // Mejora de hasta 5%
      model.accuracy = Math.min(0.95, model.accuracy + improvement);
      model.lastTrained = Date.now();
      model.totalSamples += Math.floor(Math.random() * 100) + 50;
    });

    this.isTraining = false;
    this.notifySubscribers();
  }

  // Suscripción a cambios
  subscribe(callback: (metrics: AIMetrics) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    const metrics = this.getAIMetrics();
    this.subscribers.forEach((callback) => callback(metrics));
  }

  // Simular actualizaciones en tiempo real
  startRealTimeUpdates() {
    setInterval(() => {
      // Agregar algunos patrones nuevos ocasionalmente
      if (Math.random() < 0.3) {
        this.addRandomPattern();
        this.notifySubscribers();
      }
    }, 5000);
  }

  private addRandomPattern() {
    const territories = Array.from({ length: 22 }, (_, i) =>
      (i + 1).toString()
    );
    const conductors = ["C001", "C002", "C003", "C004", "C005"];
    const timeSlots = ["morning", "afternoon", "evening", "night"];
    const outcomes: CallPattern["outcome"][] = [
      "successful",
      "no-answer",
      "busy",
      "callback",
      "not-interested",
    ];

    const pattern: CallPattern = {
      timeSlot: timeSlots[Math.floor(Math.random() * timeSlots.length)],
      dayOfWeek: Math.floor(Math.random() * 7),
      month: new Date().getMonth() + 1,
      territory: territories[Math.floor(Math.random() * territories.length)],
      duration: Math.floor(Math.random() * 45) + 5,
      outcome: outcomes[this.getWeightedRandomOutcome()],
      conductorId: conductors[Math.floor(Math.random() * conductors.length)],
      timestamp: Date.now(),
    };

    const key = `${pattern.territory}-${pattern.conductorId}`;
    if (!this.patterns.has(key)) {
      this.patterns.set(key, []);
    }
    this.patterns.get(key)!.push(pattern);
  }
}

// Hook personalizado para usar el motor de IA
export const useAIPredictiveEngine = () => {
  const [engine] = useState(() => new AIPredictiveEngine());
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setIsLoading(false);
    });

    // Inicializar métricas
    setMetrics(engine.getAIMetrics());
    setIsLoading(false);

    // Iniciar actualizaciones en tiempo real
    engine.startRealTimeUpdates();

    return unsubscribe;
  }, [engine]);

  const predictCallSuccess = useCallback(
    (
      territory: string,
      conductorId: string,
      timeSlot: string,
      dayOfWeek: number
    ) => {
      return engine.predictCallSuccess(
        territory,
        conductorId,
        timeSlot,
        dayOfWeek
      );
    },
    [engine]
  );

  const getTerritoryInsights = useCallback(
    (territory: string) => {
      return engine.getTerritoryInsights(territory);
    },
    [engine]
  );

  const getConductorPerformance = useCallback(
    (conductorId: string) => {
      return engine.getConductorPerformance(conductorId);
    },
    [engine]
  );

  const generateRecommendations = useCallback(() => {
    return engine.generateRecommendations();
  }, [engine]);

  const trainModels = useCallback(async () => {
    setIsTraining(true);
    try {
      await engine.trainModels();
    } finally {
      setIsTraining(false);
    }
  }, [engine]);

  const recommendations = useMemo(
    () => engine.generateRecommendations(),
    [metrics, engine]
  );

  return {
    metrics,
    isLoading,
    isTraining,
    predictCallSuccess,
    getTerritoryInsights,
    getConductorPerformance,
    generateRecommendations,
    recommendations,
    trainModels,
  };
};

export type {
  CallPattern,
  CallPrediction,
  TerritoryInsight,
  ConductorPerformance,
  AIRecommendation,
  AIMetrics,
  SeasonalPattern,
};
