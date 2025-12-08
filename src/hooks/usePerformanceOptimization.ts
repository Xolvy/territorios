import React from "react";

/**
 * Hook para memoizar componentes pesados y evitar re-renders innecesarios
 * Combina React.memo con useMemo para optimización máxima
 */
export const useOptimizedComponent = <T extends Record<string, any>>(
  component: React.ComponentType<T>,
  dependencies: (keyof T)[] = []
) => {
  return React.useMemo(() => {
    return React.memo(component, (prevProps, nextProps) => {
      // Solo comparar las dependencias especificadas
      if (dependencies.length === 0) return false;

      return dependencies.every((key) => prevProps[key] === nextProps[key]);
    });
  }, [component, dependencies]);
};

/**
 * Hook para memoizar cálculos pesados con invalidación inteligente
 */
export const useHeavyComputation = <T, D extends readonly unknown[]>(
  computation: () => T,
  dependencies: D,
  options: {
    debugName?: string;
    cacheTimeout?: number;
  } = {}
): T => {
  const { debugName, cacheTimeout = 5000 } = options;

  const cacheRef = React.useRef<{
    value: T;
    deps: D;
    timestamp: number;
  } | null>(null);

  return React.useMemo(() => {
    const now = Date.now();

    // Verificar si el cache es válido
    if (cacheRef.current) {
      const isValidTime = now - cacheRef.current.timestamp < cacheTimeout;
      const areDepsEqual = dependencies.every(
        (dep, index) => dep === cacheRef.current!.deps[index]
      );

      if (isValidTime && areDepsEqual) {
        if (debugName && process.env.NODE_ENV === "development") {
          console.log(`🚀 Cache hit for ${debugName}`);
        }
        return cacheRef.current.value;
      }
    }

    // Ejecutar cálculo y cachear
    if (debugName && process.env.NODE_ENV === "development") {
      console.time(`⚡ Computing ${debugName}`);
    }

    const result = computation();

    if (debugName && process.env.NODE_ENV === "development") {
      console.timeEnd(`⚡ Computing ${debugName}`);
    }

    cacheRef.current = {
      value: result,
      deps: dependencies,
      timestamp: now,
    };

    return result;
  }, dependencies);
};

/**
 * Hook para debounce de valores (evita re-cálculos frecuentes)
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook para lazy loading de componentes pesados
 */
export const useLazyComponent = (
  importFunc: () => Promise<{ default: React.ComponentType<any> }>
) => {
  return React.useMemo(() => React.lazy(importFunc), [importFunc]);
};

/**
 * Hook para virtual scrolling (listas grandes)
 */
export const useVirtualList = <T>(
  items: T[],
  options: {
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
  }
) => {
  const { itemHeight, containerHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleRange = React.useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      items.length,
      startIndex + visibleCount + overscan * 2
    );

    return { startIndex, endIndex, visibleCount };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = React.useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  return {
    visibleItems,
    visibleRange,
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.startIndex * itemHeight,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
};
