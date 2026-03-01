import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
const auth = getAuth(app);

async function run() {
    try {
        console.log("🔐 Autenticando para actualización remota...");
        await signInAnonymously(auth);

        const newVersion = "2.5";
        console.log(`🚀 Updating system version to: v${newVersion} [VISUAL 2027 FINAL]`);

        // 1. Update Version Control (for auto-update logic)
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: newVersion,
            forceUpdate: true,
            updatedAt: new Date().toISOString(),
            changelog: "Sistema Xolvy 2027 (v2.5) - Gestión de Categorías Unificada, Navegación Optimizada y Guardado Automático con LED Feedback"
        }, { merge: true });

        // 2. Update System Status
        await setDoc(doc(db, "configuracion", "system_status"), {
            current_version: newVersion,
            last_update: Timestamp.now(),
            tag: "Visual 2027 Stable Core"
        }, { merge: true });

        console.log("✅ Remote version updated successfully in Firestore.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to update remote version:", e);
        process.exit(1);
    }
}

run();
