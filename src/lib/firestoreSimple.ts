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
      const docRef = doc(conductoresRef(), id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(conductoresRef(), id);
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
    }
  },

  // Función simple para inicializar datos por defecto
  async initializeDefaultData() {
    try {
      console.log('🔥 Inicializando datos por defecto en Firebase...');
      
      // Verificar si ya existen conductores
      const conductoresSnapshot = await getDocs(conductoresRef());
      
      if (conductoresSnapshot.empty) {
        console.log('📝 Agregando conductores por defecto...');
        
        const defaultConductores = [
          { 
            nombre: 'Hermano López', 
            disponible: true, 
            activo: true,
            telefono: '+57 300 123 4567',
            email: 'lopez@example.com'
          },
          { 
            nombre: 'Hermano García', 
            disponible: true, 
            activo: true,
            telefono: '+57 301 234 5678',
            email: 'garcia@example.com'
          },
          { 
            nombre: 'Hermano Martín', 
            disponible: false, 
            activo: true,
            telefono: '+57 302 345 6789',
            email: 'martin@example.com'
          }
        ];

        for (const conductor of defaultConductores) {
          await this.conductores.add(conductor as Omit<Conductor, 'id'>);
        }
        
        console.log('✅ Conductores por defecto agregados');
      } else {
        console.log('ℹ️ Los conductores ya existen en Firebase');
      }

      // Verificar territorios
      const territoriosSnapshot = await getDocs(territoriosRef());
      
      if (territoriosSnapshot.empty) {
        console.log('📝 Agregando territorio de ejemplo...');
        
        const territorioEjemplo = {
          numero: 'T-001',
          nombre: 'Territorio Centro',
          descripcion: 'Territorio céntrico con edificios residenciales',
          estado: 'disponible',
          fechaUltimaActualizacion: new Date().toISOString().split('T')[0],
          asignaciones: []
        };

        await addDoc(territoriosRef(), {
          ...territorioEjemplo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Territorio de ejemplo agregado');
      } else {
        console.log('ℹ️ Los territorios ya existen en Firebase');
      }

      return true;
    } catch (error) {
      console.error('❌ Error inicializando datos:', error);
      return false;
    }
  }
};

export default firestoreService;
