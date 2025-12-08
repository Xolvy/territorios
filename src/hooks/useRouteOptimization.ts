import { useState, useEffect, useCallback, useMemo } from "react";
import { CallPattern, TerritoryInsight } from "./useAIPredictiveEngine";

// Interfaces para optimización de rutas
interface RoutePoint {
  territory: string;
  latitude: number;
  longitude: number;
  priority: number;
  estimatedDuration: number;
  successProbability: number;
  optimalTimeSlot: string;
  lastVisited?: Date;
}

interface OptimizedRoute {
  id: string;
  conductorId: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: number;
  expectedCalls: number;
  efficiencyScore: number;
  recommendations: string[];
  alternativeRoutes: AlternativeRoute[];
}

interface AlternativeRoute {
  id: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: number;
  pros: string[];
  cons: string[];
  efficiencyScore: number;
}

interface RouteOptimizationConfig {
  maxTerritories: number;
  maxTravelTime: number; // minutos
  prioritizeSuccess: boolean;
  avoidRecentVisits: boolean;
  timeSlotPreference: string;
  conductorSkills: ConductorSkills;
}

interface ConductorSkills {
  territoryExperience: Map<string, number>; // 0-1 score
  timeSlotPreference: Map<string, number>; // 0-1 score
  avgCallDuration: number;
  successRate: number;
  adaptabilityScore: number;
}

interface TerritoryCluster {
  id: string;
  territories: string[];
  centerLat: number;
  centerLng: number;
  density: number;
  avgSuccessRate: number;
  optimalDayTime: { day: number; timeSlot: string };
}

interface MLOptimizationModel {
  name: string;
  accuracy: number;
  trainingData: number;
  lastUpdated: Date;
  version: string;
  parameters: {
    distanceWeight: number;
    successWeight: number;
    timeWeight: number;
    skillWeight: number;
  };
}

interface RouteMetrics {
  totalRoutesOptimized: number;
  avgEfficiencyImprovement: number;
  totalDistanceSaved: number;
  avgSuccessRateImprovement: number;
  modelAccuracy: number;
  activeOptimizations: number;
}

// Clase principal para optimización de rutas con ML
class RouteOptimizationEngine {
  private territories: Map<string, RoutePoint> = new Map();
  private models: Map<string, MLOptimizationModel> = new Map();
  private clusters: TerritoryCluster[] = [];
  private optimizationHistory: OptimizedRoute[] = [];
  private subscribers: Set<(metrics: RouteMetrics) => void> = new Set();

  constructor() {
    this.initializeTerritories();
    this.initializeModels();
    this.generateClusters();
  }

  private initializeTerritories() {
    // Coordenadas simuladas para territorios en una ciudad
    const baseLatitude = 25.6866; // Miami como ejemplo
    const baseLongitude = -80.1917;

    for (let i = 1; i <= 22; i++) {
      // Distribuir territorios en una grilla simulada
      const row = Math.floor((i - 1) / 6);
      const col = (i - 1) % 6;

      const territory: RoutePoint = {
        territory: i.toString(),
        latitude: baseLatitude + row * 0.02 + (Math.random() * 0.01 - 0.005),
        longitude: baseLongitude + col * 0.02 + (Math.random() * 0.01 - 0.005),
        priority: Math.floor(Math.random() * 5) + 1, // 1-5
        estimatedDuration: Math.floor(Math.random() * 30) + 15, // 15-45 min
        successProbability: Math.random() * 0.6 + 0.2, // 20-80%
        optimalTimeSlot: ["morning", "afternoon", "evening"][
          Math.floor(Math.random() * 3)
        ],
        lastVisited: new Date(
          Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
        ),
      };

      this.territories.set(i.toString(), territory);
    }
  }

