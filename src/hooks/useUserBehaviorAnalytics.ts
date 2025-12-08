import { useState, useEffect, useCallback, useRef } from "react";

// Interfaces para análisis de comportamiento del usuario
export interface UserSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  interactions: number;
  conversions: number;
  bounced: boolean;
  device: DeviceInfo;
  location: LocationInfo;
  referrer?: string;
  landingPage: string;
  exitPage?: string;
  events: UserEvent[];
}

export interface UserEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  type:
    | "page_view"
    | "click"
    | "scroll"
    | "form_submit"
    | "hover"
    | "focus"
    | "blur"
    | "resize"
    | "custom";
  element?: ElementInfo;
  page: PageInfo;
  data?: Record<string, any>;
  coordinates?: { x: number; y: number };
  viewport: ViewportInfo;
}

export interface ElementInfo {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  xpath?: string;
  selector?: string;
}

export interface PageInfo {
  url: string;
  path: string;
  title: string;
  referrer?: string;
  loadTime?: number;
  scrollDepth?: number;
  timeOnPage?: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  innerWidth: number;
  innerHeight: number;
}

export interface DeviceInfo {
  type: "desktop" | "tablet" | "mobile" | "unknown";
  os: string;
  browser: string;
  version: string;
  screen: {
    width: number;
    height: number;
    pixelRatio: number;
  };
  connection?: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone: string;
  language: string;
}

export interface HeatmapData {
  id: string;
  url: string;
  type: "click" | "move" | "scroll";
  points: Array<{
    x: number;
    y: number;
    intensity: number;
    timestamp: Date;
  }>;
  viewport: ViewportInfo;
  generatedAt: Date;
}

export interface ConversionFunnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  totalUsers: number;
  conversionRate: number;
  dropoffAnalysis: DropoffAnalysis[];
  timeframe: {
    start: Date;
    end: Date;
  };
}

export interface FunnelStep {
  id: string;
  name: string;
  url?: string;
  event?: string;
  condition?: string;
  users: number;
  conversionRate: number;
  avgTimeToNext?: number;
  dropoffRate: number;
}

export interface DropoffAnalysis {
  fromStep: string;
  toStep: string;
  dropoffRate: number;
  commonExitPages: string[];
  reasonsAnalysis: {
    technical: string[];
    usability: string[];
    content: string[];
  };
}

export interface UserJourney {
  id: string;
  userId?: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  touchpoints: JourneyTouchpoint[];
  goal?: string;
  completed: boolean;
  value?: number;
  segments: string[];
}

export interface JourneyTouchpoint {
  id: string;
  timestamp: Date;
  type: "page_view" | "interaction" | "conversion" | "exit";
  page: string;
  action?: string;
  duration: number;
  value?: number;
  context?: Record<string, any>;
}

export interface SessionReplay {
  id: string;
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  events: ReplayEvent[];
  metadata: {
    userAgent: string;
    viewport: ViewportInfo;
    url: string;
    userId?: string;
  };
  hasErrors: boolean;
  hasRageClicks: boolean;
  hasDeadClicks: boolean;
}

export interface ReplayEvent {
  id: string;
  timestamp: number; // Relativo al inicio de la sesión
  type: "dom" | "mouse" | "keyboard" | "scroll" | "resize" | "error";
  data: any;
}

export interface UserBehaviorAnalytics {
  totalSessions: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  bounceRate: number;
  pagesPerSession: number;
  topPages: Array<{
    url: string;
    views: number;
    avgTimeOnPage: number;
    bounceRate: number;
  }>;
  userFlow: Array<{
    from: string;
    to: string;
    users: number;
    percentage: number;
  }>;
  conversionMetrics: {
    overall: number;
    bySource: Record<string, number>;
    byDevice: Record<string, number>;
  };
  engagementMetrics: {
    scrollDepth: number;
    clickThroughRate: number;
    formCompletionRate: number;
    errorRate: number;
  };
}

export interface BehaviorConfig {
  enableHeatmaps: boolean;
  enableSessionReplay: boolean;
  enableUserJourneys: boolean;
  enableConversionTracking: boolean;
  sampleRate: number;
  replaySampleRate: number;
  maxSessionDuration: number; // minutos
  maxReplaySize: number; // MB
  excludePatterns: string[];
  sensitiveDataMask: boolean;
  trackingDomains: string[];
  conversionGoals: ConversionGoal[];
}

