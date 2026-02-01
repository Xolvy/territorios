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
  firestoreDb = initFirestore(true);
} catch (e) {
  console.error("🚨 Firestore: Critical Initialization Error (IndexedDB likely corrupted)", e);
  // If it fails with the specific corruption error, we force a non-persistent instance
  // and attempt to clear the corrupted db for the next reload
  if (e.message.includes('IndexedDB') || e.code === 'failed-precondition') {
    firestoreDb = initFirestore(false);
    // Attempt to delete corrupted databases from the browser
    try {
      window.indexedDB.deleteDatabase("firestore/[DEFAULT]/territorios-jw/main");
    } catch (err) { /* ignore */ }
  } else {
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;
export const storage = getStorage(app);
