
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const newAdmins = [
    { email: 'tefo94@gmail.com', nombre: 'Tefo', role: 'Administrador' },
    { email: 'borutogamer0312@gmail.com', nombre: 'BorutoGamer', role: 'Administrador' }
];

async function addAdmins() {
    console.log("Checking and adding admins...");
    const colRef = collection(db, 'conductores');

    for (const admin of newAdmins) {
        const q = query(colRef, where("email", "==", admin.email));
        const snap = await getDocs(q);

        if (snap.empty) {
            await addDoc(colRef, admin);
            console.log(`✅ Added ${admin.email}`);
        } else {
            console.log(`⚠️ ${admin.email} already exists.`);
        }
    }
    console.log("Done.");
    process.exit(0);
}

addAdmins();
