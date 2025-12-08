import React, { Component, ErrorInfo } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            resetError={this.resetError}
          />
        );
      }

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="text-3xl">⚠️</div>
            <div>
              <h2 className="text-lg font-semibold text-red-800">
                Error en el Sistema de IA
              </h2>
              <p className="text-red-600 text-sm">
                Ha ocurrido un problema con el componente de Inteligencia
                Artificial
              </p>
            </div>
          </div>

          <div className="bg-red-100 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-red-800 mb-2">
              Detalles del Error:
            </div>
            <div className="text-sm text-red-700 font-mono">
              {this.state.error?.message || "Error desconocido"}
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Recargar Página
            </button>
          </div>

          {process.env.NODE_ENV === "development" && this.state.errorInfo && (
            <details className="mt-4">
              <summary className="text-sm font-medium text-red-800 cursor-pointer">
                Stack Trace (Desarrollo)
              </summary>
              <pre className="text-xs text-red-700 bg-red-100 p-3 rounded mt-2 overflow-auto">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
