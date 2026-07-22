import { collection, doc, onSnapshot, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase-config.js";

export class LiveLocationService {
    static watchId = null;
    static activeDocId = null;
    static unsubscribeListener = null;

    static getSanitizedDocId(name) {
        return String(name || "anonimo")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "_");
    }

    /**
     * Inicia la transmisión continua de ubicación GPS en tiempo real
     */
    static startSharingLocation(userName, userRole = "Publicador") {
        if (!navigator.geolocation) {
            console.warn("⚠️ Geolocalización no disponible en este dispositivo.");
            return;
        }

        const docId = this.getSanitizedDocId(userName);
        this.activeDocId = docId;

        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        this.watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const { latitude, longitude, accuracy, heading, speed } = pos.coords;
                const locRef = doc(db, "usuarios_ubicacion_envivo", docId);
                try {
                    await setDoc(locRef, {
                        nombre: userName,
                        rol: userRole,
                        lat: latitude,
                        lng: longitude,
                        accuracy: Math.round(accuracy || 0),
                        heading: heading || 0,
                        speed: speed || 0,
                        updatedAt: new Date().toISOString(),
                        timestamp: Timestamp.now(),
                    }, { merge: true });
                } catch (err) {
                    console.error("Error transmitiendo GPS:", err);
                }
            },
            (error) => {
                console.warn("⚠️ Error obteniendo posición GPS:", error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000,
            }
        );
    }

    /**
     * Detiene el rastreo y elimina el marcador activo de la BD
     */
    static async stopSharingLocation() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        if (this.activeDocId) {
            try {
                await deleteDoc(doc(db, "usuarios_ubicacion_envivo", this.activeDocId));
            } catch (_e) {}
            this.activeDocId = null;
        }
    }

    /**
     * Escucha en tiempo real todas las ubicaciones de los usuarios activos
     */
    static subscribeToLiveLocations(onUpdate) {
        if (this.unsubscribeListener) {
            this.unsubscribeListener();
        }

        const colRef = collection(db, "usuarios_ubicacion_envivo");
        this.unsubscribeListener = onSnapshot(
            colRef,
            (snapshot) => {
                const activeUsers = [];
                const now = Date.now();
                snapshot.forEach((d) => {
                    const data = d.data();
                    // Considerar activo si se actualizó en los últimos 5 minutos
                    const lastTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
                    if (now - lastTime < 5 * 60 * 1000) {
                        activeUsers.push({ id: d.id, ...data });
                    }
                });
                onUpdate(activeUsers);
            },
            (error) => {
                console.warn("Error escuchando ubicaciones en vivo:", error);
            }
        );

        return this.unsubscribeListener;
    }
}

window.LiveLocationService = LiveLocationService;
