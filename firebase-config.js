import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDrgpMp04uuFRz61vNIOzD9CCPl8p_wDL0",
  authDomain: "territorios-jw.firebaseapp.com",
  projectId: "territorios-jw",
  storageBucket: "territorios-jw.firebasestorage.app",
  messagingSenderId: "350092132257",
  appId: "1:350092132257:web:7795cb426dfe4b496b55e0"
};

// Inicializa Firebase o recupera instancia existente
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Exporta las instancias de los servicios
export const auth = getAuth(app);

// Inicializar Firestore con persistencia configurada (Singleton Pattern)
let firestoreDb;
const initFirestore = (withPersistence = true) => {
  try {
    if (withPersistence) {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    }
  } catch (e) {
    console.warn("📍 Firestore: Persistence init failed, falling back to basic.", e);
  }
  return getFirestore(app);
};

// Emergency check for IndexedDB corruption (Power Up)
try {
  // If we just executed a purge, we might want to wait a bit or skip persistence for 1 session
  const justPurged = localStorage.getItem('xolvy_purge_executed');
  const skipPersistence = (Date.now() - parseInt(justPurged || '0')) < 5000;

  if (skipPersistence) {
    console.warn("🛡️ [Firestore] Skip Persistence due to recent purge.");
    firestoreDb = initFirestore(false);
  } else {
    firestoreDb = initFirestore(true);
  }
} catch (e) {
  console.error("🚨 Firestore: Critical Initialization Error (IndexedDB likely corrupted)", e);
  // FALLBACK: Essential to prevent the "Refusing to open" white screen
  try {
    firestoreDb = getFirestore(app);
    // Silent attempt to clean up for next time
    window.indexedDB.deleteDatabase("firestore/[DEFAULT]/territorios-jw/main");
  } catch (err) {
    firestoreDb = getFirestore(app);
  }
}

// Global Error Listener for Firebase Persistence Corruptions
window.addEventListener('unhandledrejection', event => {
  if (event.reason && event.reason.message && event.reason.message.includes('IndexedDB database data')) {
    console.error("🔥 Persistence Corruption Detected mid-flight. Forcing reload in 3s...");
    setTimeout(() => window.location.reload(), 3000);
  }
});

export const db = firestoreDb;
export const storage = getStorage(app);
