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
try {
  // Intentar inicializar con configuración de persistencia
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Si ya está inicializado (posiblemente por otra importación o HMR), usar la instancia existente
  console.warn("Firestore already initialized, using existing instance:", e.message);
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const storage = getStorage(app);
