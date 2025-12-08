import { useState, useEffect, useCallback, useRef } from "react";

// Interfaces para el sistema de tracking de errores y logging
export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  stack?: string;
  context: ErrorContext;
  tags: string[];
  fingerprint: string;
  resolved: boolean;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
}

export interface ErrorContext {
  component?: string;
  function?: string;
  line?: number;
  column?: number;
  url?: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
  breadcrumbs: Breadcrumb[];
  environment: "development" | "staging" | "production";
  release?: string;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  extra?: Record<string, any>;
}

export interface Breadcrumb {
  id: string;
  timestamp: Date;
  type: "navigation" | "user" | "http" | "error" | "debug" | "info";
  category: string;
  message: string;
  data?: Record<string, any>;
  level: "debug" | "info" | "warn" | "error";
}

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  type: "page_load" | "api_call" | "render" | "interaction" | "bundle_size";
  name: string;
  value: number;
  unit: "ms" | "kb" | "mb" | "count";
  tags: Record<string, string>;
  context: {
    url?: string;
    component?: string;
    userId?: string;
    sessionId?: string;
  };
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error" | "fatal";
  enableConsole: boolean;
  enableRemote: boolean;
  enablePerformanceTracking: boolean;
  enableUserInteractionTracking: boolean;
  maxBreadcrumbs: number;
  maxErrorsInMemory: number;
  sampleRate: number;
  environment: "development" | "staging" | "production";
  release?: string;
  beforeSend?: (error: ErrorLog) => ErrorLog | null;
  integrations: {
    sentry: boolean;
    bugsnag: boolean;
    datadog: boolean;
    custom: boolean;
  };
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorRate: number;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    count: number;
    lastSeen: Date;
  }>;
  errorsByLevel: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsByBrowser: Record<string, number>;
  errorsByUrl: Record<string, number>;
  recentErrors: ErrorLog[];
  performanceIssues: Array<{
    type: string;
    count: number;
    avgValue: number;
    threshold: number;
  }>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    type: "error_count" | "error_rate" | "performance_threshold" | "new_error";
    threshold: number;
    timeWindow: number; // minutos
    level?: ErrorLog["level"];
    component?: string;
  };
  actions: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
  enabled: boolean;
  lastTriggered?: Date;
}

// Clase principal del sistema de error tracking
class ErrorTrackingSystem {
  private errors: Map<string, ErrorLog>;
  private breadcrumbs: Breadcrumb[];
  private performanceMetrics: PerformanceMetric[];
  private config: LoggingConfig;
  private subscribers: Map<string, (data: any) => void>;
  private alertRules: Map<string, AlertRule>;
  private sessionId: string;
  private userId?: string;
  private isInitialized: boolean;

  constructor(config?: Partial<LoggingConfig>) {
    this.errors = new Map();
    this.breadcrumbs = [];
    this.performanceMetrics = [];
    this.config = this.getDefaultConfig(config);
    this.subscribers = new Map();
    this.alertRules = new Map();
    this.sessionId = this.generateSessionId();
    this.isInitialized = false;

    this.initializeErrorHandlers();
    this.initializePerformanceTracking();
    this.setupDefaultAlertRules();
    this.isInitialized = true;
  }

  private getDefaultConfig(userConfig?: Partial<LoggingConfig>): LoggingConfig {
    return {
      level: "info",
      enableConsole: true,
      enableRemote: true,
      enablePerformanceTracking: true,
      enableUserInteractionTracking: true,
      maxBreadcrumbs: 50,
      maxErrorsInMemory: 100,
      sampleRate: 1.0,
      environment: "production",
      integrations: {
        sentry: false,
        bugsnag: false,
        datadog: false,
        custom: true,
      },
      ...userConfig,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeErrorHandlers(): void {
    if (typeof window === "undefined") return;

    // Global error handler
    window.addEventListener("error", (event) => {
      this.captureError(new Error(event.message), {
        component: "global",
        function: "window.onerror",
        line: event.lineno,
        column: event.colno,
        url: event.filename,
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener("unhandledrejection", (event) => {
      this.captureError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        {
          component: "global",
          function: "unhandledrejection",
        }
      );
    });

    // React error boundary integration
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(" ");
      if (message.includes("React") || message.includes("Warning")) {
        this.captureError(new Error(message), {
          component: "react",
          function: "console.error",
        });
      }
      originalConsoleError.apply(console, args);
    };
  }

  private initializePerformanceTracking(): void {
    if (!this.config.enablePerformanceTracking || typeof window === "undefined")
      return;

    // Performance Observer para Core Web Vitals
    try {
      // First Contentful Paint
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            this.trackPerformance(
              "page_load",
              "First Contentful Paint",
              entry.startTime,
              "ms",
              {
                url: window.location.pathname,
              }
            );
          }
        }
      }).observe({ type: "paint", buffered: true });

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.trackPerformance(
          "page_load",
          "Largest Contentful Paint",
          lastEntry.startTime,
          "ms",
          {
            url: window.location.pathname,
          }
        );
      }).observe({ type: "largest-contentful-paint", buffered: true });

