import { useEffect, useState, useCallback } from "react";

/**
 * useOfflineStatus
 * Simple hook to detect online/offline status and provide helper methods used by components.
 * Mirrors typical implementations and matches the expected named export.
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(true);

  const updateOnlineStatus = useCallback(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // initial read
    updateOnlineStatus();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  function getStatusMessage() {
    return isOnline ? "Conectado" : "Sin conexión";
  }

  function getStatusColor() {
    return isOnline ? "green" : "red";
  }

  function refreshConnection() {
    // Try a simple online check; for a more robust implementation consider a lightweight fetch to a known URL
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(online);
    if (online) setShowOfflineBanner(false);
    return online;
  }

  function dismissBanner() {
    setShowOfflineBanner(false);
  }

  return {
    isOnline,
    showOfflineBanner,
    getStatusMessage,
    getStatusColor,
    refreshConnection,
    dismissBanner,
  } as const;
}

export default useOfflineStatus;
