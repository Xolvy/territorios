import { useEffect, useState, useCallback } from "react";

interface BundleMetrics {
  // Core Web Vitals
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift

  // Bundle específico
  totalBundleSize: number;
  loadedChunks: string[];
  pendingChunks: string[];
  chunkLoadTimes: Record<string, number>;

  // Recursos
  totalResources: number;
  resourceSizes: Record<string, number>;
  resourceLoadTimes: Record<string, number>;

  // Rendimiento de JavaScript
  jsHeapSize: number;
  jsHeapSizeLimit: number;
  jsExecutionTime: number;

  // Cache effectiveness
  cacheHitRate: number;
  cachedResources: number;

  // Network
  connectionType: string;
  effectiveType: string;

  timestamp: Date;
}

interface BundleOptimizationRecommendation {
  type: "critical" | "warning" | "info";
  category: "bundle" | "resources" | "cache" | "network";
  message: string;
  impact: "high" | "medium" | "low";
  solution: string;
}

class BundleAnalyzer {
  private metrics: BundleMetrics;
  private observers: PerformanceObserver[] = [];
  private listeners: ((metrics: BundleMetrics) => void)[] = [];
  private chunkStartTimes: Map<string, number> = new Map();

  constructor() {
    this.metrics = this.initializeMetrics();
    this.setupObservers();
    this.analyzeCurrentBundle();
    this.startPeriodicAnalysis();
  }

  private initializeMetrics(): BundleMetrics {
    const memory = (performance as any).memory || {};
    const connection = (navigator as any).connection || {};

    return {
      lcp: null,
      fid: null,
      cls: null,
      totalBundleSize: 0,
      loadedChunks: [],
      pendingChunks: [],
      chunkLoadTimes: {},
      totalResources: 0,
      resourceSizes: {},
      resourceLoadTimes: {},
      jsHeapSize: memory.usedJSMemory || 0,
      jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
      jsExecutionTime: 0,
      cacheHitRate: 0,
      cachedResources: 0,
      connectionType: connection.type || "unknown",
      effectiveType: connection.effectiveType || "unknown",
      timestamp: new Date(),
    };
  }

