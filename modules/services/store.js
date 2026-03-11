/**
 * Xolvy State Manager - Patrón Observer para Vanilla JS
 * Centraliza el estado de la aplicación, desacopla la UI de los servicios
 * y garantiza persistencia Offline-First.
 */

class StateStore {
    constructor() {
        this.state = {
            telefonos: [],
            territorios: [],
            programa: null,
            configuracion: null,
            publicadores: [],
            sessionActive: false,
            isOnline: navigator.onLine,
            lastSync: null,
            loading: false,
            error: null
        };
        this.observers = [];
        
        // Inicializar listeners globales
        window.addEventListener('online', () => this.set({ isOnline: true }));
        window.addEventListener('offline', () => this.set({ isOnline: false }));
        
        // Carga inicial desde IndexedDB (vía Firebase Persistence o custom)
        this._loadFromStorage();
    }

    /**
     * Suscribe un callback a cambios en el estado
     * @param {Function} callback 
     * @returns {Function} Function para desuscribirse
     */
    subscribe(callback) {
        this.observers.push(callback);
        // Ejecución inmediata para sincronizar estado inicial
        callback(this.state);
        return () => {
            this.observers = this.observers.filter(obs => obs !== callback);
        };
    }

    /**
     * Actualiza el estado parcialmente y notifica a los observadores
     * @param {Object} newStateChunck 
     */
    set(newStateChunck) {
        this.state = { ...this.state, ...newStateChunck };
        this._notify();
        this._saveToStorage();
    }

    /**
     * Obtiene el estado actual (Snapshot)
     */
    get() {
        return { ...this.state };
    }

    _notify() {
        this.observers.forEach(callback => callback(this.state));
    }

    _saveToStorage() {
        // Persistencia ligera para recuperación rápida post-crash
        localStorage.setItem('xolvy_app_state_snapshot', JSON.stringify({
            sessionActive: this.state.sessionActive,
            lastSync: this.state.lastSync,
            // Guardamos IDs de territorios asignados para carga rápida (opcional)
            configuracion: this.state.configuracion
        }));
    }

    _loadFromStorage() {
        try {
            const saved = localStorage.getItem('xolvy_app_state_snapshot');
            if (saved) {
                const data = JSON.parse(saved);
                this.state = { ...this.state, ...data };
            }
        } catch (e) {
            console.warn("Error cargando backup de estado", e);
        }
    }
}

// Singleton para toda la aplicación
export const AppStore = new StateStore();
