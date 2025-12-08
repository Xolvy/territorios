import React from "react";
import { Wifi, WifiOff, Database, User, Clock } from "lucide-react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";

export function FirebaseStatus() {
  const { state } = useUnifiedApp();
  const isFirebaseConnected = state.currentUser !== null; // Simplificar verificación

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="glass-card p-3 flex items-center space-x-3 text-sm">
        {/* Conexión Firebase */}
        <div className="flex items-center space-x-2">
          {isFirebaseConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Firebase</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-red-400">Offline</span>
            </>
          )}
        </div>

        {/* Base de datos */}
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400">Firestore</span>
        </div>
      </div>
    </div>
  );
}

export default FirebaseStatus;
