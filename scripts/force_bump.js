import { db } from '../firebase-config.js';
import { doc, setDoc, Timestamp } from "firebase/firestore";

async function forceUpdate() {
    const version = '2.3.0';
    console.log(`Setting remote version to ${version}...`);
    try {
        const docRef = doc(db, "configuracion", "version_control");
        await setDoc(docRef, {
            latestVersion: version,
            forceUpdate: true,
            forceTimestamp: Date.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });
        console.log("✅ Remote version updated. All users will now be forced to sync.");
    } catch (e) {
        console.error("❌ Error updating version:", e);
    }
}

forceUpdate();