export interface ConversionGoal {
  id: string;
  name: string;
  type: "url" | "event" | "element_click" | "form_submit";
  condition: string;
  value?: number;
  funnel?: string[];
}

// Clase principal para análisis de comportamiento
class UserBehaviorAnalyticsSystem {
  private currentSession: UserSession | null;
  private sessions: Map<string, UserSession>;
  private events: UserEvent[];
  private heatmaps: Map<string, HeatmapData>;
  private funnels: Map<string, ConversionFunnel>;
  private journeys: Map<string, UserJourney>;
  private replays: Map<string, SessionReplay>;
  private config: BehaviorConfig;
  private subscribers: Map<string, (data: any) => void>;
  private isRecording: boolean;
  private mouseTracker: { x: number; y: number; timestamp: Date }[];
  private scrollTracker: { depth: number; timestamp: Date }[];
  private currentReplay: SessionReplay | null;

  constructor(config?: Partial<BehaviorConfig>) {
    this.currentSession = null;
    this.sessions = new Map();
    this.events = [];
    this.heatmaps = new Map();
    this.funnels = new Map();
    this.journeys = new Map();
    this.replays = new Map();
    this.config = this.getDefaultConfig(config);
    this.subscribers = new Map();
    this.isRecording = false;
    this.mouseTracker = [];
    this.scrollTracker = [];
    this.currentReplay = null;

    this.initializeBehaviorTracking();
    this.startSession();
  }

  private getDefaultConfig(
    userConfig?: Partial<BehaviorConfig>
  ): BehaviorConfig {
    return {
      enableHeatmaps: true,
      enableSessionReplay: true,
      enableUserJourneys: true,
      enableConversionTracking: true,
      sampleRate: 1.0,
      replaySampleRate: 0.1,
      maxSessionDuration: 60,
      maxReplaySize: 50,
      excludePatterns: ["/admin", "/api", "*.pdf"],
      sensitiveDataMask: true,
      trackingDomains: [window.location.hostname],
      conversionGoals: [
        {
          id: "signup",
          name: "User Signup",
          type: "url",
          condition: "/welcome",
          value: 10,
        },
        {
          id: "purchase",
          name: "Purchase Complete",
          type: "url",
          condition: "/order-confirmation",
          value: 100,
        },
      ],
      ...userConfig,
    };
  }

  private initializeBehaviorTracking(): void {
    if (typeof window === "undefined") return;

    // Tracking de eventos del mouse
    document.addEventListener("click", this.handleClick.bind(this));
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("scroll", this.handleScroll.bind(this));

    // Tracking de formularios
    document.addEventListener("submit", this.handleFormSubmit.bind(this));
    document.addEventListener("focusin", this.handleFocus.bind(this));
    document.addEventListener("focusout", this.handleBlur.bind(this));

    // Tracking de navegación
    window.addEventListener("beforeunload", this.handlePageUnload.bind(this));
    window.addEventListener("resize", this.handleResize.bind(this));

    // Tracking de cambios de página (SPA)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handlePageChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handlePageChange();
    };

    window.addEventListener("popstate", this.handlePageChange.bind(this));

    // Inicializar sesión replay si está habilitado
    if (
      this.config.enableSessionReplay &&
      Math.random() <= this.config.replaySampleRate
    ) {
      this.startSessionReplay();
    }

