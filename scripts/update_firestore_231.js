import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, Timestamp } from "firebase/firestore";
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

async function check() {
    await signInAnonymously(auth);
    const docRef = doc(db, "configuracion", "version_control");
    await updateDoc(docRef, {
        latestVersion: "2.3.1",
        forceTimestamp: Date.now(),
        forceUpdate: true
    });
    console.log("FIRESTORE_UPDATED: 2.3.1");
    process.exit(0);
}

check();