  private initializeModels() {
    // Modelo de optimización de distancia
    this.models.set("distance-optimizer", {
      name: "Distance Optimization Model",
      accuracy: 0.87,
      trainingData: 1500,
      lastUpdated: new Date(),
      version: "2.1.0",
      parameters: {
        distanceWeight: 0.4,
        successWeight: 0.3,
        timeWeight: 0.2,
        skillWeight: 0.1,
      },
    });

    // Modelo de predicción de éxito
    this.models.set("success-predictor", {
      name: "Success Prediction Model",
      accuracy: 0.82,
      trainingData: 2200,
      lastUpdated: new Date(),
      version: "1.8.0",
      parameters: {
        distanceWeight: 0.1,
        successWeight: 0.5,
        timeWeight: 0.25,
        skillWeight: 0.15,
      },
    });

    // Modelo de clustering territorial
    this.models.set("territory-clusterer", {
      name: "Territory Clustering Model",
      accuracy: 0.91,
      trainingData: 800,
      lastUpdated: new Date(),
      version: "1.5.0",
      parameters: {
        distanceWeight: 0.6,
        successWeight: 0.2,
        timeWeight: 0.1,
        skillWeight: 0.1,
      },
    });
  }

  private generateClusters() {
    const territories = Array.from(this.territories.values());
    const k = 5; // Número de clusters

    // Algoritmo K-means simplificado
    let centroids = this.initializeCentroids(territories, k);
    let assignments = new Map<string, number>();

    for (let iteration = 0; iteration < 10; iteration++) {
      // Asignar territorios a clusters
      assignments.clear();
      territories.forEach((territory) => {
        let minDistance = Infinity;
        let closestCluster = 0;

        centroids.forEach((centroid, index) => {
          const distance = this.calculateDistance(
            territory.latitude,
            territory.longitude,
            centroid.lat,
            centroid.lng
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestCluster = index;
          }
        });

        assignments.set(territory.territory, closestCluster);
      });

      // Actualizar centroids
      for (let i = 0; i < k; i++) {
        const clusterTerritories = territories.filter(
          (t) => assignments.get(t.territory) === i
        );
        if (clusterTerritories.length > 0) {
          centroids[i] = {
            lat:
              clusterTerritories.reduce((sum, t) => sum + t.latitude, 0) /
              clusterTerritories.length,
            lng:
              clusterTerritories.reduce((sum, t) => sum + t.longitude, 0) /
              clusterTerritories.length,
          };
        }
      }
    }

    // Crear clusters finales
    this.clusters = [];
    for (let i = 0; i < k; i++) {
      const clusterTerritories = territories.filter(
        (t) => assignments.get(t.territory) === i
      );
      if (clusterTerritories.length > 0) {
        this.clusters.push({
          id: `cluster_${i + 1}`,
          territories: clusterTerritories.map((t) => t.territory),
          centerLat: centroids[i].lat,
          centerLng: centroids[i].lng,
          density: clusterTerritories.length,
          avgSuccessRate:
            clusterTerritories.reduce(
              (sum, t) => sum + t.successProbability,
              0
            ) / clusterTerritories.length,
          optimalDayTime: this.findOptimalTime(clusterTerritories),
        });
      }
    }
  }

