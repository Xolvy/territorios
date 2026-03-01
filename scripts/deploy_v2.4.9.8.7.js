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

const VERSION = "2.4.9.8.7";

async function run() {
    try {
        console.log(`🚀 [DEPLOY] Powering up version v${VERSION}...`);

        await signInAnonymously(auth);
        console.log("🔓 Authenticated successfully.");

        // 1. Update Core Version Control
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: VERSION,
            forceUpdate: true,
            forceTimestamp: Date.now(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("✅ Main version synced.");

        // 2. Update Module Engine (HMS) - Syncing primary modules to this version
        await setDoc(doc(db, "configuracion", "module_control"), {
            versions: {
                core: VERSION,
                login: VERSION,
                admin: VERSION,
                conductor: VERSION,
                territories_view: VERSION,
                public_view: VERSION,
                phones_view: VERSION,
                rules_view: VERSION,
                availability: VERSION,
                recursos: VERSION,
                maps_explorer: VERSION,
                rescue: VERSION,
                phone_module: VERSION,
                onboarding: VERSION,
                analytics_view: VERSION,
                weekly_program: VERSION,
                program_views: VERSION
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
