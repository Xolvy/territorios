import { useState, useEffect, useCallback, useRef } from "react";

// Interfaces para el sistema de monitoreo
export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    latency: number;
    throughput: number;
    errors: number;
  };
  database: {
    connections: number;
    queryTime: number;
    errors: number;
    status: "healthy" | "warning" | "critical";
  };
  api: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    status: "healthy" | "warning" | "critical";
  };
}

export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  navigationTiming: {
    dns: number;
    tcp: number;
    request: number;
    response: number;
    dom: number;
    load: number;
  };
}

export interface HealthCheck {
  id: string;
  name: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  lastCheck: Date;
  responseTime: number;
  message: string;
  endpoint?: string;
  dependencies: string[];
}

export interface Alert {
  id: string;
  type: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  resolved: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsCollectionInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
    diskUsage: number;
  };
  retentionPeriod: number; // días
  alertChannels: {
    email: boolean;
    sms: boolean;
    slack: boolean;
    webhook: boolean;
  };
}

export interface MonitoringMetrics {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  averageResponseTime: number;
  uptime: number;
  healthScore: number;
  lastUpdateTime: Date;
  systemLoad: "low" | "medium" | "high" | "critical";
}

// Clase principal del sistema de monitoreo
class RealTimeMonitoringSystem {
  private metrics: SystemMetrics;
  private performanceData: PerformanceMetrics;
  private healthChecks: Map<string, HealthCheck>;
  private alerts: Alert[];
  private config: MonitoringConfig;
  private subscribers: Map<string, (data: any) => void>;
  private intervalIds: NodeJS.Timeout[];
  private isRunning: boolean;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.performanceData = this.initializePerformanceData();
    this.healthChecks = new Map();
    this.alerts = [];
    this.config = this.getDefaultConfig();
    this.subscribers = new Map();
    this.intervalIds = [];
    this.isRunning = false;

