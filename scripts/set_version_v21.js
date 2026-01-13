
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

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

async function setVersion() {
    try {
        const version = "3.6.9.8";
        const ts = Date.now();
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: version,
            forceUpdate: true,
            forceTimestamp: ts
        });
        console.log(`✅ Firestore version updated to ${version} with timestamp ${ts}`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Error:", e);
        process.exit(1);
    }
}

setVersion();
