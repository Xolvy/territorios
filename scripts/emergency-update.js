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

const forceUpdate = async () => {
    try {
        console.log("Signing in anonymously...");
        await signInAnonymously(auth);
        console.log("Signed in. Broadcasting emergency update...");

        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: "2.4.2.1",
            forceUpdate: true,
            forceTimestamp: Date.now()
        });

        console.log("✅ Firestore Version Updated to 2.4.2.1 - Emergency Broadcast Sent!");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error updating version:", e);
        process.exit(1);
    }
};

forceUpdate();
