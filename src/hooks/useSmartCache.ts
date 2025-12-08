import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live en milisegundos
  staleWhileRevalidate?: boolean; // Servir cache expirado mientras recarga
  maxEntries?: number; // Límite de entradas en cache
}

class IntelligentCache {
  private cache = new Map<string, CacheEntry<any>>();
  private subscriptions = new Map<string, Set<Function>>();
  private maxEntries: number;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  set<T>(key: string, data: T, ttl = 300000): void {
    // 5 min default
    // Limpiar cache si está lleno
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });

    // Notificar a suscriptores
    this.notifySubscribers(key, data);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    // Notificar invalidación
    this.notifySubscribers(key, null);
  }

  subscribe(key: string, callback: Function): () => void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  private notifySubscribers(key: string, data: any): void {
    const subs = this.subscriptions.get(key);
    if (subs) {
      subs.forEach((callback) => callback(data));
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
    this.subscriptions.clear();
  }

  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    this.cache.forEach((entry) => {
      if (now <= entry.expiresAt) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      subscriptions: this.subscriptions.size,
      hitRatio: this.calculateHitRatio(),
    };
  }

  private hitCount = 0;
  private missCount = 0;

  private calculateHitRatio(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }
}

// Cache global singleton
const globalCache = new IntelligentCache(200);

/**
 * Hook para usar cache inteligente en componentes
 */
export const useSmartCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) => {
  const {
    ttl = 300000, // 5 minutos
    staleWhileRevalidate = true,
    maxEntries = 100,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(
    async (useStale = false) => {
      try {
        setError(null);

        // Intentar obtener del cache
        const cached = useStale
          ? globalCache.getStale<T>(key)
          : globalCache.get<T>(key);

        if (cached && !useStale) {
          setData(cached);
          setIsStale(false);
          return cached;
        }

        if (cached && useStale) {
          setData(cached);
          setIsStale(true);
        } else {
          setIsLoading(true);
        }

        // Fetch fresh data
        const freshData = await fetcherRef.current();
        globalCache.set(key, freshData, ttl);

        setData(freshData);
        setIsStale(false);
        setIsLoading(false);

        return freshData;
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);

        // En caso de error, usar datos stale si están disponibles
        if (staleWhileRevalidate) {
          const staleData = globalCache.getStale<T>(key);
          if (staleData) {
            setData(staleData);
            setIsStale(true);
          }
        }

        throw err;
      }
    },
    [key, ttl, staleWhileRevalidate]
  );

  const mutate = useCallback(
    (newData: T) => {
      globalCache.set(key, newData, ttl);
      setData(newData);
      setIsStale(false);
    },
    [key, ttl]
  );

  const invalidate = useCallback(() => {
    globalCache.invalidate(key);
    setData(null);
    setIsStale(false);
  }, [key]);

  // Subscribe to cache changes
  useEffect(() => {
    const unsubscribe = globalCache.subscribe(key, (newData: T | null) => {
      if (newData !== null) {
        setData(newData);
        setIsStale(false);
      }
    });

    return unsubscribe;
  }, [key]);

  // Initial load
  useEffect(() => {
    fetchData(staleWhileRevalidate);
  }, [fetchData, staleWhileRevalidate]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch: () => fetchData(false),
    mutate,
    invalidate,
  };
};

/**
 * Hook para cache de Firebase específico
 */
export const useFirebaseCache = <T>(
  collection: string,
  documentId?: string,
  fetcher?: () => Promise<T>,
  options: CacheOptions = {}
) => {
  const cacheKey = documentId
    ? `firebase:${collection}:${documentId}`
    : `firebase:${collection}`;

  return useSmartCache(cacheKey, fetcher!, {
    ttl: 600000, // 10 minutos para Firebase
    staleWhileRevalidate: true,
    ...options,
  });
};

/**
 * Exportar cache para uso directo
 */
export { globalCache };

/**
 * Hook para métricas de cache
 */
export const useCacheMetrics = () => {
  const [metrics, setMetrics] = useState(globalCache.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(globalCache.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
};
