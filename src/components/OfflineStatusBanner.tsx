/**
 * Componente que muestra el estado de conexión offline/online
 * Banner que aparece cuando la app está trabajando offline
 */

import React from "react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { Wifi, WifiOff, RefreshCw, X } from "lucide-react";

interface OfflineStatusBannerProps {
  className?: string;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  className = "",
}) => {
  const {
    isOnline,
    showOfflineBanner,
    getStatusMessage,
    getStatusColor,
    refreshConnection,
    dismissBanner,
  } = useOfflineStatus();

  // Banner que aparece cuando está offline
  if (showOfflineBanner && !isOnline) {
    return (
      <div
        className={`
        fixed top-0 left-0 right-0 z-50 
        bg-gradient-to-r from-amber-500 to-orange-500 
        text-white px-4 py-3 shadow-lg
        animate-slide-down
        ${className}
      `}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <WifiOff className="w-5 h-5 animate-pulse" />
            <div>
              <p className="font-semibold text-sm">Trabajando sin conexión</p>
              <p className="text-xs text-white/90">
                Los cambios se sincronizarán cuando vuelvas a conectarte
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={refreshConnection}
              className="
                p-2 rounded-lg bg-white/20 hover:bg-white/30 
                transition-colors duration-200
              "
              title="Intentar reconectar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={dismissBanner}
              className="
                p-2 rounded-lg bg-white/20 hover:bg-white/30 
                transition-colors duration-200
              "
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Componente pequeño para mostrar en la barra de estado
export const ConnectionIndicator: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const { isOnline, getStatusMessage, getStatusColor } = useOfflineStatus();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {isOnline ? (
        <Wifi className={`w-4 h-4 ${getStatusColor()}`} />
      ) : (
        <WifiOff className={`w-4 h-4 ${getStatusColor()} animate-pulse`} />
      )}
      <span className={`text-xs ${getStatusColor()}`}>
        {getStatusMessage()}
      </span>
    </div>
  );
};

export default OfflineStatusBanner;