    this.initializeHealthChecks();
    this.startPerformanceMonitoring();
  }

  private initializeMetrics(): SystemMetrics {
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: {
        latency: 0,
        throughput: 0,
        errors: 0,
      },
      database: {
        connections: 0,
        queryTime: 0,
        errors: 0,
        status: "healthy",
      },
      api: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        status: "healthy",
      },
    };
  }

  private initializePerformanceData(): PerformanceMetrics {
    return {
      pageLoadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      cumulativeLayoutShift: 0,
      timeToInteractive: 0,
      navigationTiming: {
        dns: 0,
        tcp: 0,
        request: 0,
        response: 0,
        dom: 0,
        load: 0,
      },
    };
  }

  private getDefaultConfig(): MonitoringConfig {
    return {
      healthCheckInterval: 30000, // 30 segundos
      metricsCollectionInterval: 5000, // 5 segundos
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        responseTime: 2000,
        errorRate: 5,
        diskUsage: 90,
      },
      retentionPeriod: 30,
      alertChannels: {
        email: true,
        sms: false,
        slack: true,
        webhook: false,
      },
    };
  }

  private initializeHealthChecks(): void {
    const healthChecks = [
      {
        id: "firebase-connection",
        name: "Firebase Connection",
        endpoint: "/api/health/firebase",
        dependencies: ["database"],
      },
      {
        id: "api-endpoints",
        name: "API Endpoints",
        endpoint: "/api/health/api",
        dependencies: ["server"],
      },
      {
        id: "authentication",
        name: "Authentication Service",
        endpoint: "/api/health/auth",
        dependencies: ["firebase", "oauth"],
      },
      {
        id: "file-storage",
        name: "File Storage",
        endpoint: "/api/health/storage",
        dependencies: ["firebase-storage"],
      },
      {
        id: "external-apis",
        name: "External APIs",
        endpoint: "/api/health/external",
        dependencies: ["network"],
      },
    ];

    healthChecks.forEach((check) => {
      this.healthChecks.set(check.id, {
        ...check,
        status: "unknown",
        lastCheck: new Date(),
        responseTime: 0,
        message: "Waiting for first check...",
      });
    });
  }

  private startPerformanceMonitoring(): void {
    if (typeof window !== "undefined") {
      // Performance Observer para Core Web Vitals
      try {
        // First Contentful Paint
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              this.performanceData.firstContentfulPaint = entry.startTime;
            }
          }
        }).observe({ type: "paint", buffered: true });

        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.performanceData.largestContentfulPaint = lastEntry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });

        // First Input Delay
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.performanceData.firstInputDelay =
              (entry as any).processingStart - entry.startTime;
          }
        }).observe({ type: "first-input", buffered: true });

        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.performanceData.cumulativeLayoutShift = clsValue;
        }).observe({ type: "layout-shift", buffered: true });

        // Navigation Timing
        window.addEventListener("load", () => {
          const navigation = performance.getEntriesByType(
            "navigation"
          )[0] as PerformanceNavigationTiming;
          if (navigation) {
            this.performanceData.navigationTiming = {
              dns: navigation.domainLookupEnd - navigation.domainLookupStart,
              tcp: navigation.connectEnd - navigation.connectStart,
              request: navigation.responseStart - navigation.requestStart,
              response: navigation.responseEnd - navigation.responseStart,
              dom:
                navigation.domContentLoadedEventEnd -
                navigation.domContentLoadedEventStart,
              load: navigation.loadEventEnd - navigation.loadEventStart,
            };
            this.performanceData.pageLoadTime =
              navigation.loadEventEnd - (navigation as any).navigationStart;
          }
        });
      } catch (error) {
        console.warn("Performance monitoring not supported:", error);
      }
    }
  }

  public startMonitoring(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Monitoreo de métricas del sistema
    const metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metricsCollectionInterval);

    // Health checks
    const healthInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.config.healthCheckInterval);

    // Procesamiento de alertas
    const alertInterval = setInterval(() => {
      this.processAlerts();
    }, 10000); // cada 10 segundos

    this.intervalIds.push(metricsInterval, healthInterval, alertInterval);
  }

  public stopMonitoring(): void {
    this.isRunning = false;
    this.intervalIds.forEach((id) => clearInterval(id));
    this.intervalIds = [];
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Simular métricas del sistema (en producción vendría de APIs reales)
      this.metrics = {
        cpu: 20 + Math.random() * 60, // 20-80%
        memory: 30 + Math.random() * 50, // 30-80%
        disk: 15 + Math.random() * 25, // 15-40%
        network: {
          latency: 50 + Math.random() * 200, // 50-250ms
          throughput: 100 + Math.random() * 500, // MB/s
          errors: Math.floor(Math.random() * 5),
        },
        database: {
          connections: 5 + Math.floor(Math.random() * 20),
          queryTime: 10 + Math.random() * 100, // ms
          errors: Math.floor(Math.random() * 3),
          status: this.getDatabaseStatus(),
        },
        api: {
          responseTime: 100 + Math.random() * 500, // ms
          throughput: 50 + Math.random() * 200, // requests/sec
          errorRate: Math.random() * 8, // %
          status: this.getApiStatus(),
        },
      };

      // Notificar suscriptores
      this.notifySubscribers("metrics", this.metrics);

      // Verificar umbrales de alertas
      this.checkAlertThresholds();
    } catch (error) {
      console.error("Error collecting system metrics:", error);
    }
  }

  private getDatabaseStatus(): "healthy" | "warning" | "critical" {
    const queryTime = this.metrics.database.queryTime;
    const errors = this.metrics.database.errors;

    if (errors > 2 || queryTime > 1000) return "critical";
    if (errors > 0 || queryTime > 500) return "warning";
    return "healthy";
  }

  private getApiStatus(): "healthy" | "warning" | "critical" {
    const responseTime = this.metrics.api.responseTime;
    const errorRate = this.metrics.api.errorRate;

    if (errorRate > 5 || responseTime > 2000) return "critical";
    if (errorRate > 2 || responseTime > 1000) return "warning";
    return "healthy";
  }

  private async runHealthChecks(): Promise<void> {
    this.healthChecks.forEach((check, id) => {
      try {
        const startTime = Date.now();

        // Simular health check (en producción sería una llamada HTTP real)
        const isHealthy = Math.random() > 0.1; // 90% probabilidad de estar saludable
        const responseTime = Date.now() - startTime + Math.random() * 200;

        const updatedCheck: HealthCheck = {
          ...check,
          status: isHealthy
            ? "healthy"
            : Math.random() > 0.5
            ? "warning"
            : "critical",
          lastCheck: new Date(),
          responseTime,
          message: isHealthy
            ? "Service is operational"
            : "Service experiencing issues",
        };

        this.healthChecks.set(id, updatedCheck);

        // Crear alerta si el servicio no está saludable
        if (!isHealthy) {
          this.createAlert({
            type: updatedCheck.status === "critical" ? "critical" : "warning",
            title: `Health Check Failed: ${check.name}`,
            message: `${check.name} is ${updatedCheck.status}. ${updatedCheck.message}`,
            source: "health-check",
            metric: id,
            currentValue: responseTime,
          });
        }
      } catch (error) {
        const updatedCheck: HealthCheck = {
          ...check,
          status: "critical",
          lastCheck: new Date(),
          responseTime: 0,
          message: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };

        this.healthChecks.set(id, updatedCheck);
      }
    });

    this.notifySubscribers(
      "healthChecks",
      Array.from(this.healthChecks.values())
    );
  }

  private checkAlertThresholds(): void {
    const { alertThresholds } = this.config;

    // CPU Usage
    if (this.metrics.cpu > alertThresholds.cpuUsage) {
      this.createAlert({
        type: this.metrics.cpu > 90 ? "critical" : "warning",
        title: "High CPU Usage",
        message: `CPU usage is at ${this.metrics.cpu.toFixed(1)}%`,
        source: "system-metrics",
        metric: "cpu",
        threshold: alertThresholds.cpuUsage,
        currentValue: this.metrics.cpu,
      });
    }

    // Memory Usage
    if (this.metrics.memory > alertThresholds.memoryUsage) {
      this.createAlert({
        type: this.metrics.memory > 95 ? "critical" : "warning",
        title: "High Memory Usage",
        message: `Memory usage is at ${this.metrics.memory.toFixed(1)}%`,
        source: "system-metrics",
        metric: "memory",
        threshold: alertThresholds.memoryUsage,
        currentValue: this.metrics.memory,
      });
    }

    // API Response Time
    if (this.metrics.api.responseTime > alertThresholds.responseTime) {
      this.createAlert({
        type: this.metrics.api.responseTime > 5000 ? "critical" : "warning",
        title: "High API Response Time",
        message: `API response time is ${this.metrics.api.responseTime.toFixed(
          0
        )}ms`,
        source: "api-metrics",
        metric: "responseTime",
        threshold: alertThresholds.responseTime,
        currentValue: this.metrics.api.responseTime,
      });
    }

    // Error Rate
    if (this.metrics.api.errorRate > alertThresholds.errorRate) {
      this.createAlert({
        type: this.metrics.api.errorRate > 10 ? "critical" : "warning",
        title: "High Error Rate",
        message: `API error rate is ${this.metrics.api.errorRate.toFixed(1)}%`,
        source: "api-metrics",
        metric: "errorRate",
        threshold: alertThresholds.errorRate,
        currentValue: this.metrics.api.errorRate,
      });
    }
  }

  private createAlert(
    alertData: Omit<Alert, "id" | "timestamp" | "resolved">
  ): void {
    // Evitar alertas duplicadas recientes
    const recentAlert = this.alerts.find(
      (alert) =>
        alert.source === alertData.source &&
        alert.metric === alertData.metric &&
        !alert.resolved &&
        Date.now() - alert.timestamp.getTime() < 300000 // 5 minutos
    );

    if (recentAlert) return;

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData,
    };

    this.alerts.unshift(alert);

    // Limitar número de alertas almacenadas
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(0, 1000);
    }

    this.notifySubscribers("alerts", this.alerts);
    this.sendAlertNotification(alert);
  }

  private async sendAlertNotification(alert: Alert): Promise<void> {
    // En producción, aquí se enviarían notificaciones reales
    console.log(
      `🚨 ALERT [${alert.type.toUpperCase()}]: ${alert.title}`,
      alert
    );

    try {
      // Simular envío de notificaciones según configuración
      if (this.config.alertChannels.email) {
        // await sendEmailNotification(alert);
      }
      if (this.config.alertChannels.slack) {
        // await sendSlackNotification(alert);
      }
      if (this.config.alertChannels.webhook) {
        // await sendWebhookNotification(alert);
      }
    } catch (error) {
      console.error("Error sending alert notification:", error);
    }
  }

  private processAlerts(): void {
    // Auto-resolver alertas antiguas
    const now = Date.now();
    let alertsUpdated = false;

    this.alerts.forEach((alert) => {
      if (!alert.resolved && now - alert.timestamp.getTime() > 3600000) {
        // 1 hora
        // Verificar si la condición aún persiste
        const conditionResolved = this.checkAlertConditionResolved(alert);
        if (conditionResolved) {
          alert.resolved = true;
          alertsUpdated = true;
        }
      }
    });

    if (alertsUpdated) {
      this.notifySubscribers("alerts", this.alerts);
    }
  }

  private checkAlertConditionResolved(alert: Alert): boolean {
    if (!alert.metric || !alert.threshold || !alert.currentValue) {
      return true; // Si no podemos verificar, asumimos que se resolvió
    }

    switch (alert.metric) {
      case "cpu":
        return this.metrics.cpu < alert.threshold;
      case "memory":
        return this.metrics.memory < alert.threshold;
      case "responseTime":
        return this.metrics.api.responseTime < alert.threshold;
      case "errorRate":
        return this.metrics.api.errorRate < alert.threshold;
      default:
        return true;
    }
  }

  private notifySubscribers(event: string, data: any): void {
    this.subscribers.forEach((callback, id) => {
      try {
        callback({ event, data, timestamp: new Date() });
      } catch (error) {
        console.error(`Error notifying subscriber ${id}:`, error);
      }
    });
  }

  // Métodos públicos para la interfaz
  public subscribe(id: string, callback: (data: any) => void): void {
    this.subscribers.set(id, callback);
  }

  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  public getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  public getPerformanceData(): PerformanceMetrics {
    return { ...this.performanceData };
  }

  public getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  public getAlerts(): Alert[] {
    return [...this.alerts];
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      this.notifySubscribers("alerts", this.alerts);
    }
  }

  public resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.notifySubscribers("alerts", this.alerts);
    }
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  public getMonitoringMetrics(): MonitoringMetrics {
    const activeAlerts = this.getActiveAlerts();
    const totalAlerts = this.alerts.length;
    const resolvedAlerts = this.alerts.filter((a) => a.resolved).length;

    // Calcular health score basado en métricas
    const healthScore = this.calculateHealthScore();

    // Determinar carga del sistema
    const systemLoad = this.determineSystemLoad();

    return {
      totalAlerts,
      activeAlerts: activeAlerts.length,
      resolvedAlerts,
      averageResponseTime: this.metrics.api.responseTime,
      uptime: this.calculateUptime(),
      healthScore,
      lastUpdateTime: new Date(),
      systemLoad,
    };
  }

  private calculateHealthScore(): number {
    let score = 100;

    // Penalizar por alertas activas
    const activeAlerts = this.getActiveAlerts();
    score -= activeAlerts.length * 5;

    // Penalizar por métricas altas
    if (this.metrics.cpu > 80) score -= 10;
    if (this.metrics.memory > 85) score -= 10;
    if (this.metrics.api.responseTime > 1000) score -= 15;
    if (this.metrics.api.errorRate > 2) score -= 20;

    // Penalizar por health checks fallando
    const failedHealthChecks = Array.from(this.healthChecks.values()).filter(
      (hc) => hc.status === "critical" || hc.status === "warning"
    );
    score -= failedHealthChecks.length * 8;

    return Math.max(0, Math.min(100, score));
  }

  private determineSystemLoad(): "low" | "medium" | "high" | "critical" {
    const cpuLoad = this.metrics.cpu;
    const memoryLoad = this.metrics.memory;
    const responseTime = this.metrics.api.responseTime;

    if (cpuLoad > 90 || memoryLoad > 95 || responseTime > 3000)
      return "critical";
    if (cpuLoad > 70 || memoryLoad > 80 || responseTime > 1500) return "high";
    if (cpuLoad > 50 || memoryLoad > 60 || responseTime > 800) return "medium";
    return "low";
  }

  private calculateUptime(): number {
    // Simular uptime (en producción sería calculado desde el inicio de la aplicación)
    return 99.5 + Math.random() * 0.5; // 99.5-100%
  }
}

