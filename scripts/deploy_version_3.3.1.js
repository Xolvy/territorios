import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDrgpMp04uuFRz61vNIOzD9CCPl8p_wDL0",
    authDomain: "territorios-jw.firebaseapp.com",
    projectId: "territorios-jw",
    storageBucket: "territorios-jw.firebasestorage.app",
    messagingSenderId: "350092132257",
    appId: "1:350092132257:web:7795cb426dfe4b496b55e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const NEW_VERSION = "3.3.1";
    try {
        console.log(`🚀 Actualizando versión remota a: ${NEW_VERSION}...`);
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: NEW_VERSION,
            forceUpdate: true,
            forceTimestamp: Date.now(),
            notes: "Actualización a v3.3.1: MapViewer Pro y Mejoras de PWA"
        });
        console.log("✅ Versión remota actualizada con éxito en Firestore.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error al actualizar la versión remota:", e);
        process.exit(1);
    }
}

run();
