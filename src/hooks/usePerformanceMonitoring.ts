import { useState, useEffect, useRef, useCallback } from "react";

// Tipos para las métricas de rendimiento
export interface PerformanceMetrics {
  // Core Web Vitals
  cls: number | null; // Cumulative Layout Shift
  fid: number | null; // First Input Delay
  lcp: number | null; // Largest Contentful Paint
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte

  // Métricas de memoria
  usedJSMemory: number;
  totalJSMemory: number;
  memoryUsagePercent: number;

  // Métricas de red
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;

  // Métricas de usuario
  pageLoadTime: number;
  timeOnPage: number;
  bounceRate: number;

  // Métricas de aplicación
  activeUsers: number;
  errorCount: number;
  lastErrorTime: Date | null;

  // Timestamp
  timestamp: Date;
}

export interface PerformanceAlert {
  id: string;
  type: "warning" | "error" | "critical";
  message: string;
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private observers: PerformanceObserver[] = [];
  private startTime: number;
  private listeners: ((metrics: PerformanceMetrics) => void)[] = [];
  private alertListeners: ((alert: PerformanceAlert) => void)[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = performance.now();
    this.metrics = this.getInitialMetrics();
    this.initializeObservers();
    this.startMonitoring();
  }

  private getInitialMetrics(): PerformanceMetrics {
    const connection = (navigator as any).connection || {};
    const memory = (performance as any).memory || {};

    return {
      cls: null,
      fid: null,
      lcp: null,
      fcp: null,
      ttfb: null,
      usedJSMemory: memory.usedJSMemory || 0,
      totalJSMemory: memory.totalJSMemory || 0,
      memoryUsagePercent: memory.totalJSMemory
        ? (memory.usedJSMemory / memory.totalJSMemory) * 100
        : 0,
      connectionType: connection.type || "unknown",
      effectiveType: connection.effectiveType || "unknown",
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      pageLoadTime: 0,
      timeOnPage: 0,
      bounceRate: 0,
      activeUsers: 1,
      errorCount: 0,
      lastErrorTime: null,
      timestamp: new Date(),
    };
  }

  private initializeObservers() {
    // Observer para Core Web Vitals
    if ("PerformanceObserver" in window) {
      // LCP Observer
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.updateMetric("lcp", lastEntry.startTime);
      });

      // FID Observer
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.updateMetric("fid", entry.processingStart - entry.startTime);
        });
      });

      // CLS Observer
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.updateMetric("cls", clsValue);
      });

      try {
        lcpObserver.observe({
          type: "largest-contentful-paint",
          buffered: true,
        });
        fidObserver.observe({ type: "first-input", buffered: true });
        clsObserver.observe({ type: "layout-shift", buffered: true });

        this.observers.push(lcpObserver, fidObserver, clsObserver);
      } catch (error) {
        console.warn("Some performance observers are not supported:", error);
      }
    }

    // Navigation Timing para FCP y TTFB
    if ("performance" in window && "getEntriesByType" in performance) {
      const navigationEntries = performance.getEntriesByType(
        "navigation"
      ) as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0];
        this.updateMetric("ttfb", nav.responseStart - nav.fetchStart);
        this.updateMetric("pageLoadTime", nav.loadEventEnd - nav.fetchStart);
      }

      // Paint Timing para FCP
      const paintEntries = performance.getEntriesByType("paint");
      paintEntries.forEach((entry) => {
        if (entry.name === "first-contentful-paint") {
          this.updateMetric("fcp", entry.startTime);
        }
      });
    }
  }

  private updateMetric(key: keyof PerformanceMetrics, value: any) {
    this.metrics[key] = value as never;
    this.metrics.timestamp = new Date();
    this.checkThresholds(key, value);
    this.notifyListeners();
  }

  private checkThresholds(metric: keyof PerformanceMetrics, value: number) {
    const thresholds = {
      lcp: 2500, // ms
      fid: 100, // ms
      cls: 0.1, // score
      fcp: 1800, // ms
      ttfb: 600, // ms
      memoryUsagePercent: 85, // %
      pageLoadTime: 3000, // ms
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (threshold && value > threshold) {
      const alert: PerformanceAlert = {
        id: `${metric}-${Date.now()}`,
        type: value > threshold * 1.5 ? "critical" : "warning",
        message: `${metric.toUpperCase()} exceeded threshold: ${value.toFixed(
          2
        )} > ${threshold}`,
        metric,
        value,
        threshold,
        timestamp: new Date(),
      };

      this.alertListeners.forEach((listener) => listener(alert));
    }
  }

  private startMonitoring() {
    this.intervalId = setInterval(() => {
      // Actualizar métricas de memoria
      const memory = (performance as any).memory;
      if (memory) {
        this.metrics.usedJSMemory = memory.usedJSMemory;
        this.metrics.totalJSMemory = memory.totalJSMemory;
        this.metrics.memoryUsagePercent =
          (memory.usedJSMemory / memory.totalJSMemory) * 100;
      }

      // Actualizar tiempo en página
      this.metrics.timeOnPage = performance.now() - this.startTime;

      // Actualizar timestamp
      this.metrics.timestamp = new Date();

      this.notifyListeners();
    }, 5000); // Actualizar cada 5 segundos
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener({ ...this.metrics }));
  }

  public subscribe(listener: (metrics: PerformanceMetrics) => void) {
    this.listeners.push(listener);
    // Enviar métricas actuales inmediatamente
    listener({ ...this.metrics });

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeToAlerts(listener: (alert: PerformanceAlert) => void) {
    this.alertListeners.push(listener);

    return () => {
      this.alertListeners = this.alertListeners.filter((l) => l !== listener);
    };
  }

  public recordError(error: Error, context?: string) {
    this.metrics.errorCount++;
    this.metrics.lastErrorTime = new Date();

    const alert: PerformanceAlert = {
      id: `error-${Date.now()}`,
      type: "error",
      message: `Error recorded: ${error.message}${
        context ? ` (${context})` : ""
      }`,
      metric: "errorCount",
      value: this.metrics.errorCount,
      threshold: 0,
      timestamp: new Date(),
    };

    this.alertListeners.forEach((listener) => listener(alert));
    this.notifyListeners();
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.listeners = [];
    this.alertListeners = [];
  }
}

// Singleton para el monitor de rendimiento
let performanceMonitor: PerformanceMonitor | null = null;

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!performanceMonitor) {
      performanceMonitor = new PerformanceMonitor();
    }

    setIsMonitoring(true);

    const unsubscribeMetrics = performanceMonitor.subscribe(setMetrics);
    const unsubscribeAlerts = performanceMonitor.subscribeToAlerts((alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50)); // Mantener solo las últimas 50 alertas
    });

    return () => {
      unsubscribeMetrics();
      unsubscribeAlerts();
      setIsMonitoring(false);
    };
  }, []);

  const recordError = useCallback((error: Error, context?: string) => {
    performanceMonitor?.recordError(error, context);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const getMetricsSnapshot = useCallback(() => {
    return performanceMonitor?.getMetrics() || null;
  }, []);

  return {
    metrics,
    alerts,
    isMonitoring,
    recordError,
    clearAlerts,
    getMetricsSnapshot,
  };
};

// Hook para componentes que quieren reportar errores automáticamente
export const useErrorReporting = () => {
  const { recordError } = usePerformanceMonitoring();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      recordError(
        new Error(event.message),
        `${event.filename}:${event.lineno}`
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      recordError(new Error(event.reason), "Unhandled Promise Rejection");
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, [recordError]);

  return { recordError };
};
