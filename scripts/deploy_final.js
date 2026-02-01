import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from 'fs';
import path from 'path';

// Read version from package.json
const pkgPath = path.resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

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

async function run() {
    try {
        console.log("🔐 Autenticando...");
        await signInAnonymously(auth);
        console.log(`🚀 Publicando actualización remota: v${version}`);

        await setDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: version,
            forceUpdate: true,
            forceTimestamp: Date.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });

        console.log("✅ Versión remota actualizada exitosamente a v" + version);
        process.exit(0);
    } catch (e) {
        console.error("❌ Error al actualizar versión remota:", e);
        process.exit(1);
    }
}

run();
