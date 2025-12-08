import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  addDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  limit,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db, auth } from "./firebase";
import {
  Territory,
  Conductor,
  Publicador,
  TelephoneRecord,
  ProgramaReunion,
  Lugar,
  Faceta,
  Assignment,
  HistoryAssignment,
  TelephoneStatus,
} from "@/types";

// Configuration constants
export const APP_ID = "conductores-app-v2";
export const TOTAL_TERRITORIES = 22;
export const MANZANAS_POR_TERRITORIO: Record<number, number> = {
  1: 4,
  2: 3,
  3: 7,
  4: 3,
  5: 4,
  6: 4,
  7: 3,
  8: 4,
  9: 2,
  10: 2,
  11: 2,
  12: 1,
  13: 2,
  14: 4,
  15: 4,
  16: 2,
  17: 2,
  18: 2,
  19: 4,
  20: 1,
  21: 2,
  22: 3,
};

export const ESTADOS_TELEFONICOS: TelephoneStatus[] = [
  "",
  "Colgaron",
  "No llamar",
  "Contestaron",
  "Revisita",
  "Suspendido",
  "No contestaron",
  "Testigo",
];

// Collection reference helpers
const getCollectionRef = (collectionName: string) =>
  collection(db, "artifacts", APP_ID, "public", "data", collectionName);

const getDocRef = (collectionName: string, docId: string) =>
  doc(db, "artifacts", APP_ID, "public", "data", collectionName, docId);

// Collection references
export const conductoresRef = () => getCollectionRef("conductores");
export const publicadoresRef = () => getCollectionRef("publicadores");
export const territoriosRef = () => getCollectionRef("territorios");
export const telefonosRef = () => getCollectionRef("telefonos");
export const programaRef = () => getCollectionRef("programa");
export const lugaresRef = () => getCollectionRef("lugares");
export const facetasRef = () => getCollectionRef("facetas");

// Document references
export const conductorRef = (id: string) => getDocRef("conductores", id);
export const publicadorRef = (id: string) => getDocRef("publicadores", id);
export const territorioRef = (id: string) => getDocRef("territorios", id);
export const telefonoRef = (id: string) => getDocRef("telefonos", id);
export const programaDocRef = (id: string) => getDocRef("programa", id);

// Utility functions
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const generateId = () => Math.random().toString(36).substr(2, 9);