  private setupObservers() {
    if ("PerformanceObserver" in window) {
      // Resource loading observer
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.entryType === "resource") {
            this.trackResource(entry);
          }
        });
      });

      // Navigation observer
      const navigationObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.entryType === "navigation") {
            this.trackNavigation(entry);
          }
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ["resource"] });
        navigationObserver.observe({ entryTypes: ["navigation"] });

        this.observers.push(resourceObserver, navigationObserver);
      } catch (error) {
        console.warn("Some performance observers not supported:", error);
      }
    }
  }

  private trackResource(entry: PerformanceResourceTiming) {
    const name = entry.name;
    const size = entry.transferSize || entry.encodedBodySize || 0;
    const loadTime = entry.responseEnd - entry.startTime;

    this.metrics.resourceSizes[name] = size;
    this.metrics.resourceLoadTimes[name] = loadTime;
    this.metrics.totalResources++;

    // Track chunks specifically
    if (
      name.includes("chunks/") ||
      name.includes("_app") ||
      name.includes("_buildManifest")
    ) {
      const chunkName = this.extractChunkName(name);
      this.metrics.loadedChunks.push(chunkName);
      this.metrics.chunkLoadTimes[chunkName] = loadTime;

      if (this.chunkStartTimes.has(chunkName)) {
        const startTime = this.chunkStartTimes.get(chunkName)!;
        this.metrics.chunkLoadTimes[chunkName] = Date.now() - startTime;
      }
    }

    // Check if resource was cached
    if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
      this.metrics.cachedResources++;
    }

    this.updateCacheHitRate();
    this.calculateTotalBundleSize();
  }

  private trackNavigation(entry: PerformanceNavigationTiming) {
    this.metrics.jsExecutionTime =
      entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
  }

  private extractChunkName(url: string): string {
    const match = url.match(/chunks\/(.+?)\.js/);
    return match ? match[1] : url.split("/").pop() || "unknown";
  }

  private updateCacheHitRate() {
    if (this.metrics.totalResources > 0) {
      this.metrics.cacheHitRate =
        (this.metrics.cachedResources / this.metrics.totalResources) * 100;
    }
  }

  private calculateTotalBundleSize() {
    this.metrics.totalBundleSize = Object.values(this.metrics.resourceSizes)
      .filter((size, index, array) => {
        const url = Object.keys(this.metrics.resourceSizes)[index];
        return url.includes(".js") || url.includes(".css");
      })
      .reduce((total, size) => total + size, 0);
  }

  private analyzeCurrentBundle() {
    // Analyze current performance entries
    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    resources.forEach((resource) => this.trackResource(resource));

    const navigation = performance.getEntriesByType(
      "navigation"
    ) as PerformanceNavigationTiming[];
    if (navigation.length > 0) {
      this.trackNavigation(navigation[0]);
    }

    // Update memory usage
    const memory = (performance as any).memory;
    if (memory) {
      this.metrics.jsHeapSize = memory.usedJSMemory;
      this.metrics.jsHeapSizeLimit = memory.jsHeapSizeLimit;
    }
  }

  private startPeriodicAnalysis() {
    setInterval(() => {
      this.analyzeCurrentBundle();
      this.metrics.timestamp = new Date();
      this.notifyListeners();
    }, 10000); // Every 10 seconds
  }

  public trackChunkLoading(chunkName: string) {
    this.chunkStartTimes.set(chunkName, Date.now());
    if (!this.metrics.pendingChunks.includes(chunkName)) {
      this.metrics.pendingChunks.push(chunkName);
    }
  }

  public getMetrics(): BundleMetrics {
    return { ...this.metrics };
  }

  public getRecommendations(): BundleOptimizationRecommendation[] {
    const recommendations: BundleOptimizationRecommendation[] = [];

    // Bundle size recommendations
    if (this.metrics.totalBundleSize > 500000) {
      // 500KB
      recommendations.push({
        type: "warning",
        category: "bundle",
        message: `Bundle size is ${Math.round(
          this.metrics.totalBundleSize / 1024
        )}KB, consider code splitting`,
        impact: "high",
        solution:
          "Implement dynamic imports and lazy loading for non-critical components",
      });
    }

    // JavaScript heap recommendations
    const memoryUsage =
      (this.metrics.jsHeapSize / this.metrics.jsHeapSizeLimit) * 100;
    if (memoryUsage > 80) {
      recommendations.push({
        type: "critical",
        category: "bundle",
        message: `Memory usage is ${memoryUsage.toFixed(
          1
        )}%, risk of memory leaks`,
        impact: "high",
        solution:
          "Review component cleanup, remove unused imports, implement virtual scrolling",
      });
    }

    // Cache recommendations
    if (this.metrics.cacheHitRate < 50) {
      recommendations.push({
        type: "warning",
        category: "cache",
        message: `Cache hit rate is ${this.metrics.cacheHitRate.toFixed(
          1
        )}%, improve caching strategy`,
        impact: "medium",
        solution:
          "Configure proper cache headers, implement service worker caching",
      });
    }

    // Chunk loading recommendations
    const slowChunks = Object.entries(this.metrics.chunkLoadTimes).filter(
      ([, time]) => time > 3000
    );

    if (slowChunks.length > 0) {
      recommendations.push({
        type: "warning",
        category: "bundle",
        message: `${slowChunks.length} chunks loading slowly (>3s)`,
        impact: "medium",
        solution: "Consider preloading critical chunks or reducing chunk sizes",
      });
    }

    // Connection-specific recommendations
    if (
      this.metrics.effectiveType === "2g" ||
      this.metrics.effectiveType === "slow-2g"
    ) {
      recommendations.push({
        type: "info",
        category: "network",
        message: "Slow connection detected, prioritize critical resources",
        impact: "high",
        solution: "Implement resource prioritization and progressive loading",
      });
    }

    return recommendations;
  }

  public subscribe(listener: (metrics: BundleMetrics) => void) {
    this.listeners.push(listener);
    listener(this.getMetrics());

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    const metrics = this.getMetrics();
    this.listeners.forEach((listener) => listener(metrics));
  }

  public exportAnalysis() {
    return {
      metrics: this.getMetrics(),
      recommendations: this.getRecommendations(),
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  public destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.listeners = [];
  }
}

// Singleton para el analizador de bundle
let bundleAnalyzer: BundleAnalyzer | null = null;

export const useBundleOptimization = () => {
  const [metrics, setMetrics] = useState<BundleMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<
    BundleOptimizationRecommendation[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!bundleAnalyzer) {
      bundleAnalyzer = new BundleAnalyzer();
    }

    const unsubscribe = bundleAnalyzer.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setRecommendations(bundleAnalyzer?.getRecommendations() || []);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const trackChunkLoading = useCallback((chunkName: string) => {
    bundleAnalyzer?.trackChunkLoading(chunkName);
  }, []);

  const exportAnalysis = useCallback(() => {
    return bundleAnalyzer?.exportAnalysis();
  }, []);

  const getBundleScore = useCallback((): number => {
    if (!metrics) return 0;

    let score = 100;

    // Penalize large bundle size
    if (metrics.totalBundleSize > 500000) score -= 20;
    else if (metrics.totalBundleSize > 300000) score -= 10;

    // Penalize high memory usage
    const memoryUsage = (metrics.jsHeapSize / metrics.jsHeapSizeLimit) * 100;
    if (memoryUsage > 80) score -= 25;
    else if (memoryUsage > 60) score -= 10;

    // Penalize low cache hit rate
    if (metrics.cacheHitRate < 30) score -= 15;
    else if (metrics.cacheHitRate < 50) score -= 5;

    // Penalize slow chunk loading
    const avgChunkTime =
      Object.values(metrics.chunkLoadTimes).reduce((a, b) => a + b, 0) /
      Object.keys(metrics.chunkLoadTimes).length;
    if (avgChunkTime > 3000) score -= 20;
    else if (avgChunkTime > 1500) score -= 10;

    return Math.max(0, score);
  }, [metrics]);

  return {
    metrics,
    recommendations,
    trackChunkLoading,
    exportAnalysis,
    getBundleScore,
    isOptimized: getBundleScore() >= 80,
  };
};
