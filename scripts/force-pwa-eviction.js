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

const forcePWAEviction = async () => {
    try {
        console.log("🔒 Signing in anonymously to Firebase Auth...");
        await signInAnonymously(auth);
        console.log("✅ Authenticated. Pushing eviction bump to version 3.5.0...");

        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: "3.5.0",
            forceUpdate: true,
            forceTimestamp: Date.now(),
            updatedAt: new Date().toLocaleString()
        });

        console.log("🚀 [PWA Eviction] Remote version updated to 3.5.0 with latest forceTimestamp.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to push PWA eviction:", e);
        process.exit(1);
    }
};

forcePWAEviction();