// Hook personalizado para usar el sistema de monitoreo
export const useRealTimeMonitoring = () => {
  const [monitoringSystem] = useState(() => new RealTimeMonitoringSystem());
  const [metrics, setMetrics] = useState<SystemMetrics>(
    monitoringSystem.getMetrics()
  );
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics>(
    monitoringSystem.getPerformanceData()
  );
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>(
    monitoringSystem.getHealthChecks()
  );
  const [alerts, setAlerts] = useState<Alert[]>(monitoringSystem.getAlerts());
  const [monitoringMetrics, setMonitoringMetrics] = useState<MonitoringMetrics>(
    monitoringSystem.getMonitoringMetrics()
  );
  const [isMonitoring, setIsMonitoring] = useState(false);
  const subscriberId = useRef(
    `subscriber_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  useEffect(() => {
    const id = subscriberId.current;

    // Suscribirse a actualizaciones
    monitoringSystem.subscribe(id, (update) => {
      switch (update.event) {
        case "metrics":
          setMetrics(update.data);
          break;
        case "healthChecks":
          setHealthChecks(update.data);
          break;
        case "alerts":
          setAlerts(update.data);
          break;
      }
      // Actualizar métricas de monitoreo
      setMonitoringMetrics(monitoringSystem.getMonitoringMetrics());
    });

    return () => {
      monitoringSystem.unsubscribe(id);
    };
  }, [monitoringSystem]);

  const startMonitoring = useCallback(() => {
    monitoringSystem.startMonitoring();
    setIsMonitoring(true);
  }, [monitoringSystem]);

  const stopMonitoring = useCallback(() => {
    monitoringSystem.stopMonitoring();
    setIsMonitoring(false);
  }, [monitoringSystem]);

  const acknowledgeAlert = useCallback(
    (alertId: string, acknowledgedBy: string) => {
      monitoringSystem.acknowledgeAlert(alertId, acknowledgedBy);
    },
    [monitoringSystem]
  );

  const resolveAlert = useCallback(
    (alertId: string) => {
      monitoringSystem.resolveAlert(alertId);
    },
    [monitoringSystem]
  );

  const updateConfig = useCallback(
    (newConfig: Partial<MonitoringConfig>) => {
      monitoringSystem.updateConfig(newConfig);
    },
    [monitoringSystem]
  );

  return {
    metrics,
    performanceData,
    healthChecks,
    alerts,
    monitoringMetrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    acknowledgeAlert,
    resolveAlert,
    updateConfig,
    getConfig: () => monitoringSystem.getConfig(),
    getActiveAlerts: () => monitoringSystem.getActiveAlerts(),
  };
};
