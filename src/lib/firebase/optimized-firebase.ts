// 🔥 FIREBASE OPTIMIZADO CON EXTENSIONES VS CODE 2025
import { FirebaseApp } from "firebase/app";
import {
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
} from "firebase/firestore";
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

/*
🚀 EXTENSIONES QUE MEJORAN FIREBASE DEVELOPMENT:

1. **Firebase Extension** (toba.vsfire):
   - Syntax highlighting para firestore.rules
   - Snippets para Firebase SDK
   - IntelliSense para configuración

2. **Firestore Rules Extension** (ChFlick.firecode):
   - Syntax highlighting para reglas
   - Validación de sintaxis
   - Autocompletado para funciones de seguridad

3. **REST Client / Thunder Client**:
   - Testear endpoints de Firebase Functions
   - Probar autenticación
   - Debug de APIs

4. **Auto Import**:
   - Importa automáticamente módulos de Firebase
   - Sugiere imports correctos
   - Organiza imports por tipo
*/

// 🔧 Configuración de Firebase con tipos mejorados
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// 🚫 ESTE ARCHIVO ESTÁ DESHABILITADO - CAUSA ERRORES DE FIREBASE
// Use src/lib/firebase.ts en su lugar, que respeta la configuración offline

console.error(
  "🚫 optimized-firebase.ts is DEPRECATED and causes Firebase errors"
);
console.log(
  "💡 Use src/lib/firebase.ts instead - it respects offline configuration"
);

// Importar la configuración correcta que respeta el modo offline
import {
  app as mainApp,
  db as mainDb,
  auth as mainAuth,
  isFirebaseEnabled,
} from "../firebase";

// 🔥 Clase Firebase deshabilitada - redirige a firebase.ts principal
class FirebaseService {
  private static instance: FirebaseService;
  private app: FirebaseApp | null;
  private db: Firestore | null;
  private auth: Auth | null;

  private constructor() {
    // Usar la configuración principal que respeta offline mode
    this.app = mainApp;
    this.db = mainDb;
    this.auth = mainAuth;

    if (!isFirebaseEnabled) {
      console.warn(
        "🔒 Firebase disabled in offline mode - optimized-firebase redirecting to main config"
      );
    }
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public getFirestore(): Firestore | null {
    if (!isFirebaseEnabled) {
      console.warn("🔒 Firestore not available in offline mode");
      return null;
    }
    return this.db;
  }

  public getAuth(): Auth | null {
    if (!isFirebaseEnabled) {
      console.warn("🔒 Auth not available in offline mode");
      return null;
    }
    return this.auth;
  }

  public getApp(): FirebaseApp | null {
    if (!isFirebaseEnabled) {
      console.warn("🔒 Firebase app not available in offline mode");
      return null;
    }
    return this.app;
  }
}

// 🎯 Interfaces para tu proyecto específico
interface Conductor {
  id?: string;
  nombre: string;
  email: string;
  telefono: string;
  territorioAsignado?: string;
  tarjetasAsignadas: string[];
  fechaCreacion: Date;
  ultimaActualizacion: Date;
  activo: boolean;
}

interface Territorio {
  id?: string;
  nombre: string;
  descripcion: string;
  conductorAsignado?: string;
  tarjetas: string[];
  coordenadas?: {
    lat: number;
    lng: number;
  };
  fechaCreacion: Date;
  activo: boolean;
}

interface TarjetaTelefono {
  id?: string;
  numero: string;
  territorio?: string;
  conductor?: string;
  estado: "disponible" | "asignada" | "completada" | "no_contactar";
  fechaUltimaLlamada?: Date;
  notas?: string;
  intentosLlamada: number;
}

// 🚀 Clase de servicio optimizada para Conductores
class ConductorService {
  private firebase: FirebaseService;
  private db: Firestore;

  constructor() {
    this.firebase = FirebaseService.getInstance();
    this.db = this.firebase.getFirestore();
  }

  // ✅ Crear conductor con validación
  async createConductor(
    conductor: Omit<Conductor, "id" | "fechaCreacion" | "ultimaActualizacion">
  ): Promise<string> {
    try {
      const conductorData: Omit<Conductor, "id"> = {
        ...conductor,
        fechaCreacion: new Date(),
        ultimaActualizacion: new Date(),
      };

      const docRef = await addDoc(
        collection(this.db, "conductores"),
        conductorData
      );
      return docRef.id;
    } catch (error) {
      console.error("Error creating conductor:", error);
      throw new Error("Failed to create conductor");
    }
  }

  // 📖 Obtener conductor por ID
  async getConductorById(id: string): Promise<Conductor | null> {
    try {
      const docSnap: DocumentSnapshot<DocumentData> = await getDoc(
        doc(this.db, "conductores", id)
      );

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Conductor;
      }

      return null;
    } catch (error) {
      console.error("Error getting conductor:", error);
      throw new Error("Failed to get conductor");
    }
  }

  // 📝 Actualizar conductor
  async updateConductor(
    id: string,
    updates: Partial<Conductor>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        ultimaActualizacion: new Date(),
      };

