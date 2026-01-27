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
    const version = "2.3.8";
    try {
        console.log("🔐 Autenticando...");
        await signInAnonymously(auth);
        console.log(`🚀 Publicando actualización forzada: v${version}`);
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: version,
            forceUpdate: true,
            forceTimestamp: Date.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });
        console.log("✅ Versión remota actualizada. v" + version);
        process.exit(0);
    } catch (e) {
        console.error("❌ Error al actualizar versión remota:", e);
        process.exit(1);
    }
}

run();
