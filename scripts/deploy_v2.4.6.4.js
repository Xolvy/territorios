import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, updateDoc } from "firebase/firestore";

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

const VERSION = "2.4.6.4";

async function run() {
    try {
        console.log(`🚀 [DEPLOY] Powering up version v${VERSION}...`);

        // 1. Update Core Version Control
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: VERSION,
            forceUpdate: true,
            forceTimestamp: Date.now(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("✅ Main version synced.");

        // 2. Update Module Engine (HMS)
        await setDoc(doc(db, "configuracion", "module_control"), {
            versions: {
                core: "2.4.2.5",
                login: "2.4.2.5",
                admin: "2.4.2.5",
                conductor: VERSION,
                territories_view: VERSION,
                public_view: "2.4.2.5",
                phones_view: "2.4.2.5",
                rules_view: "2.4.3.7",
                availability: "2.4.2.5",
                recursos: "2.4.3.7",
                maps_explorer: "2.4.5.8",
                rescue: VERSION,
                phone_module: "2.4.3.7",
                onboarding: "2.4.2.5",
                analytics_view: "2.4.5.6",
                weekly_program: "2.4.2.5",
                program_views: "2.4.2.5"
            },
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("✅ HMS Module Registry synced.");

        console.log("\n✨ Deployment successful! Users will receive the update automatically.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Deployment failed:", e);
        process.exit(1);
    }
}

run();