      await updateDoc(doc(this.db, "conductores", id), updateData);
    } catch (error) {
      console.error("Error updating conductor:", error);
      throw new Error("Failed to update conductor");
    }
  }

  // 🗑️ Eliminar conductor (soft delete)
  async deleteConductor(id: string): Promise<void> {
    try {
      await updateDoc(doc(this.db, "conductores", id), {
        activo: false,
        ultimaActualizacion: new Date(),
      });
    } catch (error) {
      console.error("Error deleting conductor:", error);
      throw new Error("Failed to delete conductor");
    }
  }

  // 📋 Obtener todos los conductores activos
  async getActiveConductores(): Promise<Conductor[]> {
    try {
      const q = query(
        collection(this.db, "conductores"),
        where("activo", "==", true),
        orderBy("nombre", "asc")
      );

      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Conductor[];
    } catch (error) {
      console.error("Error getting conductores:", error);
      throw new Error("Failed to get conductores");
    }
  }

  // 🔄 Escuchar cambios en tiempo real
  onConductoresChange(
    callback: (conductores: Conductor[]) => void
  ): () => void {
    const q = query(
      collection(this.db, "conductores"),
      where("activo", "==", true),
      orderBy("ultimaActualizacion", "desc")
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const conductores = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Conductor[];

        callback(conductores);
      },
      (error) => {
        console.error("Error listening to conductores changes:", error);
      }
    );
  }
}

// 🗺️ Clase de servicio para Territorios
class TerritorioService {
  private firebase: FirebaseService;
  private db: Firestore;

  constructor() {
    this.firebase = FirebaseService.getInstance();
    this.db = this.firebase.getFirestore();
  }

  async createTerritorio(
    territorio: Omit<Territorio, "id" | "fechaCreacion">
  ): Promise<string> {
    try {
      const territorioData: Omit<Territorio, "id"> = {
        ...territorio,
        fechaCreacion: new Date(),
      };

      const docRef = await addDoc(
        collection(this.db, "territorios"),
        territorioData
      );
      return docRef.id;
    } catch (error) {
      console.error("Error creating territorio:", error);
      throw new Error("Failed to create territorio");
    }
  }

  async assignConductorToTerritorio(
    territorioId: string,
    conductorId: string
  ): Promise<void> {
    try {
      // Actualizar territorio
      await updateDoc(doc(this.db, "territorios", territorioId), {
        conductorAsignado: conductorId,
      });

      // Actualizar conductor
      await updateDoc(doc(this.db, "conductores", conductorId), {
        territorioAsignado: territorioId,
        ultimaActualizacion: new Date(),
      });
    } catch (error) {
      console.error("Error assigning conductor to territorio:", error);
      throw new Error("Failed to assign conductor");
    }
  }
}

// 📞 Clase de servicio para Tarjetas de Teléfono
class TarjetaService {
  private firebase: FirebaseService;
  private db: Firestore;

  constructor() {
    this.firebase = FirebaseService.getInstance();
    this.db = this.firebase.getFirestore();
  }

  async getTarjetasByTerritorio(
    territorioId: string
  ): Promise<TarjetaTelefono[]> {
    try {
      const q = query(
        collection(this.db, "tarjetas"),
        where("territorio", "==", territorioId),
        orderBy("numero", "asc")
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TarjetaTelefono[];
    } catch (error) {
      console.error("Error getting tarjetas:", error);
      throw new Error("Failed to get tarjetas");
    }
  }

  async updateTarjetaEstado(
    tarjetaId: string,
    estado: TarjetaTelefono["estado"],
    notas?: string
  ): Promise<void> {
    try {
      const updateData: Partial<TarjetaTelefono> = {
        estado,
        fechaUltimaLlamada: new Date(),
        intentosLlamada: estado === "completada" ? 0 : undefined,
      };

      if (notas) {
        updateData.notas = notas;
      }

      await updateDoc(doc(this.db, "tarjetas", tarjetaId), updateData);
    } catch (error) {
      console.error("Error updating tarjeta estado:", error);
      throw new Error("Failed to update tarjeta");
    }
  }
}

// 🔐 Clase de servicio de autenticación
class AuthService {
  private auth: Auth;

  constructor() {
    this.auth = FirebaseService.getInstance().getAuth();
  }

  async login(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return userCredential.user;
    } catch (error) {
      console.error("Error logging in:", error);
      throw new Error("Failed to login");
    }
  }

  async register(email: string, password: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return userCredential.user;
    } catch (error) {
      console.error("Error registering:", error);
      throw new Error("Failed to register");
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error("Error logging out:", error);
      throw new Error("Failed to logout");
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(this.auth, callback);
  }
}

// 🚀 Exportar servicios optimizados
export const conductorService = new ConductorService();
export const territorioService = new TerritorioService();
export const tarjetaService = new TarjetaService();
export const authService = new AuthService();

// Exportar tipos para uso en componentes
export type { Conductor, Territorio, TarjetaTelefono };

/*
🔥 FIRESTORE RULES OPTIMIZADAS (firestore.rules):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Reglas para conductores
    match /conductores/{conductorId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.token.admin == true);
    }
    
    // Reglas para territorios
    match /territorios/{territorioId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Reglas para tarjetas
    match /tarjetas/{tarjetaId} {
      allow read, update: if request.auth != null &&
        (request.auth.uid == resource.data.conductorAsignado ||
         request.auth.token.admin == true);
      allow create, delete: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}

🎯 TIPS PARA USAR LAS EXTENSIONES:

1. **Firebase Extension**:
   - Usa Ctrl+Space en archivos .rules para autocompletado
   - Syntax highlighting automático

2. **Thunder Client**:
   - Crea requests para testear Firebase Functions
   - Guarda colecciones de requests para tu API

3. **Auto Import**:
   - Automáticamente sugiere imports de Firebase
   - Organiza imports por módulos
*/
