/**
 * @file modules/utils/background-sync.js
 * @description Xolvy Background Sync Helper — Frontend interface para encolar
 * peticiones offline y registrar el Service Worker personalizado.
 *
 * FLUJO:
 * 1. El Conductor presiona "Finalizar Sesión" sin red
 * 2. La llamada a la Cloud Function falla con NetworkError
 * 3. background-sync.js guarda la petición serializada en IndexedDB
 * 4. Registra un SyncEvent con el tag 'xolvy-session-sync'
 * 5. El SW (sw-custom.js) escucha el evento 'sync' y vuelve a lanzar la petición
 *    cuando el dispositivo recupera conexión
 * 6. El SW notifica a todas las pestañas abiertas vía postMessage
 */

const DB_NAME = 'xolvy-sync-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending-requests';
const SYNC_TAG = 'xolvy-session-sync';

// ─── DB HELPERS ───────────────────────────────────────────────────────────────
const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
});

const enqueueRequest = async (requestData) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).add({
            ...requestData,
            enqueuedAt: Date.now(),
        });
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
};

// ─── MAIN: ENQUEUE SESSION CLOSURE ───────────────────────────────────────────

/**
 * Intenta llamar a la Cloud Function directamente.
 * Si falla por falta de red, encola la petición para Background Sync.
 *
 * @param {string}   url     - URL completa de la Cloud Function
 * @param {object}   body    - Payload JSON para la función
 * @param {string}   token   - Firebase Auth ID token del usuario actual
 * @param {Function} onSuccess - Callback cuando la petición se completa (real o synced)
 * @param {Function} onQueue   - Callback cuando se encola (sin red)
 * @returns {Promise<boolean>} - true si se ejecutó en línea, false si se encoló
 */
export const callOrQueue = async (url, body, token, onSuccess, onQueue) => {
    const requestData = {
        url,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    };

    // 1. Intento directo (con red)
    if (navigator.onLine) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: requestData.headers,
                body: requestData.body,
            });
            if (res.ok) {
                const data = await res.json();
                onSuccess?.(data);
                return true;
            }
        } catch (e) {
            console.warn('[BackgroundSync] Direct call failed, queueing...', e);
        }
    }

    // 2. Sin red o fallo de red: encolar
    await enqueueRequest(requestData);
    console.log('[BackgroundSync] Request enqueued for later sync.');

    // 3. Registrar Background Sync tag
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
            await registration.sync.register(SYNC_TAG);
            console.log(`[BackgroundSync] Sync tag '${SYNC_TAG}' registered.`);
        } catch (e) {
            console.warn('[BackgroundSync] SyncManager registration failed:', e);
        }
    }

    onQueue?.();
    return false;
};

// ─── LISTENER: Background Sync completion messages ────────────────────────────

/**
 * Escucha mensajes del Service Worker cuando una petición encolada
 * se procesa exitosamente.
 *
 * @param {Function} callback - Función a llamar cuando se complete la sincronización
 * @returns {Function} Cleanup function para remover el listener
 */
export const onSyncComplete = (callback) => {
    const handler = (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
            callback(event.data.payload);
        }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
};

// ─── FCM: SUSCRIPCIÓN AL TOPIC 'admins' ──────────────────────────────────────

/**
 * Suscribe el token FCM del admin actual al topic 'admins' usando el Admin SDK
 * a través de una Cloud Function callable. Llamar esto en el login del Admin.
 *
 * Nota: La suscripción directa client-side al topic no está disponible en Web.
 * Se debe delegar al servidor con el Admin SDK.
 * Por ahora simplemente guardamos el token en el perfil del Admin en Firestore
 * para que el servidor lo suscriba al topic en el siguiente deploy.
 *
 * @param {string} fcmToken - Token FCM del dispositivo actual
 * @param {string} adminUid - UID del admin autenticado
 */
export const registerAdminForAlerts = async (fcmToken, adminUid) => {
    if (!fcmToken || !adminUid) return;
    try {
        const { db } = await import('../../firebase-config.js');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'publicadores', adminUid), {
            fcm_token: fcmToken,
            fcm_topic_admins: true,
            fcm_updated_at: new Date().toISOString(),
        }, { merge: true });
        console.log('[FCM] Admin token registrado para alertas críticas.');
    } catch (e) {
        console.warn('[FCM] No se pudo registrar token de admin:', e);
    }
};