      // First Input Delay
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const delay = (entry as any).processingStart - entry.startTime;
          this.trackPerformance(
            "interaction",
            "First Input Delay",
            delay,
            "ms",
            {
              url: window.location.pathname,
            }
          );
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
        this.trackPerformance(
          "page_load",
          "Cumulative Layout Shift",
          clsValue * 1000,
          "ms",
          {
            url: window.location.pathname,
          }
        );
      }).observe({ type: "layout-shift", buffered: true });
    } catch (error) {
      console.warn("Performance tracking not supported:", error);
    }

    // Track navigation timing
    window.addEventListener("load", () => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.trackPerformance(
          "page_load",
          "DNS Lookup",
          navigation.domainLookupEnd - navigation.domainLookupStart,
          "ms"
        );
        this.trackPerformance(
          "page_load",
          "TCP Connect",
          navigation.connectEnd - navigation.connectStart,
          "ms"
        );
        this.trackPerformance(
          "page_load",
          "Request",
          navigation.responseStart - navigation.requestStart,
          "ms"
        );
        this.trackPerformance(
          "page_load",
          "Response",
          navigation.responseEnd - navigation.responseStart,
          "ms"
        );
        this.trackPerformance(
          "page_load",
          "DOM Processing",
          navigation.domContentLoadedEventEnd -
            navigation.domContentLoadedEventStart,
          "ms"
        );
        this.trackPerformance(
          "page_load",
          "Load Complete",
          navigation.loadEventEnd - (navigation as any).navigationStart,
          "ms"
        );
      }
    });

    // Track user interactions
    if (this.config.enableUserInteractionTracking) {
      document.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        this.addBreadcrumb("user", "click", `Clicked ${target.tagName}`, {
          element: target.tagName,
          className: target.className,
          id: target.id,
          text: target.textContent?.slice(0, 50),
        });
      });

      document.addEventListener("submit", (event) => {
        const form = event.target as HTMLFormElement;
        this.addBreadcrumb("user", "form_submit", "Form submitted", {
          formId: form.id,
          action: form.action,
        });
      });
    }
  }

  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: "high_error_rate",
        name: "High Error Rate",
        condition: {
          type: "error_rate",
          threshold: 5, // 5% error rate
          timeWindow: 15, // últimos 15 minutos
        },
        actions: {
          email: ["admin@company.com"],
          slack: "#alerts",
        },
        enabled: true,
      },
      {
        id: "new_fatal_error",
        name: "New Fatal Error",
        condition: {
          type: "new_error",
          threshold: 1,
          timeWindow: 5,
          level: "fatal",
        },
        actions: {
          email: ["admin@company.com", "dev-team@company.com"],
          slack: "#critical-alerts",
        },
        enabled: true,
      },
      {
        id: "performance_degradation",
        name: "Performance Degradation",
        condition: {
          type: "performance_threshold",
          threshold: 3000, // 3 segundos
          timeWindow: 10,
        },
        actions: {
          slack: "#performance-alerts",
        },
        enabled: true,
      },
    ];

    defaultRules.forEach((rule) => {
      this.alertRules.set(rule.id, rule);
    });
  }

  // Métodos públicos para captura de errores
  public captureError(
    error: Error,
    context?: Partial<ErrorContext>,
    tags?: string[]
  ): void {
    if (!this.shouldCapture("error")) return;

    const fingerprint = this.generateFingerprint(error, context);
    const timestamp = new Date();

    let errorLog = this.errors.get(fingerprint);

    if (errorLog) {
      // Error existente, incrementar contador
      errorLog.occurrences++;
      errorLog.lastSeen = timestamp;
    } else {
      // Nuevo error
      errorLog = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        level: "error",
        message: error.message,
        stack: error.stack,
        context: this.buildContext(context),
        tags: tags || [],
        fingerprint,
        resolved: false,
        occurrences: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId,
      };

      this.errors.set(fingerprint, errorLog);
    }

    // Agregar breadcrumb
    this.addBreadcrumb("error", "error", error.message, {
      stack: error.stack?.split("\n").slice(0, 3).join("\n"),
    });

    // Log a consola si está habilitado
    if (this.config.enableConsole) {
      console.error("Error captured:", errorLog);
    }

    // Enviar a servicios remotos
    if (this.config.enableRemote) {
      this.sendToRemoteServices(errorLog);
    }

    // Verificar reglas de alerta
    this.checkAlertRules(errorLog);

    // Notificar suscriptores
    this.notifySubscribers("error", errorLog);

    // Limpiar errores antiguos si se supera el límite
    this.cleanOldErrors();
  }

  public captureMessage(
    message: string,
    level: ErrorLog["level"] = "info",
    context?: Partial<ErrorContext>
  ): void {
    if (!this.shouldCapture(level)) return;

    const timestamp = new Date();
    const errorLog: ErrorLog = {
      id: `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      level,
      message,
      context: this.buildContext(context),
      tags: [],
      fingerprint: this.generateFingerprint({ message } as Error, context),
      resolved: false,
      occurrences: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.errors.set(errorLog.fingerprint, errorLog);

    // Agregar breadcrumb
    this.addBreadcrumb("debug", level, message);

    // Log a consola
    if (this.config.enableConsole) {
      console[level === "fatal" ? "error" : level](message, errorLog);
    }

    this.notifySubscribers("message", errorLog);
  }

  public addBreadcrumb(
    type: Breadcrumb["type"],
    category: string,
    message: string,
    data?: Record<string, any>
  ): void {
    const breadcrumb: Breadcrumb = {
      id: `breadcrumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      category,
      message,
      data,
      level: type === "error" ? "error" : "info",
    };

    this.breadcrumbs.unshift(breadcrumb);

    // Mantener solo los últimos N breadcrumbs
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(0, this.config.maxBreadcrumbs);
    }

    this.notifySubscribers("breadcrumb", breadcrumb);
  }

  public trackPerformance(
    type: PerformanceMetric["type"],
    name: string,
    value: number,
    unit: PerformanceMetric["unit"],
    context?: Record<string, string>
  ): void {
    if (!this.config.enablePerformanceTracking) return;

    const metric: PerformanceMetric = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      name,
      value,
      unit,
      tags: context || {},
      context: {
        url: window.location.pathname,
        userId: this.userId,
        sessionId: this.sessionId,
        ...context,
      },
    };

    this.performanceMetrics.unshift(metric);

    // Mantener solo las últimas 1000 métricas
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(0, 1000);
    }

    // Verificar si excede umbrales de rendimiento
    this.checkPerformanceThresholds(metric);

    this.notifySubscribers("performance", metric);
  }

  private shouldCapture(level: ErrorLog["level"]): boolean {
    const levels = ["debug", "info", "warn", "error", "fatal"];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return (
      messageLevelIndex >= currentLevelIndex &&
      Math.random() <= this.config.sampleRate
    );
  }

  private generateFingerprint(
    error: Error,
    context?: Partial<ErrorContext>
  ): string {
    const message = error.message || "Unknown error";
    const component = context?.component || "unknown";
    const func = context?.function || "unknown";

    // Crear fingerprint basado en mensaje, componente y función
    const raw = `${message}:${component}:${func}`;
    return btoa(raw)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substr(0, 16);
  }

  private buildContext(context?: Partial<ErrorContext>): ErrorContext {
    return {
      component: context?.component,
      function: context?.function,
      line: context?.line,
      column: context?.column,
      props: context?.props,
      state: context?.state,
      breadcrumbs: [...this.breadcrumbs.slice(0, 10)], // Últimos 10 breadcrumbs
      environment: this.config.environment,
      release: this.config.release,
      user: context?.user || (this.userId ? { id: this.userId } : undefined),
      extra: context?.extra,
      ...context,
    };
  }

  private async sendToRemoteServices(error: ErrorLog): Promise<void> {
    try {
      if (this.config.integrations.sentry) {
        await this.sendToSentry(error);
      }
      if (this.config.integrations.bugsnag) {
        await this.sendToBugsnag(error);
      }
      if (this.config.integrations.datadog) {
        await this.sendToDatadog(error);
      }
      if (this.config.integrations.custom) {
        await this.sendToCustomEndpoint(error);
      }
    } catch (err) {
      console.error("Failed to send error to remote services:", err);
    }
  }

  private async sendToCustomEndpoint(error: ErrorLog): Promise<void> {
    // Implementación personalizada para enviar errores
    const payload = {
      error: {
        message: error.message,
        level: error.level,
        fingerprint: error.fingerprint,
        stack: error.stack,
        timestamp: error.timestamp.toISOString(),
        context: error.context,
        tags: error.tags,
        occurrences: error.occurrences,
      },
      session: {
        id: this.sessionId,
        userId: this.userId,
      },
    };

    // Simular envío (en producción sería una llamada HTTP real)
    console.log("Sending error to custom endpoint:", payload);
  }

  private async sendToSentry(error: ErrorLog): Promise<void> {
    // Integración con Sentry (requiere SDK de Sentry)
    console.log("Sending to Sentry:", error);
  }

  private async sendToBugsnag(error: ErrorLog): Promise<void> {
    // Integración con Bugsnag
    console.log("Sending to Bugsnag:", error);
  }

  private async sendToDatadog(error: ErrorLog): Promise<void> {
    // Integración con Datadog
    console.log("Sending to Datadog:", error);
  }

  private checkAlertRules(error: ErrorLog): void {
    this.alertRules.forEach((rule) => {
      if (!rule.enabled) return;

      const now = new Date();
      const windowStart = new Date(
        now.getTime() - rule.condition.timeWindow * 60 * 1000
      );

      let shouldTrigger = false;

      switch (rule.condition.type) {
        case "new_error":
          if (
            error.occurrences === 1 &&
            (!rule.condition.level || error.level === rule.condition.level)
          ) {
            shouldTrigger = true;
          }
          break;

        case "error_count":
          const errorCount = Array.from(this.errors.values()).filter(
            (e) =>
              e.lastSeen >= windowStart &&
              (!rule.condition.level || e.level === rule.condition.level)
          ).length;
          shouldTrigger = errorCount >= rule.condition.threshold;
          break;

        case "error_rate":
          // Calcular tasa de error (simplificado)
          const recentErrors = Array.from(this.errors.values()).filter(
            (e) => e.lastSeen >= windowStart
          );
          const errorRate =
            (recentErrors.length / Math.max(1, rule.condition.timeWindow)) *
            100;
          shouldTrigger = errorRate >= rule.condition.threshold;
          break;
      }

      if (
        shouldTrigger &&
        (!rule.lastTriggered ||
          now.getTime() - rule.lastTriggered.getTime() > 300000)
      ) {
        this.triggerAlert(rule, error);
        rule.lastTriggered = now;
      }
    });
  }

  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const thresholds = {
      page_load: {
        "First Contentful Paint": 1500,
        "Largest Contentful Paint": 2500,
      },
      interaction: { "First Input Delay": 100 },
      api_call: { default: 2000 },
    };

    const threshold =
      (thresholds as any)[metric.type]?.[metric.name] ||
      (thresholds as any)[metric.type]?.default;

    if (threshold && metric.value > threshold) {
      this.captureMessage(
        `Performance threshold exceeded: ${metric.name} took ${metric.value}${metric.unit}`,
        "warn",
        {
          component: "performance",
          extra: { metric, threshold },
        }
      );
    }
  }

  private triggerAlert(rule: AlertRule, error: ErrorLog): void {
    console.log(`🚨 ALERT: ${rule.name}`, { rule, error });

    // Simular envío de alertas
    if (rule.actions.email) {
      console.log(
        `📧 Sending email alert to: ${rule.actions.email.join(", ")}`
      );
    }
    if (rule.actions.slack) {
      console.log(`💬 Sending Slack alert to: ${rule.actions.slack}`);
    }
    if (rule.actions.webhook) {
      console.log(`🔗 Sending webhook alert to: ${rule.actions.webhook}`);
    }

    this.notifySubscribers("alert", { rule, error });
  }

  private cleanOldErrors(): void {
    if (this.errors.size <= this.config.maxErrorsInMemory) return;

    // Ordenar por última ocurrencia y mantener solo los más recientes
    const sortedErrors = Array.from(this.errors.entries())
      .sort((a, b) => b[1].lastSeen.getTime() - a[1].lastSeen.getTime())
      .slice(0, this.config.maxErrorsInMemory);

    this.errors.clear();
    sortedErrors.forEach(([fingerprint, error]) => {
      this.errors.set(fingerprint, error);
    });
  }

  // Métodos públicos para gestión
  public setUser(userId: string, email?: string, username?: string): void {
    this.userId = userId;
    this.addBreadcrumb("user", "identify", `User identified: ${userId}`, {
      email,
      username,
    });
  }

  public clearUser(): void {
    this.userId = undefined;
    this.addBreadcrumb("user", "logout", "User logged out");
  }

  public resolveError(fingerprint: string): void {
    const error = this.errors.get(fingerprint);
    if (error) {
      error.resolved = true;
      this.notifySubscribers("error_resolved", error);
    }
  }

  public getErrors(): ErrorLog[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime()
    );
  }

  public getErrorsByLevel(level: ErrorLog["level"]): ErrorLog[] {
    return this.getErrors().filter((error) => error.level === level);
  }

  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  public getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  public getAnalytics(): ErrorAnalytics {
    const errors = this.getErrors();
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentErrors = errors.filter((e) => e.lastSeen >= last24Hours);

    // Top errores por frecuencia
    const topErrors = Array.from(this.errors.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10)
      .map((error) => ({
        fingerprint: error.fingerprint,
        message: error.message,
        count: error.occurrences,
        lastSeen: error.lastSeen,
      }));

    // Errores por nivel
    const errorsByLevel: Record<string, number> = {};
    recentErrors.forEach((error) => {
      errorsByLevel[error.level] = (errorsByLevel[error.level] || 0) + 1;
    });

    // Errores por componente
    const errorsByComponent: Record<string, number> = {};
    recentErrors.forEach((error) => {
      const component = error.context.component || "unknown";
      errorsByComponent[component] = (errorsByComponent[component] || 0) + 1;
    });

    // Issues de rendimiento
    const performanceIssues = this.analyzePerformanceIssues();

    return {
      totalErrors: errors.length,
      errorRate: (recentErrors.length / Math.max(1, 24)) * 100, // errores por hora
      topErrors,
      errorsByLevel,
      errorsByComponent,
      errorsByBrowser: { Chrome: 15, Firefox: 8, Safari: 3 }, // Simplificado
      errorsByUrl: { "/dashboard": 12, "/profile": 8, "/settings": 4 }, // Simplificado
      recentErrors: recentErrors.slice(0, 20),
      performanceIssues,
    };
  }

  private analyzePerformanceIssues(): Array<{
    type: string;
    count: number;
    avgValue: number;
    threshold: number;
  }> {
    const issues: Array<{
      type: string;
      count: number;
      avgValue: number;
      threshold: number;
    }> = [];

    // Analizar métricas de rendimiento
    const perfMetrics = this.performanceMetrics;
    const groupedMetrics = new Map<string, PerformanceMetric[]>();

    perfMetrics.forEach((metric) => {
      const key = `${metric.type}_${metric.name}`;
      if (!groupedMetrics.has(key)) {
        groupedMetrics.set(key, []);
      }
      groupedMetrics.get(key)!.push(metric);
    });

    // Umbrales de rendimiento
    const thresholds = {
      "page_load_First Contentful Paint": 1500,
      "page_load_Largest Contentful Paint": 2500,
      "interaction_First Input Delay": 100,
      api_call_default: 2000,
    };

    groupedMetrics.forEach((metrics, key) => {
      const threshold = thresholds[key as keyof typeof thresholds] || 1000;
      const slowMetrics = metrics.filter((m) => m.value > threshold);

      if (slowMetrics.length > 0) {
        const avgValue =
          slowMetrics.reduce((sum, m) => sum + m.value, 0) / slowMetrics.length;
        issues.push({
          type: key.replace("_", " "),
          count: slowMetrics.length,
          avgValue,
          threshold,
        });
      }
    });

    return issues;
  }

  // Sistema de suscripciones
  private notifySubscribers(event: string, data: any): void {
    this.subscribers.forEach((callback, id) => {
      try {
        callback({ event, data, timestamp: new Date() });
      } catch (error) {
        console.error(`Error notifying subscriber ${id}:`, error);
      }
    });
  }

  public subscribe(id: string, callback: (data: any) => void): void {
    this.subscribers.set(id, callback);
  }

  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  // Configuración
  public updateConfig(newConfig: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): LoggingConfig {
    return { ...this.config };
  }

  // Gestión de reglas de alerta
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }
}