  private initializeCentroids(territories: RoutePoint[], k: number) {
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const randomTerritory =
        territories[Math.floor(Math.random() * territories.length)];
      centroids.push({
        lat: randomTerritory.latitude,
        lng: randomTerritory.longitude,
      });
    }
    return centroids;
  }

  private findOptimalTime(territories: RoutePoint[]) {
    const timeSlotCount = new Map<string, number>();
    territories.forEach((t) => {
      timeSlotCount.set(
        t.optimalTimeSlot,
        (timeSlotCount.get(t.optimalTimeSlot) || 0) + 1
      );
    });

    let bestTimeSlot = "morning";
    let maxCount = 0;
    timeSlotCount.forEach((count, slot) => {
      if (count > maxCount) {
        maxCount = count;
        bestTimeSlot = slot;
      }
    });

    return {
      day: Math.floor(Math.random() * 5) + 1, // Lunes a Viernes
      timeSlot: bestTimeSlot,
    };
  }

  // Función principal de optimización de rutas
  optimizeRoute(
    conductorId: string,
    config: RouteOptimizationConfig
  ): OptimizedRoute {
    // Seleccionar territorios candidatos
    const candidateTerritories = this.selectCandidateTerritories(config);

    // Aplicar filtros basados en habilidades del conductor
    const filteredTerritories = this.applySkillBasedFiltering(
      candidateTerritories,
      config.conductorSkills
    );

    // Optimizar usando diferentes algoritmos
    const tspRoute = this.solveTSP(filteredTerritories, config);
    const greedyRoute = this.greedyOptimization(filteredTerritories, config);
    const mlRoute = this.mlBasedOptimization(filteredTerritories, config);

    // Seleccionar la mejor ruta
    const routes = [tspRoute, greedyRoute, mlRoute];
    const bestRoute = routes.reduce((best, current) =>
      current.efficiencyScore > best.efficiencyScore ? current : best
    );

    // Generar alternativas
    const alternatives = routes
      .filter((route) => route.id !== bestRoute.id)
      .map((route) => this.convertToAlternative(route))
      .slice(0, 2);

    const optimizedRoute: OptimizedRoute = {
      ...bestRoute,
      id: `route_${Date.now()}_${conductorId}`,
      conductorId,
      alternativeRoutes: alternatives,
      recommendations: this.generateRouteRecommendations(bestRoute, config),
    };

    // Guardar en historial
    this.optimizationHistory.push(optimizedRoute);
    if (this.optimizationHistory.length > 100) {
      this.optimizationHistory.shift(); // Mantener solo las últimas 100
    }

    this.notifySubscribers();
    return optimizedRoute;
  }

  private selectCandidateTerritories(
    config: RouteOptimizationConfig
  ): RoutePoint[] {
    let candidates = Array.from(this.territories.values());

    // Filtrar por visitas recientes si está habilitado
    if (config.avoidRecentVisits) {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      candidates = candidates.filter(
        (t) => !t.lastVisited || t.lastVisited < threeDaysAgo
      );
    }

    // Filtrar por tiempo óptimo
    if (config.timeSlotPreference !== "any") {
      candidates = candidates.filter(
        (t) => t.optimalTimeSlot === config.timeSlotPreference
      );
    }

    // Ordenar por prioridad y éxito
    candidates.sort((a, b) => {
      if (config.prioritizeSuccess) {
        return (
          b.successProbability * b.priority - a.successProbability * a.priority
        );
      }
      return b.priority - a.priority;
    });

    return candidates.slice(
      0,
      Math.min(config.maxTerritories * 2, candidates.length)
    );
  }

  private applySkillBasedFiltering(
    territories: RoutePoint[],
    skills: ConductorSkills
  ): RoutePoint[] {
    return territories.map((territory) => {
      // Ajustar probabilidad de éxito basada en experiencia del conductor
      const experienceBonus =
        skills.territoryExperience.get(territory.territory) || 0;
      const timeSlotBonus =
        skills.timeSlotPreference.get(territory.optimalTimeSlot) || 0;

      return {
        ...territory,
        successProbability: Math.min(
          0.95,
          territory.successProbability +
            experienceBonus * 0.2 +
            timeSlotBonus * 0.1
        ),
        estimatedDuration:
          territory.estimatedDuration * (1 - experienceBonus * 0.15),
      };
    });
  }

  // Algoritmo TSP (Traveling Salesman Problem) simplificado
  private solveTSP(
    territories: RoutePoint[],
    config: RouteOptimizationConfig
  ): OptimizedRoute {
    if (territories.length === 0) {
      return this.createEmptyRoute("tsp");
    }

    const maxTerritories = Math.min(config.maxTerritories, territories.length);
    let bestRoute: RoutePoint[] = [];
    let bestDistance = Infinity;

    // Para territorios pequeños, usar fuerza bruta optimizada
    if (maxTerritories <= 8) {
      const permutations = this.generatePermutations(
        territories.slice(0, maxTerritories)
      );

      permutations.forEach((permutation) => {
        const distance = this.calculateRouteDistance(permutation);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestRoute = permutation;
        }
      });
    } else {
      // Para territorios grandes, usar nearest neighbor con mejoras
      bestRoute = this.nearestNeighborTSP(territories, maxTerritories);
      bestDistance = this.calculateRouteDistance(bestRoute);
    }

    const totalTime = bestRoute.reduce(
      (sum, point) => sum + point.estimatedDuration,
      0
    );
    const expectedCalls = bestRoute.length;
    const avgSuccessRate =
      bestRoute.reduce((sum, point) => sum + point.successProbability, 0) /
      bestRoute.length;

    return {
      id: "tsp_route",
      conductorId: "",
      points: bestRoute,
      totalDistance: bestDistance,
      estimatedTime: totalTime,
      expectedCalls,
      efficiencyScore: this.calculateEfficiencyScore(
        bestDistance,
        totalTime,
        avgSuccessRate
      ),
      recommendations: [],
      alternativeRoutes: [],
    };
  }

  private generatePermutations(arr: RoutePoint[]): RoutePoint[][] {
    if (arr.length <= 1) return [arr];

    const result: RoutePoint[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      const perms = this.generatePermutations(rest);
      perms.forEach((perm) => {
        result.push([arr[i]].concat(perm));
      });
    }
    return result.slice(0, 5000); // Limitar para rendimiento
  }

  private nearestNeighborTSP(
    territories: RoutePoint[],
    maxTerritories: number
  ): RoutePoint[] {
    if (territories.length === 0) return [];

    const route: RoutePoint[] = [];
    const remaining = [...territories];

    // Comenzar con el territorio de mayor prioridad
    let current = remaining.reduce((best, territory) =>
      territory.priority > best.priority ? territory : best
    );

    route.push(current);
    remaining.splice(remaining.indexOf(current), 1);

    // Agregar territorios siguiendo el vecino más cercano
    while (route.length < maxTerritories && remaining.length > 0) {
      let nearest = remaining[0];
      let minDistance = this.calculateDistance(
        current.latitude,
        current.longitude,
        nearest.latitude,
        nearest.longitude
      );

      remaining.forEach((territory) => {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          territory.latitude,
          territory.longitude
        );

        // Considerar distancia y probabilidad de éxito
        const score = distance / (territory.successProbability + 0.1);
        const nearestScore = minDistance / (nearest.successProbability + 0.1);

        if (score < nearestScore) {
          minDistance = distance;
          nearest = territory;
        }
      });

      route.push(nearest);
      remaining.splice(remaining.indexOf(nearest), 1);
      current = nearest;
    }

    return route;
  }

  // Optimización greedy basada en eficiencia
  private greedyOptimization(
    territories: RoutePoint[],
    config: RouteOptimizationConfig
  ): OptimizedRoute {
    const maxTerritories = Math.min(config.maxTerritories, territories.length);
    const route: RoutePoint[] = [];
    const remaining = [...territories];

    let currentTime = 0;
    let currentLat = 25.6866; // Punto de inicio (oficina)
    let currentLng = -80.1917;

    while (
      route.length < maxTerritories &&
      remaining.length > 0 &&
      currentTime < config.maxTravelTime
    ) {
      let bestTerritory: RoutePoint | null = null;
      let bestScore = -Infinity;

      remaining.forEach((territory) => {
        const distance = this.calculateDistance(
          currentLat,
          currentLng,
          territory.latitude,
          territory.longitude
        );
        const travelTime = distance * 60; // Asumir 1 km = 1 minuto

        if (
          currentTime + travelTime + territory.estimatedDuration <=
          config.maxTravelTime
        ) {
          // Calcular score basado en múltiples factores
          const distanceScore = 1 / (distance + 0.1); // Prefiere cercanía
          const successScore = territory.successProbability * 2; // Prefiere alto éxito
          const priorityScore = territory.priority * 0.5; // Considera prioridad
          const timeScore =
            config.timeSlotPreference === territory.optimalTimeSlot ? 1 : 0.5;

          const totalScore =
            distanceScore + successScore + priorityScore + timeScore;

          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestTerritory = territory;
          }
        }
      });

      if (bestTerritory) {
        route.push(bestTerritory);
        remaining.splice(remaining.indexOf(bestTerritory), 1);

        const travelTime =
          this.calculateDistance(
            currentLat,
            currentLng,
            (bestTerritory as any).latitude,
            (bestTerritory as any).longitude
          ) * 60;
        currentTime += travelTime + (bestTerritory as any).estimatedDuration;
        currentLat = (bestTerritory as any).latitude;
        currentLng = (bestTerritory as any).longitude;
      } else {
        break; // No más territorios viables
      }
    }

    const totalDistance = this.calculateRouteDistance(route);
    const avgSuccessRate =
      route.length > 0
        ? route.reduce((sum, point) => sum + point.successProbability, 0) /
          route.length
        : 0;

    return {
      id: "greedy_route",
      conductorId: "",
      points: route,
      totalDistance,
      estimatedTime: currentTime,
      expectedCalls: route.length,
      efficiencyScore: this.calculateEfficiencyScore(
        totalDistance,
        currentTime,
        avgSuccessRate
      ),
      recommendations: [],
      alternativeRoutes: [],
    };
  }

  // Optimización basada en machine learning
  private mlBasedOptimization(
    territories: RoutePoint[],
    config: RouteOptimizationConfig
  ): OptimizedRoute {
    const model = this.models.get("distance-optimizer")!;
    const params = model.parameters;

    // Usar clustering para pre-filtrar territorios
    const relevantClusters = this.clusters.filter((cluster) => {
      const clusterTerritories = territories.filter((t) =>
        cluster.territories.includes(t.territory)
      );
      return clusterTerritories.length > 0;
    });

    let bestRoute: RoutePoint[] = [];
    let bestScore = -Infinity;

    // Evaluar rutas dentro de cada cluster
    relevantClusters.forEach((cluster) => {
      const clusterTerritories = territories.filter((t) =>
        cluster.territories.includes(t.territory)
      );
      const clusterRoute = this.optimizeClusterRoute(
        clusterTerritories,
        config,
        params
      );

      const score = this.calculateMLScore(clusterRoute, params);
      if (score > bestScore) {
        bestScore = score;
        bestRoute = clusterRoute;
      }
    });

    // Si no hay rutas por cluster, usar optimización global
    if (bestRoute.length === 0) {
      bestRoute = this.nearestNeighborTSP(territories, config.maxTerritories);
    }

    const totalDistance = this.calculateRouteDistance(bestRoute);
    const totalTime = bestRoute.reduce(
      (sum, point) => sum + point.estimatedDuration,
      0
    );
    const avgSuccessRate =
      bestRoute.length > 0
        ? bestRoute.reduce((sum, point) => sum + point.successProbability, 0) /
          bestRoute.length
        : 0;

    return {
      id: "ml_route",
      conductorId: "",
      points: bestRoute,
      totalDistance,
      estimatedTime: totalTime,
      expectedCalls: bestRoute.length,
      efficiencyScore: this.calculateEfficiencyScore(
        totalDistance,
        totalTime,
        avgSuccessRate
      ),
      recommendations: [],
      alternativeRoutes: [],
    };
  }

  private optimizeClusterRoute(
    territories: RoutePoint[],
    config: RouteOptimizationConfig,
    params: any
  ): RoutePoint[] {
    const maxTerritories = Math.min(config.maxTerritories, territories.length);

    // Combinar TSP local con ponderación ML
    const weightedTerritories = territories.map((territory) => {
      const distanceWeight = 1 / (territory.latitude + territory.longitude); // Simplificado
      const successWeight = territory.successProbability;
      const priorityWeight = territory.priority / 5;

      const mlScore =
        distanceWeight * params.distanceWeight +
        successWeight * params.successWeight +
        priorityWeight * params.timeWeight;

      return { ...territory, mlScore };
    });

    // Seleccionar top territorios por score ML
    weightedTerritories.sort((a, b) => (b as any).mlScore - (a as any).mlScore);
    const selectedTerritories = weightedTerritories.slice(0, maxTerritories);

    // Aplicar TSP a territorios seleccionados
    return this.nearestNeighborTSP(selectedTerritories, maxTerritories);
  }

  private calculateMLScore(route: RoutePoint[], params: any): number {
    if (route.length === 0) return 0;

    const distance = this.calculateRouteDistance(route);
    const avgSuccess =
      route.reduce((sum, point) => sum + point.successProbability, 0) /
      route.length;
    const totalTime = route.reduce(
      (sum, point) => sum + point.estimatedDuration,
      0
    );
    const avgPriority =
      route.reduce((sum, point) => sum + point.priority, 0) / route.length;

    // Normalizar métricas (0-1)
    const normalizedDistance = Math.max(0, 1 - distance / 100); // Asumir 100km como máximo
    const normalizedTime = Math.max(0, 1 - totalTime / 480); // 8 horas máximo

    return (
      normalizedDistance * params.distanceWeight +
      avgSuccess * params.successWeight +
      normalizedTime * params.timeWeight +
      (avgPriority / 5) * params.skillWeight
    );
  }

  private convertToAlternative(route: OptimizedRoute): AlternativeRoute {
    const pros: string[] = [];
    const cons: string[] = [];

    if (route.efficiencyScore > 0.7) pros.push("Alta eficiencia general");
    if (route.totalDistance < 50) pros.push("Distancia corta");
    if (route.expectedCalls > 5) pros.push("Alto número de llamadas");

    if (route.efficiencyScore < 0.5) cons.push("Eficiencia mejorable");
    if (route.totalDistance > 80) cons.push("Distancia considerable");
    if (route.estimatedTime > 400) cons.push("Tiempo extenso");

    return {
      id: `alt_${route.id}`,
      points: route.points,
      totalDistance: route.totalDistance,
      estimatedTime: route.estimatedTime,
      pros: pros.length > 0 ? pros : ["Ruta alternativa viable"],
      cons: cons.length > 0 ? cons : ["Sin inconvenientes significativos"],
      efficiencyScore: route.efficiencyScore,
    };
  }

  private generateRouteRecommendations(
    route: OptimizedRoute,
    config: RouteOptimizationConfig
  ): string[] {
    const recommendations: string[] = [];

    if (route.efficiencyScore < 0.6) {
      recommendations.push(
        "Considera reorganizar el orden de visitas para mayor eficiencia"
      );
    }

    if (route.totalDistance > 80) {
      recommendations.push(
        "Ruta extensa - programa descansos cada 2-3 territorios"
      );
    }

    if (route.points.some((p) => p.successProbability < 0.3)) {
      recommendations.push(
        "Algunos territorios tienen baja probabilidad - considera horarios alternativos"
      );
    }

    const morningTerritories = route.points.filter(
      (p) => p.optimalTimeSlot === "morning"
    ).length;
    if (morningTerritories > route.points.length * 0.7) {
      recommendations.push(
        "Ruta optimizada para horario matutino - comenzar temprano"
      );
    }

    if (route.estimatedTime > 6 * 60) {
      // Más de 6 horas
      recommendations.push(
        "Jornada larga planificada - asegurar hidratación y pausas"
      );
    }

    return recommendations.length > 0
      ? recommendations
      : ["Ruta optimizada - seguir el orden sugerido"];
  }

  // Funciones de utilidad
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateRouteDistance(route: RoutePoint[]): number {
    if (route.length === 0) return 0;

    let totalDistance = 0;
    const startLat = 25.6866; // Oficina
    const startLng = -80.1917;

    // Distancia desde oficina al primer territorio
    if (route.length > 0) {
      totalDistance += this.calculateDistance(
        startLat,
        startLng,
        route[0].latitude,
        route[0].longitude
      );
    }

    // Distancias entre territorios
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += this.calculateDistance(
        route[i].latitude,
        route[i].longitude,
        route[i + 1].latitude,
        route[i + 1].longitude
      );
    }

    // Distancia de regreso a la oficina
    if (route.length > 0) {
      const lastTerritory = route[route.length - 1];
      totalDistance += this.calculateDistance(
        lastTerritory.latitude,
        lastTerritory.longitude,
        startLat,
        startLng
      );
    }

    return totalDistance;
  }

  private calculateEfficiencyScore(
    distance: number,
    time: number,
    successRate: number
  ): number {
    // Normalizar métricas
    const normalizedDistance = Math.max(0, 1 - distance / 150); // 150km como máximo
    const normalizedTime = Math.max(0, 1 - time / 600); // 10 horas como máximo
    const normalizedSuccess = successRate;

    // Combinar con pesos
    return (
      normalizedDistance * 0.3 + normalizedTime * 0.3 + normalizedSuccess * 0.4
    );
  }

  private createEmptyRoute(type: string): OptimizedRoute {
    return {
      id: `${type}_empty`,
      conductorId: "",
      points: [],
      totalDistance: 0,
      estimatedTime: 0,
      expectedCalls: 0,
      efficiencyScore: 0,
      recommendations: ["No hay territorios disponibles para optimizar"],
      alternativeRoutes: [],
    };
  }

  // Funciones públicas adicionales
  getClusters(): TerritoryCluster[] {
    return [...this.clusters];
  }

  getOptimizationHistory(): OptimizedRoute[] {
    return [...this.optimizationHistory];
  }

  getRouteMetrics(): RouteMetrics {
    const totalRoutes = this.optimizationHistory.length;
    const avgEfficiency =
      totalRoutes > 0
        ? this.optimizationHistory.reduce(
            (sum, route) => sum + route.efficiencyScore,
            0
          ) / totalRoutes
        : 0;

    const totalDistance = this.optimizationHistory.reduce(
      (sum, route) => sum + route.totalDistance,
      0
    );

    // Simular mejoras comparando con rutas no optimizadas
    const avgImprovement = 0.25 + Math.random() * 0.15; // 25-40% mejora
    const avgSuccessImprovement = 0.18 + Math.random() * 0.12; // 18-30% mejora

    return {
      totalRoutesOptimized: totalRoutes,
      avgEfficiencyImprovement: avgImprovement,
      totalDistanceSaved: totalDistance * 0.2, // 20% de ahorro estimado
      avgSuccessRateImprovement: avgSuccessImprovement,
      modelAccuracy:
        Array.from(this.models.values()).reduce(
          (sum, model) => sum + model.accuracy,
          0
        ) / this.models.size,
      activeOptimizations: Math.floor(Math.random() * 5) + 2, // 2-6 optimizaciones activas
    };
  }

  // Entrenar modelos con nuevos datos
  async trainModels(newRouteData: OptimizedRoute[]): Promise<void> {
    // Simular entrenamiento
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.models.forEach((model, key) => {
      // Simular mejora en accuracy
      const improvement = Math.random() * 0.03; // Hasta 3% de mejora
      model.accuracy = Math.min(0.98, model.accuracy + improvement);
      model.trainingData += newRouteData.length;
      model.lastUpdated = new Date();
    });

    this.notifySubscribers();
  }

  // Suscripciones para actualizaciones
  subscribe(callback: (metrics: RouteMetrics) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    const metrics = this.getRouteMetrics();
    this.subscribers.forEach((callback) => callback(metrics));
  }
}

