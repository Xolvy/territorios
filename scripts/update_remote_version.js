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
    try {
        console.log("Values updating to: 1.9.9.0");
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: "1.9.9.0",
            forceUpdate: true
        });
        console.log("✅ Remote version updated successfully.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to update remote version:", e);
        process.exit(1);
    }
}

run();
