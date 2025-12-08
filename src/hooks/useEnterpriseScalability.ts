import { useState, useEffect, useCallback, useRef } from "react";

// Tipos para el sistema de escalabilidad
export interface ScalabilityMetrics {
  // Usuarios concurrentes
  concurrentUsers: number;
  maxConcurrentUsers: number;
  userGrowthRate: number;

  // Performance distribuido
  nodeHealth: Record<
    string,
    {
      cpu: number;
      memory: number;
      responseTime: number;
      requestsPerSecond: number;
      status: "healthy" | "warning" | "critical";
    }
  >;

  // Cache distribuido
  cacheHitRate: number;
  cacheNodes: number;
  cacheMemoryUsage: number;
  cacheEvictions: number;

  // Load balancing
  loadDistribution: Record<string, number>;
  activeNodes: number;
  failoverEvents: number;

  // Database scaling
  dbConnections: number;
  maxDbConnections: number;
  queryResponseTime: number;
  dbReplicationLag: number;

  // Network performance
  bandwidth: number;
  latency: number;
  packetLoss: number;

  // Recursos del sistema
  totalMemory: number;
  usedMemory: number;
  cpuUsage: number;
  diskUsage: number;

  timestamp: Date;
}

export interface ScalabilityAlert {
  id: string;
  type: "performance" | "capacity" | "health" | "security";
  severity: "info" | "warning" | "critical" | "emergency";
  title: string;
  message: string;
  node?: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  autoRemediation?: string;
}

export interface ScalabilityRecommendation {
  category: "scaling" | "optimization" | "architecture" | "monitoring";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedCost: string;
  timeframe: string;
}

class EnterpriseScalabilityService {
  private metrics: ScalabilityMetrics;
  private alerts: ScalabilityAlert[] = [];
  private recommendations: ScalabilityRecommendation[] = [];
  private listeners: ((metrics: ScalabilityMetrics) => void)[] = [];
  private alertListeners: ((alerts: ScalabilityAlert[]) => void)[] = [];
  private simulatedNodes: string[] = ["node-1", "node-2", "node-3", "node-4"];
  private intervalId: NodeJS.Timeout | null = null;