// Hook personalizado para usar el sistema de error tracking
export const useErrorTracking = (config?: Partial<LoggingConfig>) => {
  const [errorSystem] = useState(() => new ErrorTrackingSystem(config));
  const [errors, setErrors] = useState<ErrorLog[]>(errorSystem.getErrors());
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>(
    errorSystem.getBreadcrumbs()
  );
  const [performanceMetrics, setPerformanceMetrics] = useState<
    PerformanceMetric[]
  >(errorSystem.getPerformanceMetrics());
  const [analytics, setAnalytics] = useState<ErrorAnalytics>(
    errorSystem.getAnalytics()
  );

  useEffect(() => {
    const id = `error_tracking_${Date.now()}`;

    errorSystem.subscribe(id, (update) => {
      switch (update.event) {
        case "error":
        case "message":
        case "error_resolved":
          setErrors(errorSystem.getErrors());
          setAnalytics(errorSystem.getAnalytics());
          break;
        case "breadcrumb":
          setBreadcrumbs(errorSystem.getBreadcrumbs());
          break;
        case "performance":
          setPerformanceMetrics(errorSystem.getPerformanceMetrics());
          setAnalytics(errorSystem.getAnalytics());
          break;
      }
    });

    return () => {
      errorSystem.unsubscribe(id);
    };
  }, [errorSystem]);

  const captureError = useCallback(
    (error: Error, context?: Partial<ErrorContext>, tags?: string[]) => {
      errorSystem.captureError(error, context, tags);
    },
    [errorSystem]
  );

  const captureMessage = useCallback(
    (
      message: string,
      level: ErrorLog["level"] = "info",
      context?: Partial<ErrorContext>
    ) => {
      errorSystem.captureMessage(message, level, context);
    },
    [errorSystem]
  );

  const addBreadcrumb = useCallback(
    (
      type: Breadcrumb["type"],
      category: string,
      message: string,
      data?: Record<string, any>
    ) => {
      errorSystem.addBreadcrumb(type, category, message, data);
    },
    [errorSystem]
  );

  const trackPerformance = useCallback(
    (
      type: PerformanceMetric["type"],
      name: string,
      value: number,
      unit: PerformanceMetric["unit"],
      context?: Record<string, string>
    ) => {
      errorSystem.trackPerformance(type, name, value, unit, context);
    },
    [errorSystem]
  );

  return {
    errors,
    breadcrumbs,
    performanceMetrics,
    analytics,
    captureError,
    captureMessage,
    addBreadcrumb,
    trackPerformance,
    setUser: (userId: string, email?: string, username?: string) =>
      errorSystem.setUser(userId, email, username),
    clearUser: () => errorSystem.clearUser(),
    resolveError: (fingerprint: string) =>
      errorSystem.resolveError(fingerprint),
    getErrorsByLevel: (level: ErrorLog["level"]) =>
      errorSystem.getErrorsByLevel(level),
    updateConfig: (config: Partial<LoggingConfig>) =>
      errorSystem.updateConfig(config),
    getConfig: () => errorSystem.getConfig(),
    addAlertRule: (rule: AlertRule) => errorSystem.addAlertRule(rule),
    removeAlertRule: (ruleId: string) => errorSystem.removeAlertRule(ruleId),
    getAlertRules: () => errorSystem.getAlertRules(),
  };
};
