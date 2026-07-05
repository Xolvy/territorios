import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../../firebase-config.js";

export const getRecursos = async () => {
    const querySnapshot = await getDocs(collection(db, "recursos"));
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const addRecurso = async (recurso) => {
    await addDoc(collection(db, "recursos"), recurso);
};

export const deleteRecurso = async (id) => {
    await deleteDoc(doc(db, "recursos", id));
};

export const updateRecurso = async (id, data) => {
    await updateDoc(doc(db, "recursos", id), data);
};
