import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// Configuración de Firebase - Territorios JW
const firebaseConfig = {
    apiKey: "AIzaSyDrgpMp04uuFRz61vNIOzD9CCPl8p_wDL0",
    authDomain: "territorios-jw.web.app",
    projectId: "territorios-jw",
    storageBucket: "territorios-jw.firebasestorage.app",
    messagingSenderId: "350092132257",
    appId: "1:350092132257:web:7795cb426dfe4b496b55e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const newVersion = process.argv[2];

if (!newVersion) {
    console.error("❌ Error: Debes proporcionar un número de versión. Uso: node scripts/set_version.js <version>");
    process.exit(1);
}

const updateVersion = async () => {
    console.log(`🚀 Iniciando actualización a la versión: ${newVersion}...`);
    try {
        await setDoc(doc(db, "configuracion", "version_control"), { 
            latestVersion: newVersion, 
            forceUpdate: true,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log(`✅ [Firebase] Versión actualizada exitosamente a: ${newVersion}`);
        process.exit(0);
    } catch (e) {
        console.error("❌ [Firebase] Error crítico al actualizar la versión:", e);
        process.exit(1);
    }
};

updateVersion();
