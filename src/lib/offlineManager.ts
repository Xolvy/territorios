/**
 * Gestor de funcionalidad offline para la aplicación de territorios
 * Optimiza el uso de Firestore para trabajo offline/online
 */

import {
  enableNetwork,
  disableNetwork,
  onSnapshot,
  enableIndexedDbPersistence,
  clearIndexedDbPersistence,
} from "firebase/firestore";
import { db } from "./firebase";

export class OfflineManager {
  private isOnline: boolean = navigator.onLine;
  private listeners: ((online: boolean) => void)[] = [];

  constructor() {
    this.initializeOfflineSupport();
    this.setupNetworkListeners();
  }

  /**
   * Inicializar persistencia local de Firestore
   */
  private async initializeOfflineSupport() {
    try {
      // Habilitar persistencia local para trabajo offline
      await enableIndexedDbPersistence(db);
      console.log("✅ Persistencia offline habilitada");
    } catch (error: any) {
      if (error.code === "failed-precondition") {
        console.warn("⚠️ Persistencia fallida: múltiples pestañas abiertas");
      } else if (error.code === "unimplemented") {
        console.warn("⚠️ Persistencia no soportada en este navegador");
      } else {
        console.error("❌ Error configurando persistencia:", error);
      }
    }
  }

  /**
   * Configurar listeners de red
   */
  private setupNetworkListeners() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.enableOnlineMode();
      this.notifyListeners(true);
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.enableOfflineMode();
      this.notifyListeners(false);
    });
  }

  /**
   * Habilitar modo online
   */
  private async enableOnlineMode() {
    try {
      await enableNetwork(db);
      console.log("🌐 Modo online habilitado - sincronizando datos...");
    } catch (error) {
      console.error("❌ Error habilitando red:", error);
    }
  }

  /**
   * Habilitar modo offline
   */
  private async enableOfflineMode() {
    try {
      await disableNetwork(db);
      console.log("📱 Modo offline habilitado - usando caché local");
    } catch (error) {
      console.error("❌ Error deshabilitando red:", error);
    }
  }

  /**
   * Obtener estado de conexión
   */
  public getConnectionStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Agregar listener de cambios de conexión
   */
  public onConnectionChange(callback: (online: boolean) => void) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  /**
   * Notificar a todos los listeners
   */
  private notifyListeners(online: boolean) {
    this.listeners.forEach((callback) => callback(online));
  }

  /**
   * Limpiar caché local (para desarrollo/debugging)
   */
  public async clearOfflineCache() {
    try {
      await clearIndexedDbPersistence(db);
      console.log("🗑️ Caché offline limpiado");
    } catch (error) {
      console.error("❌ Error limpiando caché:", error);
    }
  }

  /**
   * Configurar sincronización automática para colecciones críticas
   */
  public setupAutoSync() {
    // Esta función se puede expandir para configurar
    // sincronización específica por colección
    console.log("🔄 Sincronización automática configurada");
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();