// Enhanced Firebase Service Class
export class FirebaseService {
  private static instance: FirebaseService;
  private listeners: Record<string, () => void> = {};
  private isAuthenticated = false;

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  // Ensure user is authenticated with anonymous fallback
  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated) return;

    return new Promise((resolve, reject) => {
      const isDevelopment = process.env.NODE_ENV === "development";

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          if (isDevelopment) {
            console.log(
              "✅ Usuario autenticado:",
              user.uid,
              user.isAnonymous ? "(anónimo)" : "(usuario)"
            );
          }
          this.isAuthenticated = true;
          unsubscribe();
          resolve();
        } else {
          // Solo intentar autenticación anónima en desarrollo
          if (isDevelopment) {
            console.log("🔐 Iniciando sesión anónima...");
            try {
              await signInAnonymously(auth);
              // The onAuthStateChanged will fire again with the anonymous user
            } catch (error: any) {
              console.error("❌ Error en autenticación anónima:", error);
              console.log(
                "⏭️ Omitiendo inicialización base (no autenticado):",
                error?.message || error
              );
              unsubscribe();
              // En desarrollo, rechazar el error
              reject(new Error("Error de autenticación"));
            }
          } else {
            // En producción, omitir autenticación anónima y continuar sin autenticación
            if (isDevelopment) {
              console.log(
                "⏭️ Omitiendo inicialización base (no autenticado): Error de autenticación"
              );
            }
            unsubscribe();
            // En producción, resolver sin autenticación para evitar bloqueos
            resolve();
          }
        }
      });

      // Timeout after 15 seconds (increased for anonymous auth)
      setTimeout(() => {
        unsubscribe();
        reject(new Error("Authentication timeout"));
      }, 15000);
    });
  }

  // Initialize base data
  async initializeBaseData(): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      console.log("🔑 Asegurando autenticación...");
    }

    try {
      await this.ensureAuthenticated();
    } catch (error: any) {
      if (isDevelopment) {
        console.log(
          "⏭️ Omitiendo inicialización base (no autenticado):",
          error?.message || error
        );
      }
      return; // Salir silenciosamente si no hay autenticación
    }

    if (isDevelopment) {
      console.log("📊 Inicializando datos base...");
    }

    const checkAndInit = async (ref: any, baseArray: { nombre: string }[]) => {
      const q = query(ref, limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        if (isDevelopment) {
          console.log(`📝 Creando datos iniciales para ${ref.path}`);
        }
        const batch = writeBatch(db);
        baseArray.forEach((item) => {
          const newDocRef = doc(ref);
          batch.set(newDocRef, item);
        });
        await batch.commit();
      }
    };

    await Promise.all([
      checkAndInit(lugaresRef(), [
        { nombre: "Salón del Reino" },
        { nombre: "Zoom" },
      ]),
      checkAndInit(facetasRef(), [
        { nombre: "Casa en casa" },
        { nombre: "Negocios" },
      ]),
    ]);

    if (isDevelopment) {
      console.log("✅ Datos base inicializados");
    }
  }

  // Conductor operations
  async addConductor(nombre: string): Promise<string> {
    const docRef = await addDoc(conductoresRef(), { nombre });
    return docRef.id;
  }

  async updateConductor(id: string, nombre: string): Promise<void> {
    await updateDoc(conductorRef(id), { nombre });
  }

  async deleteConductor(id: string): Promise<void> {
    await deleteDoc(conductorRef(id));
  }

  subscribeToConductores(
    callback: (conductores: Conductor[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(conductoresRef(), (snapshot) => {
      const conductores = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Conductor)
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(conductores);
    });

    this.listeners["conductores"] = unsubscribe;
    return unsubscribe;
  }

  // Publicador operations
  async addPublicador(nombre: string): Promise<string> {
    const docRef = await addDoc(publicadoresRef(), { nombre });
    return docRef.id;
  }

  async updatePublicador(id: string, nombre: string): Promise<void> {
    await updateDoc(publicadorRef(id), { nombre });
  }

  async deletePublicador(id: string): Promise<void> {
    await deleteDoc(publicadorRef(id));
  }

  subscribeToPublicadores(
    callback: (publicadores: Publicador[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(publicadoresRef(), (snapshot) => {
      const publicadores = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Publicador)
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(publicadores);
    });

    this.listeners["publicadores"] = unsubscribe;
    return unsubscribe;
  }

  // Territory operations
  async assignTerritory(
    territorioNum: number,
    conductor: string,
    manzanas: number[],
    fecha: string
  ): Promise<void> {
    const docRef = territorioRef(territorioNum.toString());
    const docSnap = await getDoc(docRef);

    const nuevaAsignacion: Assignment = {
      conductor,
      manzanas,
      fechaAsignacion: fecha,
      estado: "activo",
      turno: "programa",
    };

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        asignaciones: arrayUnion(nuevaAsignacion),
        ultimaModificacion: serverTimestamp(),
      });
    } else {
      const territoryData: Territory = {
        id: territorioNum.toString(),
        numero: territorioNum,
        totalManzanas: MANZANAS_POR_TERRITORIO[territorioNum] || 0,
        asignaciones: [nuevaAsignacion],
        historialAsignaciones: [],
        ultimaModificacion: new Date(),
      };
      await setDoc(docRef, territoryData);
    }
  }

  async returnTerritory(
    territorioNum: number,
    asignacionIndex: number,
    fechaDevolucion: string,
    publicador: string
  ): Promise<void> {
    const docRef = territorioRef(territorioNum.toString());
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Territory not found");

    const terrData = docSnap.data() as Territory;
    const asignacion = terrData.asignaciones[asignacionIndex];

    if (!asignacion) throw new Error("Assignment not found");

    const historialEntry: HistoryAssignment = {
      conductor: publicador,
      conductorOriginal: asignacion.conductor,
      fechaDevolucion,
      manzanas: asignacion.manzanas,
    };

    // Remove active assignment and add to history
    await updateDoc(docRef, {
      asignaciones: arrayRemove(asignacion),
      historialAsignaciones: arrayUnion(historialEntry),
      ultimaModificacion: serverTimestamp(),
    });
  }

  async deleteAssignment(
    territorioNum: number,
    assignment: Assignment | HistoryAssignment,
    isActive: boolean
  ): Promise<void> {
    const docRef = territorioRef(territorioNum.toString());

    if (isActive) {
      await updateDoc(docRef, {
        asignaciones: arrayRemove(assignment),
      });
    } else {
      await updateDoc(docRef, {
        historialAsignaciones: arrayRemove(assignment),
      });
    }
  }

  subscribeToTerritorios(
    callback: (territorios: Record<string, Territory>) => void
  ): () => void {
    const unsubscribe = onSnapshot(territoriosRef(), (snapshot) => {
      const territorios: Record<string, Territory> = {};
      snapshot.forEach((doc) => {
        territorios[doc.id] = { id: doc.id, ...doc.data() } as Territory;
      });
      callback(territorios);
    });

    this.listeners["territorios"] = unsubscribe;
    return unsubscribe;
  }

  // Telephone operations
  async addTelephoneRecord(
    record: Omit<TelephoneRecord, "id">
  ): Promise<string> {
    const docRef = await addDoc(telefonosRef(), {
      ...record,
      creadoEn: serverTimestamp(),
      modificadoEn: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateTelephoneRecord(
    id: string,
    updates: Partial<TelephoneRecord>
  ): Promise<void> {
    await updateDoc(telefonoRef(id), {
      ...updates,
      modificadoEn: serverTimestamp(),
    });
  }

  async deleteTelephoneRecord(id: string): Promise<void> {
    await deleteDoc(telefonoRef(id));
  }

  async bulkUpdateTelephones(
    records: Array<{ id: string; updates: Partial<TelephoneRecord> }>
  ): Promise<void> {
    const batch = writeBatch(db);

    records.forEach(({ id, updates }) => {
      const docRef = telefonoRef(id);
      if (updates.estado === "Testigo") {
        batch.delete(docRef);
      } else {
        batch.update(docRef, {
          ...updates,
          modificadoEn: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  }

  async getEligibleTelephones(maxResults = 50): Promise<TelephoneRecord[]> {
    const now = new Date();
    const q = query(
      telefonosRef(),
      where("suspendido", "!=", true),
      orderBy("creadoEn", "desc"),
      limit(maxResults * 2) // Get more to filter locally
    );

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as TelephoneRecord)
    );

    // Filter out recently exported records
    const eligible = records.filter((record) => {
      if (!record.fechaUltimaLlamada) return true;
      const lastCall =
        record.fechaUltimaLlamada instanceof Timestamp
          ? record.fechaUltimaLlamada.toDate()
          : new Date(record.fechaUltimaLlamada);
      return now.getTime() - lastCall.getTime() > 15 * 24 * 60 * 60 * 1000; // 15 days
    });

    return eligible.slice(0, maxResults);
  }

  subscribeToTelephones(
    callback: (telephones: TelephoneRecord[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(telefonosRef(), (snapshot) => {
      const telephones = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as TelephoneRecord)
      );
      callback(telephones);
    });

    this.listeners["telephones"] = unsubscribe;
    return unsubscribe;
  }

  // Program operations
  async addProgram(
    programa: Omit<ProgramaReunion, "id" | "timestamp">
  ): Promise<string> {
    const docRef = await addDoc(programaRef(), {
      ...programa,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  }

  async deleteProgram(id: string): Promise<void> {
    await deleteDoc(programaDocRef(id));
  }

  subscribeToProgram(
    callback: (programa: ProgramaReunion[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(programaRef(), (snapshot) => {
      const programa = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as ProgramaReunion)
      );
      callback(programa);
    });

    this.listeners["programa"] = unsubscribe;
    return unsubscribe;
  }

  // Places and Facets
  async addLugar(nombre: string): Promise<string> {
    const docRef = await addDoc(lugaresRef(), { nombre });
    return docRef.id;
  }

  async addFaceta(nombre: string): Promise<string> {
    const docRef = await addDoc(facetasRef(), { nombre });
    return docRef.id;
  }

  subscribeToLugares(callback: (lugares: Lugar[]) => void): () => void {
    const unsubscribe = onSnapshot(lugaresRef(), (snapshot) => {
      const lugares = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Lugar)
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(lugares);
    });

    this.listeners["lugares"] = unsubscribe;
    return unsubscribe;
  }

  subscribeToFacetas(callback: (facetas: Faceta[]) => void): () => void {
    const unsubscribe = onSnapshot(facetasRef(), (snapshot) => {
      const facetas = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Faceta)
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(facetas);
    });

    this.listeners["facetas"] = unsubscribe;
    return unsubscribe;
  }

  // Cleanup
  unsubscribeAll(): void {
    Object.values(this.listeners).forEach((unsubscribe) => unsubscribe());
    this.listeners = {};
  }
}

// Export singleton instance
export const firebaseService = FirebaseService.getInstance();
