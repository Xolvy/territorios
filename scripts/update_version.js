import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
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

async function setVersion() {
    try {
        await signInAnonymously(auth);
        console.log("🔓 Authenticated anonymously");
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: "3.0.0",
            forceUpdate: true
        });
        console.log("✅ Firestore version updated to 3.0.0");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error:", e);
        process.exit(1);
    }
}

setVersion();
