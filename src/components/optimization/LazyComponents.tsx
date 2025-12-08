import React, { lazy, Suspense, ComponentType } from "react";

// Componente de loading avanzado
const LazyLoadingSpinner: React.FC<{ message?: string }> = ({
  message = "Cargando...",
}) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <div className="relative">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <div className="animate-ping absolute top-0 left-0 rounded-full h-12 w-12 border-2 border-blue-400 opacity-75"></div>
    </div>
    <p className="text-gray-600 text-sm animate-pulse">{message}</p>
  </div>
);

// Error boundary para lazy components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyErrorBoundary extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  }>,
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Lazy loading error:", error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({
  error,
  retry,
}) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-red-50 rounded-lg border border-red-200">
    <div className="text-red-600 text-4xl">⚠️</div>
    <div className="text-center">
      <h3 className="text-lg font-semibold text-red-800 mb-2">
        Error al cargar el componente
      </h3>
      <p className="text-red-600 text-sm mb-4">{error.message}</p>
      <button
        onClick={retry}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        Reintentar
      </button>
    </div>
  </div>
);

// Hook para lazy loading con retry
export const useLazyComponent = <T extends ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  options: {
    retries?: number;
    retryDelay?: number;
    fallback?: React.ReactNode;
    errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  } = {}
) => {
  const { retries = 3, retryDelay = 1000, fallback, errorFallback } = options;

  const lazyComponent = lazy(() => {
    let attempt = 0;

    const loadWithRetry = async (): Promise<{ default: T }> => {
      try {
        return await importFunction();
      } catch (error) {
        attempt++;
        if (attempt >= retries) {
          throw error;
        }

        console.warn(
          `Lazy loading attempt ${attempt} failed, retrying in ${retryDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return loadWithRetry();
      }
    };

    return loadWithRetry();
  });

  const WrappedComponent: React.FC<any> = (props) => (
    <LazyErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback || <LazyLoadingSpinner />}>
        {React.createElement(lazyComponent, props)}
      </Suspense>
    </LazyErrorBoundary>
  );

  return WrappedComponent;
};

// Preloader para componentes críticos
export const preloadComponent = <T extends ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>
): void => {
  if (typeof window !== "undefined") {
    // Precargar después de que la página termine de cargar
    if (document.readyState === "complete") {
      importFunction().catch(console.warn);
    } else {
      window.addEventListener("load", () => {
        setTimeout(() => importFunction().catch(console.warn), 1000);
      });
    }
  }
};

// Componentes lazy para los dashboards
export const LazyPerformanceDashboard = lazy(() =>
  import("../admin/PerformanceDashboard")
    .then((module) => ({ default: module.default }))
    .catch((error) => {
      console.error("Failed to load PerformanceDashboard:", error);
      throw error;
    })
);

export const LazyErrorMonitoringDashboard = lazy(() =>
  import("../admin/ErrorMonitoringDashboard")
    .then((module) => ({ default: module.default }))
    .catch((error) => {
      console.error("Failed to load ErrorMonitoringDashboard:", error);
      throw error;
    })
);

export const LazyAdvancedAnalyticsDashboard = lazy(() =>
  import("../admin/AdvancedAnalyticsDashboard")
    .then((module) => ({ default: module.default }))
    .catch((error) => {
      console.error("Failed to load AdvancedAnalyticsDashboard:", error);
      throw error;
    })
);

export const LazyDatabaseAdmin = lazy(() =>
  import("../admin/DatabaseAdmin")
    .then((module) => ({ default: module.default }))
    .catch((error) => {
      console.error("Failed to load DatabaseAdmin:", error);
      throw error;
    })
);

// Componente de lazy loading con métricas de rendimiento
export const OptimizedLazyWrapper: React.FC<{
  children: React.ReactNode;
  componentName: string;
  priority?: "high" | "medium" | "low";
}> = ({ children, componentName, priority = "medium" }) => {
  const [loadTime, setLoadTime] = React.useState<number | null>(null);
  const startTime = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const endTime = Date.now();
    const duration = endTime - startTime.current;
    setLoadTime(duration);

    // Reportar métricas de rendimiento
    if (typeof window !== "undefined" && (window as any).analyticsService) {
      (window as any).analyticsService.trackEvent(
        "component_loaded",
        "performance",
        {
          componentName,
          loadTime: duration,
          priority,
        }
      );
    }
  }, [componentName, priority]);

  return (
    <div data-component={componentName} data-priority={priority}>
      {children}
      {process.env.NODE_ENV === "development" && loadTime && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50">
          {componentName}: {loadTime}ms
        </div>
      )}
    </div>
  );
};

// Configuración de intersección observer para lazy loading
export const useIntersectionObserver = (
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [elementRef, options]);

  return isIntersecting;
};

// Componente de lazy loading basado en viewport
export const ViewportLazyLoader: React.FC<{
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
}> = ({ children, placeholder, className = "" }) => {
  const elementRef = React.useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(
    elementRef as React.RefObject<Element>
  );
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    if (isIntersecting && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isIntersecting, hasLoaded]);

  return (
    <div ref={elementRef} className={className}>
      {hasLoaded ? children : placeholder || <LazyLoadingSpinner />}
    </div>
  );
};

export default {
  LazyPerformanceDashboard,
  LazyErrorMonitoringDashboard,
  LazyAdvancedAnalyticsDashboard,
  LazyDatabaseAdmin,
  useLazyComponent,
  preloadComponent,
  OptimizedLazyWrapper,
  ViewportLazyLoader,
  LazyLoadingSpinner,
};
