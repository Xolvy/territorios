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
  const justPurged = localStorage.getItem('xolvy_purge_executed');
  const forceDisable = localStorage.getItem('xolvy_disable_persistence') === 'true';
  const skipPersistence = forceDisable || (Date.now() - parseInt(justPurged || '0')) < 5000;

  if (skipPersistence) {
    console.warn("🛡️ [Firestore] Skip Persistence due to recovery flag or recent purge.");
    // Auto-reset the flag for the next try, assuming this boot will be clean
    localStorage.removeItem('xolvy_disable_persistence');
    firestoreDb = initFirestore(false);
  } else {
    firestoreDb = initFirestore(true);
  }
} catch (e) {
  console.error("🚨 Firestore: Critical Initialization Error", e);
  firestoreDb = getFirestore(app);
}

// Global Error Listener for Firebase Persistence Corruptions
window.addEventListener('unhandledrejection', event => {
  const msg = event.reason?.message || '';
  if (msg.includes('IndexedDB database data') || msg.includes('refusing to open IndexedDB')) {
    console.error("🔥 Persistence Corruption Detected. Triggering emergency recovery...");

    // Recovery: Disable persistence for the next boot and purge
    localStorage.setItem('xolvy_purge_executed', Date.now().toString());
    localStorage.setItem('xolvy_disable_persistence', 'true');

    // Critical: Clean up what we can now
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }

    if (window.indexedDB) {
      window.indexedDB.deleteDatabase("firestore/[DEFAULT]/territorios-jw/main");
    }

    setTimeout(() => {
      // Force reload with cache busting
      window.location.href = `${window.location.pathname}?rescue=${Date.now()}`;
    }, 1500);
  }
});

export const db = firestoreDb;
export const storage = getStorage(app);
