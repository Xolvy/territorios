
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: "2.5.5",
            forceUpdate: true
        });
        console.log("✅ Firestore version updated to 2.5.5");
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

setVersion();