  // Simulador de carga para demostración
  private userCount = 0;
  private loadSimulation = {
    peakHours: [9, 10, 11, 14, 15, 16, 19, 20],
    baseLoad: 50,
    peakMultiplier: 3.5,
    isWeekend: false,
  };

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
    this.generateInitialRecommendations();
  }

  private initializeMetrics(): ScalabilityMetrics {
    const nodeHealth: Record<string, any> = {};
    this.simulatedNodes.forEach((node) => {
      nodeHealth[node] = {
        cpu: Math.random() * 60 + 20, // 20-80%
        memory: Math.random() * 50 + 30, // 30-80%
        responseTime: Math.random() * 200 + 50, // 50-250ms
        requestsPerSecond: Math.random() * 500 + 100, // 100-600 RPS
        status: Math.random() > 0.8 ? "warning" : "healthy",
      };
    });

    const loadDistribution: Record<string, number> = {};
    this.simulatedNodes.forEach((node, index) => {
      loadDistribution[node] = 20 + Math.random() * 20 + index * 5; // Distributed load
    });

    return {
      concurrentUsers: this.userCount,
      maxConcurrentUsers: 0,
      userGrowthRate: 0,
      nodeHealth,
      cacheHitRate: 85 + Math.random() * 10, // 85-95%
      cacheNodes: 3,
      cacheMemoryUsage: 60 + Math.random() * 25, // 60-85%
      cacheEvictions: Math.floor(Math.random() * 100),
      loadDistribution,
      activeNodes: this.simulatedNodes.length,
      failoverEvents: 0,
      dbConnections: 45 + Math.floor(Math.random() * 30), // 45-75
      maxDbConnections: 100,
      queryResponseTime: 15 + Math.random() * 35, // 15-50ms
      dbReplicationLag: Math.random() * 5, // 0-5ms
      bandwidth: 850 + Math.random() * 150, // 850-1000 Mbps
      latency: 10 + Math.random() * 20, // 10-30ms
      packetLoss: Math.random() * 0.5, // 0-0.5%
      totalMemory: 32 * 1024 * 1024 * 1024, // 32GB
      usedMemory: 0,
      cpuUsage: 35 + Math.random() * 30, // 35-65%
      diskUsage: 45 + Math.random() * 25, // 45-70%
      timestamp: new Date(),
    };
  }

  private startMonitoring() {
    this.intervalId = setInterval(() => {
      this.updateMetrics();
      this.checkAlerts();
      this.notifyListeners();
    }, 5000); // Update every 5 seconds
  }

  private updateMetrics() {
    const currentHour = new Date().getHours();
    const isPeakHour = this.loadSimulation.peakHours.includes(currentHour);
    const loadMultiplier = isPeakHour ? this.loadSimulation.peakMultiplier : 1;

    // Simulate user growth and fluctuation
    const baseUsers = this.loadSimulation.baseLoad * loadMultiplier;
    const variation = Math.random() * 20 - 10; // ±10%
    const newUserCount = Math.max(1, Math.floor(baseUsers + variation));

    const previousUsers = this.metrics.concurrentUsers;
    this.metrics.concurrentUsers = newUserCount;
    this.metrics.maxConcurrentUsers = Math.max(
      this.metrics.maxConcurrentUsers,
      newUserCount
    );
    this.metrics.userGrowthRate =
      ((newUserCount - previousUsers) / Math.max(previousUsers, 1)) * 100;

    // Calculate load factor for metrics
    const loadFactor = newUserCount / 100; // Scale factor

    // Update node health based on load
    Object.keys(this.metrics.nodeHealth).forEach((node) => {
      const nodeMetrics = this.metrics.nodeHealth[node];

      nodeMetrics.cpu = Math.min(
        95,
        Math.max(
          10,
          nodeMetrics.cpu + (Math.random() * 10 - 5) + loadFactor * 2
        )
      );

      nodeMetrics.memory = Math.min(
        90,
        Math.max(
          20,
          nodeMetrics.memory + (Math.random() * 8 - 4) + loadFactor * 1.5
        )
      );

      nodeMetrics.responseTime = Math.max(
        10,
        nodeMetrics.responseTime + (Math.random() * 20 - 10) + loadFactor * 5
      );

      nodeMetrics.requestsPerSecond = Math.max(
        50,
        Math.floor(
          nodeMetrics.requestsPerSecond +
            (Math.random() * 50 - 25) +
            loadFactor * 10
        )
      );

      // Determine status based on metrics
      if (
        nodeMetrics.cpu > 80 ||
        nodeMetrics.memory > 85 ||
        nodeMetrics.responseTime > 500
      ) {
        nodeMetrics.status = "critical";
      } else if (
        nodeMetrics.cpu > 65 ||
        nodeMetrics.memory > 70 ||
        nodeMetrics.responseTime > 300
      ) {
        nodeMetrics.status = "warning";
      } else {
        nodeMetrics.status = "healthy";
      }
    });

    // Update cache metrics
    this.metrics.cacheHitRate = Math.max(
      70,
      Math.min(98, this.metrics.cacheHitRate + (Math.random() * 4 - 2))
    );

    this.metrics.cacheMemoryUsage = Math.max(
      40,
      Math.min(
        95,
        this.metrics.cacheMemoryUsage +
          (Math.random() * 6 - 3) +
          loadFactor * 0.5
      )
    );

    // Update database metrics
    this.metrics.dbConnections = Math.max(
      20,
      Math.min(
        this.metrics.maxDbConnections - 5,
        Math.floor(
          this.metrics.dbConnections + (Math.random() * 6 - 3) + loadFactor * 2
        )
      )
    );

    this.metrics.queryResponseTime = Math.max(
      5,
      this.metrics.queryResponseTime + (Math.random() * 10 - 5) + loadFactor * 2
    );

    // Update system resources
    this.metrics.usedMemory =
      (this.metrics.totalMemory * (40 + Math.random() * 30 + loadFactor * 5)) /
      100;
    this.metrics.cpuUsage = Math.max(
      10,
      Math.min(
        95,
        this.metrics.cpuUsage + (Math.random() * 8 - 4) + loadFactor * 1.5
      )
    );

    this.metrics.timestamp = new Date();
  }

  private checkAlerts() {
    const newAlerts: ScalabilityAlert[] = [];
    const now = new Date();

    // Check concurrent users threshold
    if (this.metrics.concurrentUsers > 200) {
      newAlerts.push({
        id: `users-${now.getTime()}`,
        type: "capacity",
        severity: this.metrics.concurrentUsers > 500 ? "critical" : "warning",
        title: "High Concurrent Users",
        message: `${this.metrics.concurrentUsers} concurrent users detected`,
        metric: "concurrentUsers",
        currentValue: this.metrics.concurrentUsers,
        threshold: 200,
        timestamp: now,
        autoRemediation: "Scale up additional nodes",
      });
    }

    // Check node health
    Object.entries(this.metrics.nodeHealth).forEach(([node, health]) => {
      if (health.status === "critical") {
        newAlerts.push({
          id: `node-${node}-${now.getTime()}`,
          type: "health",
          severity: "critical",
          title: `Node ${node} Critical`,
          message: `CPU: ${health.cpu.toFixed(
            1
          )}%, Memory: ${health.memory.toFixed(
            1
          )}%, Response: ${health.responseTime.toFixed(0)}ms`,
          node,
          metric: "nodeHealth",
          currentValue: Math.max(health.cpu, health.memory),
          threshold: 80,
          timestamp: now,
          autoRemediation: "Restart services, redistribute load",
        });
      }
    });

    // Check cache hit rate
    if (this.metrics.cacheHitRate < 80) {
      newAlerts.push({
        id: `cache-${now.getTime()}`,
        type: "performance",
        severity: this.metrics.cacheHitRate < 70 ? "critical" : "warning",
        title: "Low Cache Hit Rate",
        message: `Cache hit rate: ${this.metrics.cacheHitRate.toFixed(1)}%`,
        metric: "cacheHitRate",
        currentValue: this.metrics.cacheHitRate,
        threshold: 80,
        timestamp: now,
        autoRemediation: "Optimize cache strategy, increase cache size",
      });
    }

    // Check database connections
    const dbUsagePercent =
      (this.metrics.dbConnections / this.metrics.maxDbConnections) * 100;
    if (dbUsagePercent > 80) {
      newAlerts.push({
        id: `db-${now.getTime()}`,
        type: "capacity",
        severity: dbUsagePercent > 90 ? "emergency" : "critical",
        title: "Database Connection Limit",
        message: `${this.metrics.dbConnections}/${
          this.metrics.maxDbConnections
        } connections (${dbUsagePercent.toFixed(1)}%)`,
        metric: "dbConnections",
        currentValue: dbUsagePercent,
        threshold: 80,
        timestamp: now,
        autoRemediation: "Scale database, implement connection pooling",
      });
    }

    // Add new alerts and limit to last 50
    this.alerts = [...newAlerts, ...this.alerts].slice(0, 50);

    if (newAlerts.length > 0) {
      this.notifyAlertListeners();
    }
  }

  private generateInitialRecommendations() {
    this.recommendations = [
      {
        category: "scaling",
        priority: "high",
        title: "Implement Horizontal Pod Autoscaling",
        description:
          "Configure automatic scaling based on CPU/memory usage and concurrent users",
        impact: "Handle 10x more concurrent users without manual intervention",
        implementation:
          "Set up Kubernetes HPA with custom metrics from concurrent user count",
        estimatedCost: "$200-500/month",
        timeframe: "1-2 weeks",
      },
      {
        category: "optimization",
        priority: "medium",
        title: "Redis Cluster for Distributed Caching",
        description:
          "Implement Redis cluster for high-availability caching across multiple nodes",
        impact:
          "Improve cache hit rate to 95%+ and eliminate single point of failure",
        implementation:
          "Deploy Redis cluster with 3-6 nodes, implement consistent hashing",
        estimatedCost: "$150-300/month",
        timeframe: "2-3 weeks",
      },
      {
        category: "architecture",
        priority: "high",
        title: "Database Read Replicas",
        description: "Implement read replicas to distribute database load",
        impact:
          "Reduce query response time by 60% and support 5x more read operations",
        implementation:
          "Configure Firebase/PostgreSQL read replicas with load balancing",
        estimatedCost: "$300-600/month",
        timeframe: "3-4 weeks",
      },
      {
        category: "monitoring",
        priority: "medium",
        title: "Advanced Observability Stack",
        description:
          "Implement Prometheus, Grafana, and Jaeger for comprehensive monitoring",
        impact:
          "Reduce MTTR by 70% and prevent 90% of outages through predictive alerts",
        implementation:
          "Deploy monitoring stack with custom dashboards and alert rules",
        estimatedCost: "$100-200/month",
        timeframe: "2-3 weeks",
      },
      {
        category: "scaling",
        priority: "critical",
        title: "Content Delivery Network (CDN)",
        description: "Implement global CDN for static assets and API caching",
        impact: "Reduce global latency by 80% and bandwidth costs by 60%",
        implementation: "Configure Cloudflare/AWS CloudFront with edge caching",
        estimatedCost: "$50-150/month",
        timeframe: "1 week",
      },
    ];
  }

  public getMetrics(): ScalabilityMetrics {
    return { ...this.metrics };
  }

  public getAlerts(): ScalabilityAlert[] {
    return [...this.alerts];
  }

  public getRecommendations(): ScalabilityRecommendation[] {
    return [...this.recommendations];
  }

  public dismissAlert(alertId: string) {
    this.alerts = this.alerts.filter((alert) => alert.id !== alertId);
    this.notifyAlertListeners();
  }

  public simulateLoad(userCount: number) {
    this.userCount = userCount;
    this.updateMetrics();
    this.checkAlerts();
    this.notifyListeners();
  }

  public getScalabilityScore(): number {
    let score = 100;

    // Penalize based on alerts
    const criticalAlerts = this.alerts.filter(
      (a) => a.severity === "critical" || a.severity === "emergency"
    ).length;
    const warningAlerts = this.alerts.filter(
      (a) => a.severity === "warning"
    ).length;

    score -= criticalAlerts * 15 + warningAlerts * 5;

    // Penalize based on resource usage
    const avgCpu =
      Object.values(this.metrics.nodeHealth).reduce(
        (sum, node) => sum + node.cpu,
        0
      ) / Object.keys(this.metrics.nodeHealth).length;
    const avgMemory =
      Object.values(this.metrics.nodeHealth).reduce(
        (sum, node) => sum + node.memory,
        0
      ) / Object.keys(this.metrics.nodeHealth).length;

    if (avgCpu > 80) score -= 20;
    else if (avgCpu > 65) score -= 10;

    if (avgMemory > 85) score -= 20;
    else if (avgMemory > 70) score -= 10;

    // Penalize based on cache performance
    if (this.metrics.cacheHitRate < 75) score -= 15;
    else if (this.metrics.cacheHitRate < 85) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  public subscribe(listener: (metrics: ScalabilityMetrics) => void) {
    this.listeners.push(listener);
    listener(this.getMetrics());

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeToAlerts(listener: (alerts: ScalabilityAlert[]) => void) {
    this.alertListeners.push(listener);
    listener(this.getAlerts());

    return () => {
      this.alertListeners = this.alertListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    const metrics = this.getMetrics();
    this.listeners.forEach((listener) => listener(metrics));
  }

  private notifyAlertListeners() {
    const alerts = this.getAlerts();
    this.alertListeners.forEach((listener) => listener(alerts));
  }

  public destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.listeners = [];
    this.alertListeners = [];
  }
}

// Singleton para el servicio de escalabilidad
let scalabilityService: EnterpriseScalabilityService | null = null;

export const useEnterpriseScalability = () => {
  const [metrics, setMetrics] = useState<ScalabilityMetrics | null>(null);
  const [alerts, setAlerts] = useState<ScalabilityAlert[]>([]);
  const [recommendations] = useState<ScalabilityRecommendation[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!scalabilityService) {
      scalabilityService = new EnterpriseScalabilityService();
    }

    const unsubscribeMetrics = scalabilityService.subscribe(setMetrics);
    const unsubscribeAlerts = scalabilityService.subscribeToAlerts(setAlerts);

    return () => {
      unsubscribeMetrics();
      unsubscribeAlerts();
    };
  }, []);

  const simulateLoad = useCallback((userCount: number) => {
    scalabilityService?.simulateLoad(userCount);
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    scalabilityService?.dismissAlert(alertId);
  }, []);

  const getScalabilityScore = useCallback(() => {
    return scalabilityService?.getScalabilityScore() || 0;
  }, []);

  const getRecommendations = useCallback(() => {
    return scalabilityService?.getRecommendations() || [];
  }, []);

  return {
    metrics,
    alerts,
    recommendations: getRecommendations(),
    simulateLoad,
    dismissAlert,
    getScalabilityScore,
    isLoading: !metrics,
  };
};
