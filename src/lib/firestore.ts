import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  db, 
  conductoresRef, 
  territoriosRef, 
  programaRef, 
  lugaresRef, 
  facetasRef, 
  publicadoresRef, 
  telefonosRef 
} from './firebase';
import { 
  Conductor, 
  Territory, 
  Publicador, 
  Lugar, 
  Faceta, 
  ProgramaReunion, 
  TelephoneRecord 
} from '@/types';

// Funciones para Conductores
export const firestoreService = {
  conductores: {
    async getAll(): Promise<Conductor[]> {
      const snapshot = await getDocs(conductoresRef());
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Conductor[];
    },

    async add(conductor: Omit<Conductor, 'id'>): Promise<string> {
      const docRef = await addDoc(conductoresRef(), {
        ...conductor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<Conductor>): Promise<void> {
      const conductoresCollection = conductoresRef();
      const docRef = doc(conductoresCollection, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const conductoresCollection = conductoresRef();
      const docRef = doc(conductoresCollection, id);
      await deleteDoc(docRef);
    }
  },

  territorios: {
    async getAll(): Promise<Territory[]> {
      const snapshot = await getDocs(territoriosRef());
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Territory[];
    },

    async add(territory: Omit<Territory, 'id'>): Promise<string> {
      const docRef = await addDoc(territoriosRef(), {
        ...territory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<Territory>): Promise<void> {
      const territoriosCollection = territoriosRef();
      const docRef = doc(territoriosCollection, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const territoriosCollection = territoriosRef();
      const docRef = doc(territoriosCollection, id);
      await deleteDoc(docRef);
    },

    async getByStatus(estado: string): Promise<Territory[]> {
      const q = query(territoriosRef(), where('estado', '==', estado));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Territory[];
    }
  },

  publicadores: {
    async getAll(): Promise<Publicador[]> {
      const snapshot = await getDocs(publicadoresRef());
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Publicador[];
    },

    async add(publicador: Omit<Publicador, 'id'>): Promise<string> {
      const docRef = await addDoc(publicadoresRef(), {
        ...publicador,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<Publicador>): Promise<void> {
      const docRef = doc(db, publicadoresRef().path, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(db, publicadoresRef().path, id);
      await deleteDoc(docRef);
    },

    async getActive(): Promise<Publicador[]> {
      const q = query(publicadoresRef(), where('activo', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Publicador[];
    }
  },

  programa: {
    async getAll(): Promise<ProgramaReunion[]> {
      const q = query(programaRef(), orderBy('fecha', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProgramaReunion[];
    },

    async add(programa: Omit<ProgramaReunion, 'id'>): Promise<string> {
      const docRef = await addDoc(programaRef(), {
        ...programa,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<ProgramaReunion>): Promise<void> {
      const docRef = doc(db, programaRef().path, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(db, programaRef().path, id);
      await deleteDoc(docRef);
    },

    async getRecent(limit: number = 10): Promise<ProgramaReunion[]> {
      const q = query(programaRef(), orderBy('fecha', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.slice(0, limit).map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ProgramaReunion[];
    }
  },

  lugares: {
    async getAll(): Promise<Lugar[]> {
      const snapshot = await getDocs(lugaresRef());
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Lugar[];
    },

    async add(lugar: Omit<Lugar, 'id'>): Promise<string> {
      const docRef = await addDoc(lugaresRef(), {
        ...lugar,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<Lugar>): Promise<void> {
      const docRef = doc(db, lugaresRef().path, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(db, lugaresRef().path, id);
      await deleteDoc(docRef);
    }
  },

  facetas: {
    async getAll(): Promise<Faceta[]> {
      const snapshot = await getDocs(facetasRef());
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Faceta[];
    },

    async add(faceta: Omit<Faceta, 'id'>): Promise<string> {
      const docRef = await addDoc(facetasRef(), {
        ...faceta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<Faceta>): Promise<void> {
      const docRef = doc(db, facetasRef().path, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(db, facetasRef().path, id);
      await deleteDoc(docRef);
    }
  },

  telefonos: {
    async getAll(): Promise<TelephoneRecord[]> {
      const q = query(telefonosRef(), orderBy('fecha', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TelephoneRecord[];
    },

    async add(telefono: Omit<TelephoneRecord, 'id'>): Promise<string> {
      const docRef = await addDoc(telefonosRef(), {
        ...telefono,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    async update(id: string, updates: Partial<TelephoneRecord>): Promise<void> {
      const docRef = doc(db, telefonosRef().path, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(db, telefonosRef().path, id);
      await deleteDoc(docRef);
    },

    async getByStatus(estado: string): Promise<TelephoneRecord[]> {
      const q = query(telefonosRef(), where('estado', '==', estado));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TelephoneRecord[];
    }
  },

  // Funciones de batch para operaciones múltiples
  async initializeDefaultData() {
    try {
      // Esta función puede usarse para inicializar datos por defecto
      console.log('Inicializando datos por defecto en Firebase...');
      
      // Verificar si ya existen datos
      const conductoresSnapshot = await getDocs(conductoresRef());
      if (conductoresSnapshot.empty) {
        // Agregar conductores por defecto
        const defaultConductores = [
          { nombre: 'Hermano López', disponible: true, activo: true },
          { nombre: 'Hermano García', disponible: true, activo: true },
          { nombre: 'Hermano Martín', disponible: false, activo: true }
        ];

        for (const conductor of defaultConductores) {
          await this.conductores.add(conductor as Omit<Conductor, 'id'>);
        }
        console.log('✅ Conductores por defecto agregados');
      }

      return true;
    } catch (error) {
      console.error('❌ Error inicializando datos:', error);
      return false;
    }
  }
};

export default firestoreService;
