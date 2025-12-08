import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDrgpMp04uuFRz61vNIOzD9CCPl8p_wDL0",
  authDomain: "territorios-jw.firebaseapp.com",
  projectId: "territorios-jw",
  storageBucket: "territorios-jw.firebasestorage.app",
  messagingSenderId: "350092132257",
  appId: "1:350092132257:web:7795cb426dfe4b496b55e0"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta las instancias de los servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
