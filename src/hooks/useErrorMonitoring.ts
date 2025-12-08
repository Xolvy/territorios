import { useState, useEffect, useCallback } from "react";

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  severity: "low" | "medium" | "high" | "critical";
  type: "javascript" | "promise" | "network" | "custom";
  context?: Record<string, any>;
  resolved: boolean;
  occurenceCount: number;
}

export interface ErrorStats {
  totalErrors: number;
  unresolvedErrors: number;
  errorRate: number; // errores por minuto
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: Date;
  }>;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
}

class ErrorMonitoringService {
  private errors: ErrorReport[] = [];
  private listeners: ((errors: ErrorReport[]) => void)[] = [];
  private statsListeners: ((stats: ErrorStats) => void)[] = [];
  private sessionId: string;
  private maxErrors = 1000; // Mantener máximo 1000 errores en memoria
  private errorCounts = new Map<string, number>();

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeErrorHandlers();
    this.startPeriodicReporting();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeErrorHandlers() {
    // Errores de JavaScript globales
    window.addEventListener("error", (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: "javascript",
        severity: this.determineSeverity(event.error),
      });
    });

    // Promesas rechazadas no manejadas
    window.addEventListener("unhandledrejection", (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        type: "promise",
        severity: "high",
      });
    });

    // Errores de red (interceptar fetch)
    this.interceptNetworkErrors();

    // Console errors (opcional)
    this.interceptConsoleErrors();
  }

  private interceptNetworkErrors() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // Reportar errores de red (4xx, 5xx)
        if (!response.ok) {
          this.captureError({
            message: `Network Error: ${response.status} ${response.statusText}`,
            type: "network",
            severity: response.status >= 500 ? "high" : "medium",
            context: {
              url: args[0]?.toString(),
              status: response.status,
              statusText: response.statusText,
            },
          });
        }

        return response;
      } catch (error) {
        this.captureError({
          message: `Fetch Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          stack: error instanceof Error ? error.stack : undefined,
          type: "network",
          severity: "high",
          context: {
            url: args[0]?.toString(),
          },
        });
        throw error;
      }
    };
  }

  private interceptConsoleErrors() {
    const originalError = console.error;
    console.error = (...args) => {
      // Solo capturar si parece un error real
      const message = args.join(" ");
      if (
        message.toLowerCase().includes("error") ||
        message.toLowerCase().includes("failed") ||
        message.toLowerCase().includes("exception")
      ) {
        this.captureError({
          message: `Console Error: ${message}`,
          type: "javascript",
          severity: "low",
        });
      }

      originalError.apply(console, args);
    };
  }

  private determineSeverity(
    error: Error | any
  ): "low" | "medium" | "high" | "critical" {
    if (!error) return "low";

    const message = error.message?.toLowerCase() || "";

    // Errores críticos
    if (
      message.includes("firebase") ||
      message.includes("auth") ||
      message.includes("database") ||
      message.includes("security")
    ) {
      return "critical";
    }

    // Errores altos
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("cors")
    ) {
      return "high";
    }

    // Errores medios
    if (
      message.includes("warning") ||
      message.includes("deprecated") ||
      message.includes("prop")
    ) {
      return "medium";
    }

    return "low";
  }

  public captureError(errorData: Partial<ErrorReport>) {
    const errorKey = `${errorData.message}_${errorData.filename}_${errorData.lineno}`;
    const existingCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, existingCount + 1);

    const error: ErrorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: errorData.message || "Unknown error",
      stack: errorData.stack,
      filename: errorData.filename,
      lineno: errorData.lineno,
      colno: errorData.colno,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
      severity: errorData.severity || "medium",
      type: errorData.type || "javascript",
      context: errorData.context,
      resolved: false,
      occurenceCount: existingCount + 1,
      ...errorData,
    };

    this.errors.unshift(error);

    // Mantener solo los últimos N errores
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Notificar a los listeners
    this.notifyListeners();
    this.notifyStatsListeners();

    // Auto-reportar errores críticos
    if (error.severity === "critical") {
      this.reportCriticalError(error);
    }
  }

  private reportCriticalError(error: ErrorReport) {
    // Aquí podrías enviar el error a un servicio externo
    console.error("🚨 CRITICAL ERROR DETECTED:", error);

    // En producción, enviarías a servicios como Sentry, LogRocket, etc.
    // this.sendToExternalService(error);
  }

  public getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  public getErrorStats(): ErrorStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentErrors = this.errors.filter(
      (error) => error.timestamp.getTime() > oneMinuteAgo
    );

    // Top errores por frecuencia
    const errorCounts = new Map<string, { count: number; lastSeen: Date }>();
    this.errors.forEach((error) => {
      const key = error.message;
      const existing = errorCounts.get(key);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastSeen) {
          existing.lastSeen = error.timestamp;
        }
      } else {
        errorCounts.set(key, { count: 1, lastSeen: error.timestamp });
      }
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Errores por tipo
    const errorsByType: Record<string, number> = {};
    this.errors.forEach((error) => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    // Errores por severidad
    const errorsBySeverity: Record<string, number> = {};
    this.errors.forEach((error) => {
      errorsBySeverity[error.severity] =
        (errorsBySeverity[error.severity] || 0) + 1;
    });

    return {
      totalErrors: this.errors.length,
      unresolvedErrors: this.errors.filter((e) => !e.resolved).length,
      errorRate: recentErrors.length,
      topErrors,
      errorsByType,
      errorsBySeverity,
    };
  }

  public markErrorAsResolved(errorId: string) {
    const error = this.errors.find((e) => e.id === errorId);
    if (error) {
      error.resolved = true;
      this.notifyListeners();
      this.notifyStatsListeners();
    }
  }

  public clearErrors() {
    this.errors = [];
    this.errorCounts.clear();
    this.notifyListeners();
    this.notifyStatsListeners();
  }

  public exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }

  private startPeriodicReporting() {
    setInterval(() => {
      this.notifyStatsListeners();
    }, 30000); // Actualizar estadísticas cada 30 segundos
  }

  public subscribe(listener: (errors: ErrorReport[]) => void) {
    this.listeners.push(listener);
    listener([...this.errors]); // Enviar estado actual

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeToStats(listener: (stats: ErrorStats) => void) {
    this.statsListeners.push(listener);
    listener(this.getErrorStats()); // Enviar estado actual

    return () => {
      this.statsListeners = this.statsListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.errors]));
  }

  private notifyStatsListeners() {
    const stats = this.getErrorStats();
    this.statsListeners.forEach((listener) => listener(stats));
  }

  public destroy() {
    this.listeners = [];
    this.statsListeners = [];
    this.errors = [];
    this.errorCounts.clear();
  }
}

// Singleton para el servicio de monitoreo de errores
let errorMonitoringService: ErrorMonitoringService | null = null;

export const useErrorMonitoring = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [stats, setStats] = useState<ErrorStats>({
    totalErrors: 0,
    unresolvedErrors: 0,
    errorRate: 0,
    topErrors: [],
    errorsByType: {},
    errorsBySeverity: {},
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!errorMonitoringService) {
      errorMonitoringService = new ErrorMonitoringService();
    }

    const unsubscribeErrors = errorMonitoringService.subscribe(setErrors);
    const unsubscribeStats = errorMonitoringService.subscribeToStats(setStats);

    return () => {
      unsubscribeErrors();
      unsubscribeStats();
    };
  }, []);

  const captureError = useCallback((errorData: Partial<ErrorReport>) => {
    errorMonitoringService?.captureError(errorData);
  }, []);

  const markAsResolved = useCallback((errorId: string) => {
    errorMonitoringService?.markErrorAsResolved(errorId);
  }, []);

  const clearAllErrors = useCallback(() => {
    errorMonitoringService?.clearErrors();
  }, []);

  const exportErrors = useCallback(() => {
    return errorMonitoringService?.exportErrors() || "[]";
  }, []);

  return {
    errors,
    stats,
    captureError,
    markAsResolved,
    clearAllErrors,
    exportErrors,
  };
};

// Hook para reportar errores automáticamente en componentes
export const useAutoErrorReporting = () => {
  const { captureError } = useErrorMonitoring();

  const reportError = useCallback(
    (error: Error, context?: Record<string, any>) => {
      captureError({
        message: error.message,
        stack: error.stack,
        type: "custom",
        severity: "medium",
        context,
      });
    },
    [captureError]
  );

  const reportWarning = useCallback(
    (message: string, context?: Record<string, any>) => {
      captureError({
        message: `Warning: ${message}`,
        type: "custom",
        severity: "low",
        context,
      });
    },
    [captureError]
  );

  const reportCritical = useCallback(
    (message: string, context?: Record<string, any>) => {
      captureError({
        message: `Critical: ${message}`,
        type: "custom",
        severity: "critical",
        context,
      });
    },
    [captureError]
  );

  return {
    reportError,
    reportWarning,
    reportCritical,
  };
};
