import { readFileSync } from 'fs';
import admin from 'firebase-admin';

// Load service account (update the path if necessary for the project)
try {
    const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    const db = admin.firestore();
    db.collection('telefonos').limit(5).get().then(s => {
        s.forEach(d => console.log(d.id, d.data()));
        process.exit(0);
    });
} catch (e) {
    console.log("No service account json found, returning error");
}
