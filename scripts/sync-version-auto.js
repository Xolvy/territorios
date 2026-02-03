import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json version
const pkgPath = join(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

console.log(`🚀 [Auto-Update] Preparing to sync version v${version} to Firestore...`);

// Check for Service Account in Environment (GitHub Actions)
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountKey) {
    console.error("❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    console.log("This script is intended to run in a CI environment (GitHub Actions).");
    process.exit(1);
}

try {
    const serviceAccount = JSON.parse(serviceAccountKey);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    const versionRef = db.collection('configuracion').doc('version_control');

    await versionRef.update({
        latestVersion: version,
        forceTimestamp: Date.now(),
        forceUpdate: true,
        updatedAt: new Date().toISOString()
    });

    console.log(`✅ [Success] Firestore updated to v${version}`);
    process.exit(0);
} catch (error) {
    console.error("❌ [Failure] Could not update Firestore:", error);
    process.exit(1);
}