    // Tracking de rendimiento
    this.trackPagePerformance();
  }

  private startSession(): void {
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      pageViews: 1,
      interactions: 0,
      conversions: 0,
      bounced: true, // Se actualizará si hay interacciones
      device: this.getDeviceInfo(),
      location: this.getLocationInfo(),
      referrer: document.referrer,
      landingPage: window.location.href,
      events: [],
    };

    this.sessions.set(sessionId, this.currentSession);
    this.trackEvent("page_view", undefined, { isLanding: true });

    // Inicializar journey del usuario
    if (this.config.enableUserJourneys) {
      this.startUserJourney();
    }

    this.notifySubscribers("session_start", this.currentSession);
  }

  private startUserJourney(): void {
    if (!this.currentSession) return;

    const journeyId = `journey_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const journey: UserJourney = {
      id: journeyId,
      sessionId: this.currentSession.id,
      startTime: new Date(),
      touchpoints: [
        {
          id: `touchpoint_${Date.now()}`,
          timestamp: new Date(),
          type: "page_view",
          page: window.location.pathname,
          duration: 0,
        },
      ],
      completed: false,
      segments: this.getUserSegments(),
    };

    this.journeys.set(journeyId, journey);
  }

  private startSessionReplay(): void {
    if (!this.currentSession) return;

    this.isRecording = true;
    const replayId = `replay_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.currentReplay = {
      id: replayId,
      sessionId: this.currentSession.id,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      events: [],
      metadata: {
        userAgent: navigator.userAgent,
        viewport: this.getViewportInfo(),
        url: window.location.href,
      },
      hasErrors: false,
      hasRageClicks: false,
      hasDeadClicks: false,
    };

    // Capturar snapshot inicial del DOM
    this.captureReplayEvent("dom", {
      type: "full_snapshot",
      html: this.sanitizeHTML(document.documentElement.outerHTML),
    });
  }

  private handleClick(event: MouseEvent): void {
    const element = this.getElementInfo(event.target as HTMLElement);
    const coordinates = { x: event.clientX, y: event.clientY };

    this.trackEvent("click", element, { coordinates });

    // Actualizar heatmap de clicks
    if (this.config.enableHeatmaps) {
      this.updateHeatmap("click", coordinates);
    }

    // Detectar rage clicks (múltiples clicks rápidos en el mismo elemento)
    this.detectRageClicks(element, coordinates);

    // Actualizar sesión
    if (this.currentSession) {
      this.currentSession.interactions++;
      this.currentSession.bounced = false;
    }

    // Capturar para replay
    if (this.isRecording) {
      this.captureReplayEvent("mouse", {
        type: "click",
        x: event.clientX,
        y: event.clientY,
        target: element.selector,
      });
    }

    // Verificar conversiones
    this.checkConversions("element_click", element);
  }

  private handleMouseMove(event: MouseEvent): void {
    const coordinates = { x: event.clientX, y: event.clientY };

    // Throttle mouse tracking para performance
    const now = new Date();
    if (
      this.mouseTracker.length === 0 ||
      now.getTime() -
        this.mouseTracker[this.mouseTracker.length - 1].timestamp.getTime() >
        100
    ) {
      this.mouseTracker.push({ ...coordinates, timestamp: now });

      // Mantener solo los últimos 1000 puntos
      if (this.mouseTracker.length > 1000) {
        this.mouseTracker = this.mouseTracker.slice(-500);
      }

      // Actualizar heatmap de movimiento
      if (this.config.enableHeatmaps && Math.random() < 0.1) {
        // Sample 10% of moves
        this.updateHeatmap("move", coordinates);
      }
    }
  }

  private handleScroll(event: Event): void {
    const scrollDepth = Math.round(
      (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
    );

    this.scrollTracker.push({ depth: scrollDepth, timestamp: new Date() });

    // Mantener solo los últimos 100 scroll events
    if (this.scrollTracker.length > 100) {
      this.scrollTracker = this.scrollTracker.slice(-50);
    }

    // Actualizar heatmap de scroll
    if (this.config.enableHeatmaps && scrollDepth % 25 === 0) {
      // Track 25%, 50%, 75%, 100%
      this.updateHeatmap("scroll", {
        x: window.innerWidth / 2,
        y: window.scrollY,
      });
    }

    // Capturar para replay
    if (this.isRecording) {
      this.captureReplayEvent("scroll", {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollDepth,
      });
    }
  }

  private handleFormSubmit(event: SubmitEvent): void {
    const form = event.target as HTMLFormElement;
    const element = this.getElementInfo(form);

    this.trackEvent("form_submit", element, {
      formData: this.getFormData(form),
      action: form.action,
      method: form.method,
    });

    // Verificar conversiones
    this.checkConversions("form_submit", element);
  }

  private handleFocus(event: FocusEvent): void {
    const element = this.getElementInfo(event.target as HTMLElement);
    this.trackEvent("focus", element);
  }

  private handleBlur(event: FocusEvent): void {
    const element = this.getElementInfo(event.target as HTMLElement);
    this.trackEvent("blur", element);
  }

  private handlePageUnload(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.exitPage = window.location.href;
      this.currentSession.duration =
        this.currentSession.endTime.getTime() -
        this.currentSession.startTime.getTime();
    }

    // Finalizar user journey
    const currentJourney = Array.from(this.journeys.values()).find(
      (j) => j.sessionId === this.currentSession?.id
    );
    if (currentJourney) {
      currentJourney.endTime = new Date();
    }

    // Finalizar session replay
    if (this.currentReplay) {
      this.currentReplay.endTime = new Date();
      this.currentReplay.duration =
        this.currentReplay.endTime.getTime() -
        this.currentReplay.startTime.getTime();
      this.replays.set(this.currentReplay.id, this.currentReplay);
    }

    this.sendDataToServer();
  }

  private handleResize(): void {
    this.trackEvent("resize", undefined, {
      viewport: this.getViewportInfo(),
    });
  }

  private handlePageChange(): void {
    if (this.currentSession) {
      this.currentSession.pageViews++;
    }

    this.trackEvent("page_view", undefined, {
      url: window.location.href,
      referrer: document.referrer,
    });

    // Verificar conversiones por URL
    this.checkConversions("url");
  }

  private trackEvent(
    type: UserEvent["type"],
    element?: ElementInfo,
    data?: Record<string, any>
  ): void {
    if (!this.currentSession) return;

    const event: UserEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.currentSession.id,
      timestamp: new Date(),
      type,
      element,
      page: {
        url: window.location.href,
        path: window.location.pathname,
        title: document.title,
        referrer: document.referrer,
        scrollDepth: this.getCurrentScrollDepth(),
      },
      data,
      viewport: this.getViewportInfo(),
    };

    this.events.unshift(event);
    this.currentSession.events.unshift(event);

    // Mantener solo los últimos 10000 eventos
    if (this.events.length > 10000) {
      this.events = this.events.slice(0, 5000);
    }

    // Actualizar journey del usuario
    this.updateUserJourney(event);

    this.notifySubscribers("event", event);
  }

  private updateHeatmap(
    type: HeatmapData["type"],
    coordinates: { x: number; y: number }
  ): void {
    const url = window.location.pathname;
    const heatmapId = `${url}_${type}`;

    let heatmap = this.heatmaps.get(heatmapId);

    if (!heatmap) {
      heatmap = {
        id: heatmapId,
        url,
        type,
        points: [],
        viewport: this.getViewportInfo(),
        generatedAt: new Date(),
      };
      this.heatmaps.set(heatmapId, heatmap);
    }

    // Buscar punto existente cerca de las coordenadas
    const nearbyPoint = heatmap.points.find(
      (p) =>
        Math.abs(p.x - coordinates.x) < 50 && Math.abs(p.y - coordinates.y) < 50
    );

    if (nearbyPoint) {
      nearbyPoint.intensity++;
      nearbyPoint.timestamp = new Date();
    } else {
      heatmap.points.push({
        x: coordinates.x,
        y: coordinates.y,
        intensity: 1,
        timestamp: new Date(),
      });
    }

    // Mantener solo los primeros 10000 puntos por heatmap
    if (heatmap.points.length > 10000) {
      heatmap.points = heatmap.points.slice(0, 5000);
    }
  }

  private detectRageClicks(
    element: ElementInfo,
    coordinates: { x: number; y: number }
  ): void {
    // Implementación simplificada - detectar múltiples clicks rápidos
    const recentClicks = this.events.filter(
      (e) =>
        e.type === "click" &&
        e.timestamp.getTime() > Date.now() - 5000 && // últimos 5 segundos
        e.element?.selector === element.selector
    ).length;

    if (recentClicks >= 3) {
      this.trackEvent("custom", element, {
        eventType: "rage_click",
        clickCount: recentClicks,
        coordinates,
      });

      if (this.currentReplay) {
        this.currentReplay.hasRageClicks = true;
      }
    }
  }

  private checkConversions(
    type: ConversionGoal["type"],
    element?: ElementInfo
  ): void {
    this.config.conversionGoals.forEach((goal) => {
      if (goal.type !== type) return;

      let converted = false;

      switch (type) {
        case "url":
          converted = window.location.href.includes(goal.condition);
          break;
        case "element_click":
          if (element) {
            converted = element.selector?.includes(goal.condition) || false;
          }
          break;
        case "form_submit":
          if (element) {
            converted =
              element.id === goal.condition ||
              element.className?.includes(goal.condition) ||
              false;
          }
          break;
      }

      if (converted) {
        this.recordConversion(goal);
      }
    });
  }

  private recordConversion(goal: ConversionGoal): void {
    if (this.currentSession) {
      this.currentSession.conversions++;
    }

    this.trackEvent("custom", undefined, {
      eventType: "conversion",
      goalId: goal.id,
      goalName: goal.name,
      goalValue: goal.value,
    });

    // Actualizar funnel si existe
    if (goal.funnel) {
      this.updateConversionFunnel(goal);
    }

    this.notifySubscribers("conversion", {
      goal,
      session: this.currentSession,
    });
  }

  private updateConversionFunnel(goal: ConversionGoal): void {
    // Implementación simplificada de funnel de conversión
    const funnelId = `funnel_${goal.id}`;
    let funnel = this.funnels.get(funnelId);

    if (!funnel && goal.funnel) {
      funnel = {
        id: funnelId,
        name: `${goal.name} Funnel`,
        steps: goal.funnel.map((step, index) => ({
          id: `step_${index}`,
          name: step,
          url: step,
          users: 0,
          conversionRate: 0,
          dropoffRate: 0,
        })),
        totalUsers: 0,
        conversionRate: 0,
        dropoffAnalysis: [],
        timeframe: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // últimos 7 días
          end: new Date(),
        },
      };
      this.funnels.set(funnelId, funnel);
    }

    if (funnel) {
      // Actualizar estadísticas del funnel
      const currentStepIndex =
        goal.funnel?.indexOf(window.location.pathname) || 0;
      if (currentStepIndex >= 0 && currentStepIndex < funnel.steps.length) {
        funnel.steps[currentStepIndex].users++;
      }
    }
  }

  private updateUserJourney(event: UserEvent): void {
    const currentJourney = Array.from(this.journeys.values()).find(
      (j) => j.sessionId === event.sessionId
    );
    if (!currentJourney) return;

    const touchpoint: JourneyTouchpoint = {
      id: `touchpoint_${Date.now()}`,
      timestamp: event.timestamp,
      type: event.type === "page_view" ? "page_view" : "interaction",
      page: event.page.path,
      action: event.type,
      duration: 0, // Se calculará después
      context: event.data,
    };

    // Calcular duración del touchpoint anterior
    if (currentJourney.touchpoints.length > 0) {
      const lastTouchpoint =
        currentJourney.touchpoints[currentJourney.touchpoints.length - 1];
      lastTouchpoint.duration =
        event.timestamp.getTime() - lastTouchpoint.timestamp.getTime();
    }

    currentJourney.touchpoints.push(touchpoint);
  }

  private captureReplayEvent(type: ReplayEvent["type"], data: any): void {
    if (!this.currentReplay || !this.isRecording) return;

    const event: ReplayEvent = {
      id: `replay_event_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      timestamp: Date.now() - this.currentReplay.startTime.getTime(),
      type,
      data,
    };

    this.currentReplay.events.push(event);

    // Verificar tamaño máximo del replay
    const replaySize = JSON.stringify(this.currentReplay).length / 1024 / 1024; // MB
    if (replaySize > this.config.maxReplaySize) {
      this.stopSessionReplay();
    }
  }

  private stopSessionReplay(): void {
    if (this.currentReplay) {
      this.currentReplay.endTime = new Date();
      this.currentReplay.duration =
        this.currentReplay.endTime.getTime() -
        this.currentReplay.startTime.getTime();
      this.replays.set(this.currentReplay.id, this.currentReplay);
      this.currentReplay = null;
    }
    this.isRecording = false;
  }

  // Métodos utilitarios
  private getElementInfo(element: HTMLElement): ElementInfo {
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      text: element.textContent?.slice(0, 100) || undefined,
      attributes: this.getElementAttributes(element),
      xpath: this.getXPath(element),
      selector: this.getUniqueSelector(element),
    };
  }

  private getElementAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (
        !this.config.sensitiveDataMask ||
        !this.isSensitiveAttribute(attr.name)
      ) {
        attrs[attr.name] = attr.value;
      }
    }
    return attrs;
  }

  private isSensitiveAttribute(attrName: string): boolean {
    const sensitiveAttrs = ["password", "ssn", "creditcard", "data-sensitive"];
    return sensitiveAttrs.some((sensitive) =>
      attrName.toLowerCase().includes(sensitive)
    );
  }

  private getXPath(element: HTMLElement): string {
    if (element.id) {
      return `id("${element.id}")`;
    }
    if (element === document.body) {
      return "/html/body";
    }

    let ix = 0;
    const siblings = element.parentNode?.childNodes || [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        return (
          this.getXPath(element.parentElement!) +
          "/" +
          element.tagName.toLowerCase() +
          "[" +
          (ix + 1) +
          "]"
        );
      }
      if (
        sibling.nodeType === 1 &&
        (sibling as HTMLElement).tagName === element.tagName
      ) {
        ix++;
      }
    }
    return "";
  }

  private getUniqueSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      selector += `.${element.className.split(" ").join(".")}`;
    }

    // Si no es único, agregar el path completo
    if (document.querySelectorAll(selector).length > 1) {
      let parent = element.parentElement;
      while (parent) {
        const parentSelector = parent.tagName.toLowerCase();
        selector = `${parentSelector} > ${selector}`;
        if (parent.id || document.querySelectorAll(selector).length === 1) {
          break;
        }
        parent = parent.parentElement;
      }
    }

    return selector;
  }

  private getDeviceInfo(): DeviceInfo {
    const screen = window.screen;
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    return {
      type: this.getDeviceType(),
      os: this.getOS(),
      browser: this.getBrowser(),
      version: this.getBrowserVersion(),
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: window.devicePixelRatio || 1,
      },
      connection: connection
        ? {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
          }
        : undefined,
    };
  }

  private getDeviceType(): DeviceInfo["type"] {
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  private getOS(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iOS")) return "iOS";
    return "Unknown";
  }

  private getBrowser(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "Unknown";
  }

  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    return match ? match[2] : "Unknown";
  }

  private getLocationInfo(): LocationInfo {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      // En producción, se obtendría country, region, city desde un servicio de geolocalización
    };
  }

  private getViewportInfo(): ViewportInfo {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  }

  private getCurrentScrollDepth(): number {
    const scrollTop = window.scrollY;
    const documentHeight = document.body.scrollHeight;
    const windowHeight = window.innerHeight;
    return Math.round((scrollTop / (documentHeight - windowHeight)) * 100) || 0;
  }

  private getFormData(form: HTMLFormElement): Record<string, any> {
    const formData = new FormData(form);
    const data: Record<string, any> = {};

    formData.forEach((value, key) => {
      // Enmascarar datos sensibles
      if (this.config.sensitiveDataMask && this.isSensitiveField(key)) {
        data[key] = "[MASKED]";
      } else {
        data[key] = value;
      }
    });

    return data;
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = ["password", "ssn", "creditcard", "cvv", "pin"];
    return sensitiveFields.some((field) =>
      fieldName.toLowerCase().includes(field)
    );
  }

  private getUserSegments(): string[] {
    // Lógica simplificada de segmentación
    const segments: string[] = [];

    const device = this.getDeviceType();
    segments.push(`device_${device}`);

    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      segments.push("business_hours");
    } else {
      segments.push("after_hours");
    }

    if (document.referrer) {
      segments.push("referred");
    } else {
      segments.push("direct");
    }

    return segments;
  }

  private sanitizeHTML(html: string): string {
    if (!this.config.sensitiveDataMask) return html;

    // Remover valores de campos sensibles
    return html
      .replace(
        /(<input[^>]*type=["']password["'][^>]*value=["'])[^"']*["']/gi,
        '$1[MASKED]"'
      )
      .replace(
        /(<input[^>]*name=["'][^"']*password[^"']*["'][^>]*value=["'])[^"']*["']/gi,
        '$1[MASKED]"'
      )
      .replace(
        /(<input[^>]*name=["'][^"']*ssn[^"']*["'][^>]*value=["'])[^"']*["']/gi,
        '$1[MASKED]"'
      );
  }

  private trackPagePerformance(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("load", () => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;

      this.trackEvent("custom", undefined, {
        eventType: "page_performance",
        loadTime: navigation.loadEventEnd - (navigation as any).navigationStart,
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          (navigation as any).navigationStart,
        firstPaint:
          performance.getEntriesByName("first-paint")[0]?.startTime || 0,
        firstContentfulPaint:
          performance.getEntriesByName("first-contentful-paint")[0]
            ?.startTime || 0,
      });
    });
  }

  private async sendDataToServer(): Promise<void> {
    if (this.events.length === 0) return;

    try {
      const payload = {
        session: this.currentSession,
        events: this.events.slice(0, 1000), // Enviar solo los últimos 1000 eventos
        heatmaps: Array.from(this.heatmaps.values()),
        journeys: Array.from(this.journeys.values()),
        timestamp: new Date().toISOString(),
      };

      // En producción, esto sería una llamada HTTP real
      console.log("Sending behavior data to server:", payload);

      // Simular envío exitoso
      this.events = this.events.slice(1000); // Mantener solo eventos no enviados
    } catch (error) {
      console.error("Failed to send behavior data:", error);
    }
  }

  // Métodos públicos
  public getAnalytics(): UserBehaviorAnalytics {
    const sessions = Array.from(this.sessions.values());
    const totalSessions = sessions.length;
    const uniqueUsers = new Set(sessions.map((s) => s.userId).filter(Boolean))
      .size;

    const avgSessionDuration =
      sessions.reduce((sum, s) => sum + (s.duration || 0), 0) /
      Math.max(totalSessions, 1);

    const bounceRate =
      (sessions.filter((s) => s.bounced).length / Math.max(totalSessions, 1)) *
      100;
    const pagesPerSession =
      sessions.reduce((sum, s) => sum + s.pageViews, 0) /
      Math.max(totalSessions, 1);

    // Top páginas
    const pageViews = new Map<
      string,
      { views: number; totalTime: number; bounces: number }
    >();
    this.events
      .filter((e) => e.type === "page_view")
      .forEach((event) => {
        const url = event.page.url;
        const current = pageViews.get(url) || {
          views: 0,
          totalTime: 0,
          bounces: 0,
        };
        current.views++;
        if (event.page.timeOnPage) {
          current.totalTime += event.page.timeOnPage;
        }
        pageViews.set(url, current);
      });

    const topPages = Array.from(pageViews.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .map(([url, data]) => ({
        url,
        views: data.views,
        avgTimeOnPage: data.totalTime / data.views,
        bounceRate: (data.bounces / data.views) * 100,
      }));

    return {
      totalSessions,
      uniqueUsers,
      avgSessionDuration,
      bounceRate,
      pagesPerSession,
      topPages,
      userFlow: this.calculateUserFlow(),
      conversionMetrics: this.calculateConversionMetrics(),
      engagementMetrics: this.calculateEngagementMetrics(),
    };
  }

  private calculateUserFlow(): Array<{
    from: string;
    to: string;
    users: number;
    percentage: number;
  }> {
    const flows = new Map<string, number>();
    const sessions = Array.from(this.sessions.values());

    sessions.forEach((session) => {
      const pageViews = session.events.filter((e) => e.type === "page_view");
      for (let i = 0; i < pageViews.length - 1; i++) {
        const from = pageViews[i].page.path;
        const to = pageViews[i + 1].page.path;
        const key = `${from} -> ${to}`;
        flows.set(key, (flows.get(key) || 0) + 1);
      }
    });

    const totalFlows = Array.from(flows.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return Array.from(flows.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([flow, users]) => {
        const [from, to] = flow.split(" -> ");
        return {
          from,
          to,
          users,
          percentage: (users / totalFlows) * 100,
        };
      });
  }

  private calculateConversionMetrics() {
    const sessions = Array.from(this.sessions.values());
    const totalSessions = sessions.length;
    const conversions = sessions.filter((s) => s.conversions > 0).length;

    return {
      overall: (conversions / Math.max(totalSessions, 1)) * 100,
      bySource: { organic: 45, paid: 32, direct: 23 }, // Simplificado
      byDevice: { desktop: 55, mobile: 35, tablet: 10 }, // Simplificado
    };
  }

  private calculateEngagementMetrics() {
    const scrollDepths = this.scrollTracker.map((s) => s.depth);
    const avgScrollDepth =
      scrollDepths.reduce((sum, depth) => sum + depth, 0) /
      Math.max(scrollDepths.length, 1);

    const clickEvents = this.events.filter((e) => e.type === "click").length;
    const pageViews = this.events.filter((e) => e.type === "page_view").length;
    const clickThroughRate = (clickEvents / Math.max(pageViews, 1)) * 100;

    return {
      scrollDepth: avgScrollDepth,
      clickThroughRate,
      formCompletionRate: 75, // Simplificado
      errorRate: 2.5, // Simplificado
    };
  }

  public getHeatmapData(url?: string): HeatmapData[] {
    if (url) {
      return Array.from(this.heatmaps.values()).filter((h) => h.url === url);
    }
    return Array.from(this.heatmaps.values());
  }

  public getSessionReplays(): SessionReplay[] {
    return Array.from(this.replays.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  public getUserJourneys(): UserJourney[] {
    return Array.from(this.journeys.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  public getConversionFunnels(): ConversionFunnel[] {
    return Array.from(this.funnels.values());
  }

  public setUserId(userId: string): void {
    if (this.currentSession) {
      this.currentSession.userId = userId;
    }
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

  public updateConfig(newConfig: Partial<BehaviorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): BehaviorConfig {
    return { ...this.config };
  }
}

// Hook personalizado para usar el sistema de análisis de comportamiento
export const useUserBehaviorAnalytics = (config?: Partial<BehaviorConfig>) => {
  const [analytics] = useState(() => new UserBehaviorAnalyticsSystem(config));
  const [behaviorData, setBehaviorData] = useState<UserBehaviorAnalytics>(
    analytics.getAnalytics()
  );
  const [heatmaps, setHeatmaps] = useState<HeatmapData[]>(
    analytics.getHeatmapData()
  );
  const [replays, setReplays] = useState<SessionReplay[]>(
    analytics.getSessionReplays()
  );
  const [journeys, setJourneys] = useState<UserJourney[]>(
    analytics.getUserJourneys()
  );
  const [funnels, setFunnels] = useState<ConversionFunnel[]>(
    analytics.getConversionFunnels()
  );

  useEffect(() => {
    const id = `behavior_analytics_${Date.now()}`;

    analytics.subscribe(id, (update) => {
      // Actualizar datos según el tipo de evento
      setBehaviorData(analytics.getAnalytics());

      if (update.event === "session_start" || update.event === "event") {
        setHeatmaps(analytics.getHeatmapData());
        setJourneys(analytics.getUserJourneys());
      }

      if (update.event === "conversion") {
        setFunnels(analytics.getConversionFunnels());
      }
    });

    // Actualizar datos periódicamente
    const interval = setInterval(() => {
      setBehaviorData(analytics.getAnalytics());
      setHeatmaps(analytics.getHeatmapData());
      setReplays(analytics.getSessionReplays());
      setJourneys(analytics.getUserJourneys());
      setFunnels(analytics.getConversionFunnels());
    }, 30000); // Cada 30 segundos

    return () => {
      analytics.unsubscribe(id);
      clearInterval(interval);
    };
  }, [analytics]);

  return {
    behaviorData,
    heatmaps,
    replays,
    journeys,
    funnels,
    setUserId: (userId: string) => analytics.setUserId(userId),
    getHeatmapData: (url?: string) => analytics.getHeatmapData(url),
    updateConfig: (config: Partial<BehaviorConfig>) =>
      analytics.updateConfig(config),
    getConfig: () => analytics.getConfig(),
  };
};