// Hook personalizado para optimización de rutas
export const useRouteOptimization = () => {
  const [engine] = useState(() => new RouteOptimizationEngine());
  const [metrics, setMetrics] = useState<RouteMetrics | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });

    // Inicializar métricas
    setMetrics(engine.getRouteMetrics());

    return unsubscribe;
  }, [engine]);

  const optimizeRoute = useCallback(
    async (conductorId: string, config: RouteOptimizationConfig) => {
      setIsOptimizing(true);
      try {
        // Simular tiempo de procesamiento
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return engine.optimizeRoute(conductorId, config);
      } finally {
        setIsOptimizing(false);
      }
    },
    [engine]
  );

  const getClusters = useCallback(() => {
    return engine.getClusters();
  }, [engine]);

  const getOptimizationHistory = useCallback(() => {
    return engine.getOptimizationHistory();
  }, [engine]);

  const trainModels = useCallback(
    async (newData: OptimizedRoute[]) => {
      setIsTraining(true);
      try {
        await engine.trainModels(newData);
      } finally {
        setIsTraining(false);
      }
    },
    [engine]
  );

  return {
    metrics,
    isOptimizing,
    isTraining,
    optimizeRoute,
    getClusters,
    getOptimizationHistory,
    trainModels,
  };
};

export type {
  RoutePoint,
  OptimizedRoute,
  AlternativeRoute,
  RouteOptimizationConfig,
  ConductorSkills,
  TerritoryCluster,
  RouteMetrics,
};
