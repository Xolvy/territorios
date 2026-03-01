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

const syncModules = async () => {
    const version = "2.4.9.9.0";
    try {
        console.log("Signing in anonymously...");
        await signInAnonymously(auth);
        console.log(`Signed in. Syncing modules to v${version}...`);

        const moduleVersions = {
            core: version,
            login: version,
            admin: version,
            conductor: version,
            territories_view: version,
            public_view: version,
            phones_view: version,
            rules_view: version,
            availability: version,
            recursos: version,
            maps_explorer: version,
            rescue: version,
            phone_module: version,
            onboarding: version,
            analytics_view: version,
            weekly_program: version,
            program_views: version
        };

        await setDoc(doc(db, "configuracion", "module_control"), {
            versions: moduleVersions,
            lastUpdate: Date.now(),
            updatedBy: "Antigravity Deployment System"
        });

        // Also update main version control
        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: version,
            forceUpdate: true,
            forceTimestamp: Date.now()
        });

        console.log(`🚀 [Xolvy Modular] All modules synchronized to v${version}.`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Error syncing modules:", e);
        process.exit(1);
    }
};

syncModules();
