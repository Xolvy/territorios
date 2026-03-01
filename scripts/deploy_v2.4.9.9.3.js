import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";

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
    try {
        const newVersion = "2.4.9.9.3";
        console.log(`🚀 Updating system version to: v${newVersion}`);

        // 1. Update Version Control (for auto-update logic)
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: newVersion,
            forceUpdate: true,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // 2. Update System Status
        await setDoc(doc(db, "configuracion", "system_status"), {
            current_version: newVersion,
            last_update: Timestamp.now()
        }, { merge: true });

        console.log("✅ Remote version updated successfully in Firestore.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to update remote version:", e);
        process.exit(1);
    }
}

run();
