
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "firebase/firestore";

async function checkTerritories() {
    console.log("Checking territories 8 and 9...");
    const q = query(collection(db, "territorios"), where("numero", "in", ["8", "9", 8, 9]));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.log("No territories found with numbers 8 or 9.");
    } else {
        snap.forEach(doc => {
            console.log(`Territory ${doc.data().numero} (ID: ${doc.id}):`, JSON.stringify(doc.data(), null, 2));
        });
    }
}

checkTerritories().catch(console.error);
