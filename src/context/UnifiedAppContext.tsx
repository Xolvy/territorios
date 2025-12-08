"use client";
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import {
  AppState,
  Territory,
  Block,
  Address,
  PhoneNumber,
  AppUser,
  Assignment,
  Conductor,
  CreateTerritoryRequest,
  CreateBlockRequest,
  CreateAddressRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateAssignmentRequest,
  TelephoneBulkImport,
  UserRole,
  Permission,
  hasPermission,
  isSuperAdmin,
  AppSettings,
  SystemEvent,
  AppStats,
} from "@/types/unified";
import { logger } from "@/utils/logger";
import {
  auth,
  db,
  safeOnAuthStateChanged as firebaseOnAuthStateChanged,
  safeSignInWithEmailAndPassword as signInWithEmailAndPassword,
  safeSignOut,
  FirebaseUser,
} from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  Timestamp,
  getDocs,
} from "firebase/firestore";

// ===== TIPOS DE ACCIONES =====
type AppAction =
  // Auth
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_USER"; payload: FirebaseUser | null }
  | { type: "SET_APP_USER"; payload: AppUser | null }
  | { type: "SET_AUTHENTICATED"; payload: boolean }

  // Territories
  | { type: "SET_TERRITORIES"; payload: Record<string, Territory> }
  | { type: "ADD_TERRITORY"; payload: Territory }
  | { type: "UPDATE_TERRITORY"; payload: Territory }
  | { type: "DELETE_TERRITORY"; payload: string }

  // Blocks
  | { type: "SET_BLOCKS"; payload: Record<string, Block> }
  | { type: "ADD_BLOCK"; payload: Block }
  | { type: "UPDATE_BLOCK"; payload: Block }
  | { type: "DELETE_BLOCK"; payload: string }

  // Addresses
  | { type: "SET_ADDRESSES"; payload: Record<string, Address> }
  | { type: "ADD_ADDRESS"; payload: Address }
  | { type: "UPDATE_ADDRESS"; payload: Address }
  | { type: "DELETE_ADDRESS"; payload: string }

  // Phone Numbers
  | { type: "SET_PHONES"; payload: Record<string, PhoneNumber> }
  | { type: "ADD_PHONE"; payload: PhoneNumber }
  | { type: "UPDATE_PHONE"; payload: PhoneNumber }
  | { type: "DELETE_PHONE"; payload: string }
  | { type: "BULK_UPDATE_PHONES"; payload: PhoneNumber[] }

  // Users
  | { type: "SET_USERS"; payload: Record<string, AppUser> }
  | { type: "ADD_APP_USER"; payload: AppUser }
  | { type: "UPDATE_APP_USER"; payload: AppUser }
  | { type: "DELETE_APP_USER"; payload: string }

  // Conductores
  | { type: "SET_CONDUCTORES"; payload: Record<string, Conductor> }
  | { type: "ADD_CONDUCTOR"; payload: Conductor }
  | { type: "UPDATE_CONDUCTOR"; payload: Conductor }
  | { type: "DELETE_CONDUCTOR"; payload: string }

  // Assignments
  | { type: "SET_ASSIGNMENTS"; payload: Record<string, Assignment> }
  | { type: "ADD_ASSIGNMENT"; payload: Assignment }
  | { type: "UPDATE_ASSIGNMENT"; payload: Assignment }
  | { type: "DELETE_ASSIGNMENT"; payload: string }

  // UI State
  | { type: "SET_SELECTED_TERRITORY"; payload: string | undefined }
  | { type: "SET_SELECTED_BLOCK"; payload: string | undefined }
  | { type: "SET_SETTINGS"; payload: AppSettings }

  // Error handling
  | { type: "SET_ERROR"; payload: string | null };

// ===== ESTADO INICIAL =====
const initialState: AppState = {
  territories: {},
  blocks: {},
  addresses: {},
  phoneNumbers: {},
  conductores: {},
  users: {
    "conductor-001": {
      uid: "conductor-001",
      phoneNumber: "0998765432",
      email: "juan.perez@ejemplo.com",
      displayName: "Juan Pérez",
      role: "conductor",
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date(),
      createdBy: "admin",
      fullName: "Juan Pérez González",
      notes: "Conductor experimentado",
      linkedProviders: ["phone"],
      lastLogin: new Date(),
      loginCount: 15,
    },
    "conductor-002": {
      uid: "conductor-002",
      phoneNumber: "0997654321",
      email: "maria.garcia@ejemplo.com",
      displayName: "María García",
      role: "conductor",
      isActive: true,
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date(),
      createdBy: "admin",
      fullName: "María García López",
      notes: "Nueva conductora",
      linkedProviders: ["phone"],
      lastLogin: new Date(),
      loginCount: 8,
    },
    "conductor-003": {
      uid: "conductor-003",
      phoneNumber: "0996543210",
      email: "carlos.martinez@ejemplo.com",
      displayName: "Carlos Martínez",
      role: "conductor",
      isActive: true,
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date(),
      createdBy: "admin",
      fullName: "Carlos Martínez Silva",
      notes: "Conductor regular",
      linkedProviders: ["phone"],
      lastLogin: new Date(),
      loginCount: 22,
    },
  },
  programa: {},
  lugares: {},
  facetas: {},
  assignments: {},
  assignmentHistory: {},
  telephoneSessions: {},
  bulkOperations: {},
  isLoading: true,
  isAuthenticated: false,
  currentUser: undefined,
  selectedTerritory: undefined,
  selectedBlock: undefined,
  settings: {
    territorySettings: {
      autoAssignExpiration: true,
      defaultExpirationDays: 90,
      maxBlocksPerAssignment: 5,
      requireApprovalForReassignment: false,
    },
    phoneSettings: {
      autoGenerateFromAddresses: true,
      blockPhoneAfterMonths: 6,
      autoSuspendAfterAttempts: 3,
      requireNotesForStatus: false,
    },
    userSettings: {
      requirePhoneVerification: true,
      autoActivateNewUsers: false,
      defaultRole: "conductor",
      sessionTimeoutMinutes: 60,
    },
    appSettings: {
      offlineMode: false,
      autoBackup: true,
      backupIntervalDays: 7,
      dataRetentionMonths: 24,
      theme: "light",
      language: "es",
    },
  },
};

// ===== REDUCER HELPERS =====
// ✅ OPTIMIZACIÓN: Helper functions para eliminar código duplicado
const createEntityHandlers = <T extends { id: string } | { uid: string }>(
  stateKey: keyof AppState,
  getKey: (entity: T) => string = (entity) =>
    "id" in entity ? entity.id : (entity as any).uid
) => ({
  set: (state: AppState, payload: Record<string, T>) => ({
    ...state,
    [stateKey]: payload,
  }),
  add: (state: AppState, entity: T) => ({
    ...state,
    [stateKey]: {
      ...(state[stateKey] as unknown as Record<string, T>),
      [getKey(entity)]: entity,
    },
  }),
  update: (state: AppState, entity: T) => ({
    ...state,
    [stateKey]: {
      ...(state[stateKey] as unknown as Record<string, T>),
      [getKey(entity)]: entity,
    },
  }),
  delete: (state: AppState, entityId: string) => {
    const { [entityId]: deleted, ...remaining } = state[
      stateKey
    ] as unknown as Record<string, T>;
    return {
      ...state,
      [stateKey]: remaining,
    };
  },
});

// ===== ENTITY HANDLERS =====
const territoryHandlers = createEntityHandlers<Territory>("territories");
const blockHandlers = createEntityHandlers<Block>("blocks");
const addressHandlers = createEntityHandlers<Address>("addresses");
const phoneHandlers = createEntityHandlers<PhoneNumber>("phoneNumbers");
const userHandlers = createEntityHandlers<AppUser>("users", (user) => user.uid);
const conductorHandlers = createEntityHandlers<Conductor>("conductores");
const assignmentHandlers = createEntityHandlers<Assignment>("assignments");

// ===== REDUCER =====
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_AUTHENTICATED":
      return { ...state, isAuthenticated: action.payload };

    case "SET_APP_USER":
      return { ...state, currentUser: action.payload || undefined };

    // Territories - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_TERRITORIES":
      return territoryHandlers.set(state, action.payload);
    case "ADD_TERRITORY":
      return territoryHandlers.add(state, action.payload);
    case "UPDATE_TERRITORY":
      return territoryHandlers.update(state, action.payload);
    case "DELETE_TERRITORY":
      return territoryHandlers.delete(state, action.payload);

    // Blocks - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_BLOCKS":
      return blockHandlers.set(state, action.payload);
    case "ADD_BLOCK":
      return blockHandlers.add(state, action.payload);
    case "UPDATE_BLOCK":
      return blockHandlers.update(state, action.payload);
    case "DELETE_BLOCK":
      return blockHandlers.delete(state, action.payload);

    // Addresses - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_ADDRESSES":
      return addressHandlers.set(state, action.payload);
    case "ADD_ADDRESS":
      return addressHandlers.add(state, action.payload);
    case "UPDATE_ADDRESS":
      return addressHandlers.update(state, action.payload);
    case "DELETE_ADDRESS":
      return addressHandlers.delete(state, action.payload);

    // Phone Numbers - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_PHONES":
      return phoneHandlers.set(state, action.payload);
    case "ADD_PHONE":
      return phoneHandlers.add(state, action.payload);
    case "UPDATE_PHONE":
      return phoneHandlers.update(state, action.payload);
    case "DELETE_PHONE":
      return phoneHandlers.delete(state, action.payload);
    case "BULK_UPDATE_PHONES":
      const phoneUpdates = action.payload.reduce((acc, phone) => {
        acc[phone.id] = phone;
        return acc;
      }, {} as Record<string, PhoneNumber>);
      return {
        ...state,
        phoneNumbers: { ...state.phoneNumbers, ...phoneUpdates },
      };

    // Users - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_USERS":
      return userHandlers.set(state, action.payload);
    case "ADD_APP_USER":
      return userHandlers.add(state, action.payload);
    case "UPDATE_APP_USER":
      return userHandlers.update(state, action.payload);
    case "DELETE_APP_USER":
      return userHandlers.delete(state, action.payload);

    // Conductores - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_CONDUCTORES":
      return conductorHandlers.set(state, action.payload);
    case "ADD_CONDUCTOR":
      return conductorHandlers.add(state, action.payload);
    case "UPDATE_CONDUCTOR":
      return conductorHandlers.update(state, action.payload);
    case "DELETE_CONDUCTOR":
      return conductorHandlers.delete(state, action.payload);

    // Assignments - ✅ OPTIMIZADO: Usa handlers reutilizables
    case "SET_ASSIGNMENTS":
      return assignmentHandlers.set(state, action.payload);
    case "ADD_ASSIGNMENT":
      return assignmentHandlers.add(state, action.payload);
    case "UPDATE_ASSIGNMENT":
      return assignmentHandlers.update(state, action.payload);
    case "DELETE_ASSIGNMENT":
      return assignmentHandlers.delete(state, action.payload);

    // UI State
    case "SET_SELECTED_TERRITORY":
      return { ...state, selectedTerritory: action.payload };
    case "SET_SELECTED_BLOCK":
      return { ...state, selectedBlock: action.payload };
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };

    default:
      return state;
  }
}

// ===== CONTEXTO =====
interface AppContextValue {
  // Estado
  state: AppState;

  // Auth
  signInWithPhone: (phoneNumber: string) => Promise<any>;
  verifyCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInAsSuperAdmin: (phoneNumber: string, password: string) => Promise<void>;
  signInAsConductor: (conductorUid: string) => Promise<void>;
  checkUserPermission: (permission: Permission) => boolean;

  // Territories
  createTerritory: (data: CreateTerritoryRequest) => Promise<string>;
  updateTerritory: (id: string, data: Partial<Territory>) => Promise<void>;
  deleteTerritory: (id: string) => Promise<void>;

  // Blocks
  createBlock: (data: CreateBlockRequest) => Promise<string>;
  updateBlock: (id: string, data: Partial<Block>) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;

  // Addresses
  createAddress: (data: CreateAddressRequest) => Promise<string>;
  updateAddress: (id: string, data: Partial<Address>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;

  // Phone Numbers
  createPhone: (data: Partial<PhoneNumber>) => Promise<string>;
  updatePhone: (id: string, data: Partial<PhoneNumber>) => Promise<void>;
  deletePhone: (id: string) => Promise<void>;
  bulkImportPhones: (phones: TelephoneBulkImport[]) => Promise<void>;

  // Users
  createUser: (data: CreateUserRequest) => Promise<string>;
  updateUser: (data: UpdateUserRequest) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  promoteUser: (uid: string, newRole: UserRole) => Promise<void>;
  updateUserCredentials: (
    uid: string,
    credentials: { phoneNumber?: string; email?: string; password?: string }
  ) => Promise<void>;

  // Assignments
  createAssignment: (data: CreateAssignmentRequest) => Promise<string>;
  updateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  returnAssignment: (id: string, reason?: string) => Promise<void>;

  // Statistics
  getStats: () => AppStats;

  // Utilities
  refreshData: () => Promise<void>;
  exportData: (type: string) => Promise<any>;
  logSystemEvent: (
    event: Omit<SystemEvent, "id" | "timestamp">
  ) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ===== PROVIDER =====
interface AppProviderProps {
  children: ReactNode;
}

export function UnifiedAppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Auth state listener with comprehensive safety checks
  useEffect(() => {
    // Function to safely set offline mode
    const setOfflineMode = (reason: string) => {
      dispatch({ type: "SET_LOADING", payload: false });
      dispatch({ type: "SET_AUTHENTICATED", payload: false });
      dispatch({ type: "SET_APP_USER", payload: null });
      logger.log(`🔒 Running in offline mode - ${reason}`);
    };

    // Comprehensive auth availability check
    if (
      !auth ||
      auth === null ||
      auth === undefined ||
      typeof auth !== "object"
    ) {
      setOfflineMode("Firebase auth not available");
      return;
    }

    // Verify firebaseOnAuthStateChanged function exists
    if (typeof firebaseOnAuthStateChanged !== "function") {
      setOfflineMode("onAuthStateChanged function not available");
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      // Use safe auth state changed function
      unsubscribe = firebaseOnAuthStateChanged(async (user) => {
        dispatch({ type: "SET_LOADING", payload: true });

        if (user) {
          try {
            // Get app user data
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let appUser: AppUser | null = null;

            if (userDoc.exists()) {
              const userData = userDoc.data();
              appUser = {
                uid: user.uid,
                phoneNumber: user.phoneNumber || userData.phoneNumber,
                email: user.email || userData.email,
                displayName: user.displayName || userData.displayName,
                photoURL: user.photoURL || userData.photoURL,
                role: userData.role || "conductor",
                isActive: userData.isActive ?? true,
                createdAt: userData.createdAt?.toDate() || new Date(),
                updatedAt: userData.updatedAt?.toDate() || new Date(),
                createdBy: userData.createdBy || "",
                fullName: userData.fullName || "",
                notes: userData.notes,
                linkedProviders: userData.linkedProviders || [],
                lastLogin: new Date(),
                loginCount: (userData.loginCount || 0) + 1,
              };

              // Check if super admin
              if (
                appUser &&
                isSuperAdmin(
                  user.phoneNumber || undefined,
                  user.uid,
                  user.email || undefined
                )
              ) {
                appUser.role = "super-admin";
                await updateDoc(doc(db, "users", user.uid), {
                  role: "super-admin",
                  lastLogin: Timestamp.now(),
                  loginCount: appUser.loginCount,
                });
              }
            }

            dispatch({ type: "SET_APP_USER", payload: appUser });
            dispatch({ type: "SET_AUTHENTICATED", payload: true });
          } catch (error) {
            console.error("Error loading user data:", error);
            dispatch({ type: "SET_AUTHENTICATED", payload: false });
          }
        } else {
          dispatch({ type: "SET_APP_USER", payload: null });
          dispatch({ type: "SET_AUTHENTICATED", payload: false });
        }

        dispatch({ type: "SET_LOADING", payload: false });
      });
    } catch (authError) {
      console.error("Error setting up auth listener:", authError);

      // Check if the error is specifically about null auth object
      if (
        authError instanceof Error &&
        (authError.message.includes("null") ||
          authError.message.includes("undefined") ||
          authError.message.includes("onAuthStateChanged"))
      ) {
        setOfflineMode("Auth initialization failed - null object detected");
      } else {
        setOfflineMode("Auth listener setup failed");
      }
    }

    return unsubscribe || (() => {});
  }, []);

  // Data listeners
  useEffect(() => {
    if (!state.isAuthenticated) return;

    // Territories listener
    const territoriesUnsubscribe = onSnapshot(
      collection(db, "territories"),
      (snapshot) => {
        const territories: Record<string, Territory> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          territories[doc.id] = {
            id: doc.id,
            ...data,
            ultimaModificacion: data.ultimaModificacion?.toDate(),
          } as Territory;
        });
        dispatch({ type: "SET_TERRITORIES", payload: territories });
      }
    );

    // Blocks listener
    const blocksUnsubscribe = onSnapshot(
      collection(db, "blocks"),
      (snapshot) => {
        const blocks: Record<string, Block> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          blocks[doc.id] = {
            id: doc.id,
            ...data,
            fechaUltimaVisita: data.fechaUltimaVisita?.toDate(),
          } as Block;
        });
        dispatch({ type: "SET_BLOCKS", payload: blocks });
      }
    );

    // Phone numbers listener
    const phonesUnsubscribe = onSnapshot(
      collection(db, "phoneNumbers"),
      (snapshot) => {
        const phones: Record<string, PhoneNumber> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          phones[doc.id] = {
            id: doc.id,
            ...data,
            fechaUltimaLlamada: data.fechaUltimaLlamada?.toDate(),
            fechaBloqueo: data.fechaBloqueo?.toDate(),
            fechaRevisita: data.fechaRevisita?.toDate(),
            creadoEn: data.creadoEn?.toDate(),
            modificadoEn: data.modificadoEn?.toDate(),
          } as PhoneNumber;
        });
        dispatch({ type: "SET_PHONES", payload: phones });
      }
    );

    // Users listener (admin only)
    let usersUnsubscribe: (() => void) | undefined;
    if (
      state.currentUser &&
      hasPermission(state.currentUser.role, "users.read")
    ) {
      usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const users: Record<string, AppUser> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          users[doc.id] = {
            uid: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastLogin: data.lastLogin?.toDate(),
          } as AppUser;
        });
        dispatch({ type: "SET_USERS", payload: users });
      });
    }

    // Assignments listener
    const assignmentsUnsubscribe = onSnapshot(
      collection(db, "assignments"),
      (snapshot) => {
        const assignments: Record<string, Assignment> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          assignments[doc.id] = {
            id: doc.id,
            ...data,
            fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
            fechaVencimiento: data.fechaVencimiento?.toDate(),
          } as Assignment;
        });
        dispatch({ type: "SET_ASSIGNMENTS", payload: assignments });
      }
    );

    return () => {
      territoriesUnsubscribe();
      blocksUnsubscribe();
      phonesUnsubscribe();
      assignmentsUnsubscribe();
      if (usersUnsubscribe) usersUnsubscribe();
    };
  }, [state.isAuthenticated, state.currentUser?.role]);

  // ===== AUTH FUNCTIONS =====
  const signInWithPhone = async (phoneNumber: string) => {
    // En modo offline, las funciones Firebase están bloqueadas
    console.warn("⚠️ Phone authentication disabled in offline mode");
    throw new Error("Phone authentication not available in offline mode");
  };

  const verifyCode = async (code: string) => {
    // This would be handled by the confirmation result from signInWithPhone
  };

  const signOut = async () => {
    await safeSignOut();
  };

  const checkUserPermission = (permission: Permission): boolean => {
    if (!state.currentUser) return false;
    return hasPermission(state.currentUser.role, permission);
  };

  const signInAsSuperAdmin = async (phoneNumber: string, password: string) => {
    // Verificar credenciales de super admin
    if (phoneNumber === "0994749286" && password === "Sonita.09") {
      try {
        // Autenticar con Firebase Auth usando el email real del usuario
        const email = "italo.fm0@gmail.com";
        const firebasePassword = "Territorios";

        const userCredential = await signInWithEmailAndPassword(
          email,
          firebasePassword
        );
        const firebaseUser = userCredential.user;

        // Buscar el perfil del usuario en Firestore
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        let appUser: AppUser;

        if (userDoc.exists()) {
          // Usuario ya existe, obtener datos actualizados
          const userData = userDoc.data();
          appUser = {
            uid: firebaseUser.uid,
            phoneNumber:
              firebaseUser.phoneNumber ||
              userData.phoneNumber ||
              "+593" + phoneNumber,
            email: firebaseUser.email || userData.email,
            displayName:
              firebaseUser.displayName ||
              userData.displayName ||
              "Super Administrador",
            photoURL: firebaseUser.photoURL || userData.photoURL,
            role: "super-admin", // Asegurar rol de super-admin
            isActive: userData.isActive ?? true,
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: new Date(),
            createdBy: userData.createdBy || "system",
            fullName: userData.fullName || "Super Administrador",
            notes: userData.notes || "Usuario super administrador del sistema",
            linkedProviders: userData.linkedProviders || ["email"],
            lastLogin: new Date(),
            loginCount: (userData.loginCount || 0) + 1,
          };

          // Actualizar último login y asegurar rol de super-admin
          await updateDoc(doc(db, "users", firebaseUser.uid), {
            role: "super-admin",
            lastLogin: Timestamp.now(),
            loginCount: appUser.loginCount,
            updatedAt: Timestamp.now(),
          });
        } else {
          // Usuario no existe, crear nuevo perfil
          const uid = await createUser({
            phoneNumber: "+593" + phoneNumber,
            fullName: "Super Administrador",
            role: "super-admin",
            notes: "Usuario super administrador del sistema",
          });

          // Obtener el usuario recién creado
          const newUserDoc = await getDoc(doc(db, "users", uid));
          if (newUserDoc.exists()) {
            const userData = newUserDoc.data();
            appUser = {
              uid: uid,
              ...userData,
              lastLogin: new Date(),
              loginCount: 1,
            } as AppUser;
          } else {
            throw new Error("Error creando perfil de usuario");
          }
        }

        dispatch({ type: "SET_USER", payload: firebaseUser });
        dispatch({ type: "SET_APP_USER", payload: appUser });
        dispatch({ type: "SET_AUTHENTICATED", payload: true });
      } catch (error: any) {
        console.error("Error autenticando super admin:", error);
        throw new Error("Error de autenticación. Verifique las credenciales.");
      }
    } else {
      throw new Error("Credenciales incorrectas");
    }
  };

  const signInAsConductor = async (conductorUid: string) => {
    // Buscar el conductor en la lista de usuarios
    const conductor = state.users[conductorUid];

    if (!conductor || conductor.role !== "conductor" || !conductor.isActive) {
      throw new Error("Conductor no encontrado o inactivo");
    }

    dispatch({ type: "SET_APP_USER", payload: conductor });
    dispatch({ type: "SET_AUTHENTICATED", payload: true });
    
    // Log successful conductor login
    await logSystemEvent({
      type: "user_action",
      entity: "user",
      action: "conductor_login",
      userId: conductor.uid,
      entityId: conductor.uid,
      data: {
        conductorName: conductor.displayName || conductor.fullName,
        loginMethod: "conductor_selection"
      }
    });
  };

  // ===== TERRITORY FUNCTIONS =====
  const createTerritory = async (
    data: CreateTerritoryRequest
  ): Promise<string> => {
    const id = crypto.randomUUID();
    const territory: Territory = {
      id,
      numero: data.numero,
      totalManzanas: 0,
      manzanas: [],
      asignaciones: [],
      historialAsignaciones: [],
      ultimaModificacion: new Date(),
      activo: true,
      descripcion: data.descripcion,
      coordenadas: data.coordenadas,
      limites: data.limites,
    };

    await setDoc(doc(db, "territories", id), {
      ...territory,
      ultimaModificacion: Timestamp.now(),
    });

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "create",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });

    return id;
  };

  const updateTerritory = async (id: string, data: Partial<Territory>) => {
    await updateDoc(doc(db, "territories", id), {
      ...data,
      ultimaModificacion: Timestamp.now(),
    });

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "update",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });
  };

  const deleteTerritory = async (id: string) => {
    // Delete all blocks in territory first
    const blocksQuery = query(
      collection(db, "blocks"),
      where("territoryId", "==", id)
    );
    const blocksSnapshot = await getDocs(blocksQuery);

    const batch = writeBatch(db);
    blocksSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete territory
    batch.delete(doc(db, "territories", id));

    await batch.commit();

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "delete",
      userId: state.currentUser?.uid,
      entityId: id,
    });
  };

  // ===== BLOCK FUNCTIONS =====
  const createBlock = async (data: CreateBlockRequest): Promise<string> => {
    const id = crypto.randomUUID();
    const block: Block = {
      id,
      numero: data.numero,
      territoryId: data.territoryId,
      direcciones: [],
      estado: "pendiente",
      activo: true,
      notas: data.notas,
    };

    await setDoc(doc(db, "blocks", id), block);

    // Update territory block count
    const territory = state.territories[data.territoryId];
    if (territory) {
      await updateDoc(doc(db, "territories", data.territoryId), {
        totalManzanas: territory.totalManzanas + 1,
        ultimaModificacion: Timestamp.now(),
      });
    }

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "add_block",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });

    return id;
  };

  const updateBlock = async (id: string, data: Partial<Block>) => {
    await updateDoc(doc(db, "blocks", id), data);

    await logSystemEvent({
      type: "user_action",
      entity: "block",
      action: "update",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });
  };

  const deleteBlock = async (id: string) => {
    const block = state.blocks[id];
    if (!block) return;

    // Delete all addresses in block first
    const addressesQuery = query(
      collection(db, "addresses"),
      where("blockId", "==", id)
    );
    const addressesSnapshot = await getDocs(addressesQuery);

    const batch = writeBatch(db);
    addressesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete block
    batch.delete(doc(db, "blocks", id));

    await batch.commit();

    // Update territory block count
    const territory = state.territories[block.territoryId];
    if (territory) {
      await updateDoc(doc(db, "territories", block.territoryId), {
        totalManzanas: Math.max(0, territory.totalManzanas - 1),
        ultimaModificacion: Timestamp.now(),
      });
    }

    await logSystemEvent({
      type: "user_action",
      entity: "block",
      action: "delete",
      userId: state.currentUser?.uid,
      entityId: id,
    });
  };

  // ===== ADDRESS FUNCTIONS =====
  const createAddress = async (data: CreateAddressRequest): Promise<string> => {
    const id = crypto.randomUUID();
    const address: Address = {
      id,
      blockId: data.blockId,
      direccion: data.direccion,
      coordenadas: data.coordenadas,
      telefonos: [],
      estado: "no_visitado",
      activo: true,
      notas: data.notas,
    };

    await setDoc(doc(db, "addresses", id), address);

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "add_address",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });

    return id;
  };

  const updateAddress = async (id: string, data: Partial<Address>) => {
    await updateDoc(doc(db, "addresses", id), data);

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "update_address",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });
  };

  const deleteAddress = async (id: string) => {
    await deleteDoc(doc(db, "addresses", id));

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "delete_address",
      userId: state.currentUser?.uid,
      entityId: id,
    });
  };

  // ===== PHONE FUNCTIONS =====
  const createPhone = async (data: Partial<PhoneNumber>): Promise<string> => {
    const id = crypto.randomUUID();
    const phone: PhoneNumber = {
      id,
      addressId: data.addressId,
      nombre: data.nombre || "",
      telefono: data.telefono || "",
      direccion: data.direccion || "",
      publicador: data.publicador,
      estado: data.estado || "",
      comentarios: data.comentarios,
      fechaUltimaLlamada: data.fechaUltimaLlamada,
      fechaBloqueo: data.fechaBloqueo,
      fechaRevisita: data.fechaRevisita,
      suspendido: data.suspendido || false,
      creadoEn: new Date(),
      modificadoEn: new Date(),
      creadoPor: state.currentUser?.uid || "",
      modificadoPor: state.currentUser?.uid || "",
      activo: true,
    };

    await setDoc(doc(db, "phoneNumbers", id), {
      ...phone,
      creadoEn: Timestamp.now(),
      modificadoEn: Timestamp.now(),
    });

    await logSystemEvent({
      type: "user_action",
      entity: "phone",
      action: "create",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });

    return id;
  };

  const updatePhone = async (id: string, data: Partial<PhoneNumber>) => {
    await updateDoc(doc(db, "phoneNumbers", id), {
      ...data,
      modificadoEn: Timestamp.now(),
      modificadoPor: state.currentUser?.uid || "",
    });

    await logSystemEvent({
      type: "user_action",
      entity: "phone",
      action: "update",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });
  };

  const deletePhone = async (id: string) => {
    await deleteDoc(doc(db, "phoneNumbers", id));

    await logSystemEvent({
      type: "user_action",
      entity: "phone",
      action: "delete",
      userId: state.currentUser?.uid,
      entityId: id,
    });
  };

  const bulkImportPhones = async (phones: TelephoneBulkImport[]) => {
    const batch = writeBatch(db);

    phones.forEach((phoneData) => {
      const id = crypto.randomUUID();
      const phone: PhoneNumber = {
        id,
        nombre: phoneData.nombre,
        telefono: phoneData.telefono,
        direccion: phoneData.direccion,
        estado: phoneData.estado || "",
        comentarios: phoneData.notas,
        suspendido: false,
        creadoEn: new Date(),
        modificadoEn: new Date(),
        creadoPor: state.currentUser?.uid || "",
        modificadoPor: state.currentUser?.uid || "",
        activo: true,
      };

      batch.set(doc(db, "phoneNumbers", id), {
        ...phone,
        creadoEn: Timestamp.now(),
        modificadoEn: Timestamp.now(),
      });
    });

    await batch.commit();

    await logSystemEvent({
      type: "user_action",
      entity: "phone",
      action: "bulk_import",
      userId: state.currentUser?.uid,
      data: { count: phones.length },
    });
  };

  // ===== USER FUNCTIONS =====
  const createUser = async (data: CreateUserRequest): Promise<string> => {
    // Verificar permisos: Solo super-admin puede crear usuarios
    if (
      !state.currentUser ||
      !hasPermission(state.currentUser.role, "users.create")
    ) {
      throw new Error(
        "No tienes permisos para crear usuarios. Solo el Super Administrador puede realizar esta acción."
      );
    }

    const uid = crypto.randomUUID(); // In real implementation, this would come from Firebase Auth
    const user: AppUser = {
      uid,
      phoneNumber: data.phoneNumber,
      fullName: data.fullName,
      role: data.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: state.currentUser?.uid || "",
      notes: data.notes,
      linkedProviders: [],
      loginCount: 0,
    };

    await setDoc(doc(db, "users", uid), {
      ...user,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await logSystemEvent({
      type: "user_action",
      entity: "user",
      action: "create",
      userId: state.currentUser?.uid,
      entityId: uid,
      data: data,
    });

    return uid;
  };

  const updateUser = async (data: UpdateUserRequest) => {
    // Verificar permisos: Solo super-admin puede modificar usuarios
    if (
      !state.currentUser ||
      !hasPermission(state.currentUser.role, "users.update")
    ) {
      throw new Error(
        "No tienes permisos para modificar usuarios. Solo el Super Administrador puede realizar esta acción."
      );
    }

    await updateDoc(doc(db, "users", data.uid), {
      ...data,
      updatedAt: Timestamp.now(),
    });

    await logSystemEvent({
      type: "user_action",
      entity: "user",
      action: "update",
      userId: state.currentUser?.uid,
      entityId: data.uid,
      data: data,
    });
  };

  const deleteUser = async (uid: string) => {
    // Verificar permisos: Solo super-admin puede eliminar usuarios
    if (
      !state.currentUser ||
      !hasPermission(state.currentUser.role, "users.delete")
    ) {
      throw new Error(
        "No tienes permisos para eliminar usuarios. Solo el Super Administrador puede realizar esta acción."
      );
    }

    // Verificar que no se esté intentando eliminar al propio super-admin
    if (uid === state.currentUser.uid) {
      throw new Error("No puedes eliminarte a ti mismo.");
    }

    await deleteDoc(doc(db, "users", uid));

    await logSystemEvent({
      type: "user_action",
      entity: "user",
      action: "delete",
      userId: state.currentUser?.uid,
      entityId: uid,
    });
  };

  const promoteUser = async (uid: string, newRole: UserRole) => {
    // Verificar permisos: Solo super-admin puede cambiar roles de usuario
    if (
      !state.currentUser ||
      !hasPermission(state.currentUser.role, "users.promote")
    ) {
      throw new Error(
        "No tienes permisos para cambiar roles de usuario. Solo el Super Administrador puede realizar esta acción."
      );
    }

    // Verificar que no se esté intentando degradar al propio super-admin
    if (
      uid === state.currentUser.uid &&
      state.currentUser.role === "super-admin" &&
      newRole !== "super-admin"
    ) {
      throw new Error(
        "No puedes cambiar tu propio rol de Super Administrador."
      );
    }

    await updateDoc(doc(db, "users", uid), {
      role: newRole,
      updatedAt: Timestamp.now(),
    });

    await logSystemEvent({
      type: "user_action",
      entity: "user",
      action: "promote",
      userId: state.currentUser?.uid,
      entityId: uid,
      data: { newRole },
    });
  };

  const updateUserCredentials = async (
    uid: string,
    credentials: { phoneNumber?: string; email?: string; password?: string }
  ) => {
    // Verificar permisos: Solo super-admin puede modificar credenciales
    if (
      !state.currentUser ||
      !hasPermission(state.currentUser.role, "users.credentials")
    ) {
      throw new Error(
        "No tienes permisos para modificar credenciales de usuario. Solo el Super Administrador puede realizar esta acción."
      );
    }

    const updates: any = {
      updatedAt: Timestamp.now(),
    };

    if (credentials.phoneNumber) {
      updates.phoneNumber = credentials.phoneNumber;
    }
    if (credentials.email) {
      updates.email = credentials.email;
    }

    await updateDoc(doc(db, "users", uid), updates);

    await logSystemEvent({
      type: "user_action",
      entity: "user",
      action: "update_credentials",
      userId: state.currentUser?.uid,
      entityId: uid,
      data: {
        phoneNumber: credentials.phoneNumber ? "***updated***" : undefined,
        email: credentials.email ? "***updated***" : undefined,
        password: credentials.password ? "***updated***" : undefined,
      },
    });
  };

  // ===== ASSIGNMENT FUNCTIONS =====
  const createAssignment = async (
    data: CreateAssignmentRequest
  ): Promise<string> => {
    const id = crypto.randomUUID();
    const conductor = Object.values(state.conductores).find(
      (c) => c.id === data.conductorId
    );

    const assignment: Assignment = {
      id,
      conductorId: data.conductorId,
      conductorName: conductor?.nombre || "Unknown",
      territoryId: data.territoryId,
      blockIds: data.blockIds,
      fechaAsignacion: new Date(),
      fechaVencimiento: data.fechaVencimiento,
      estado: "activo",
      notas: data.notas,
      progreso: 0,
    };

    await setDoc(doc(db, "assignments", id), {
      ...assignment,
      fechaAsignacion: Timestamp.now(),
      fechaVencimiento: data.fechaVencimiento
        ? Timestamp.fromDate(data.fechaVencimiento)
        : null,
    });

    // Update block states
    const batch = writeBatch(db);
    data.blockIds.forEach((blockId) => {
      batch.update(doc(db, "blocks", blockId), {
        estado: "asignado",
      });
    });
    await batch.commit();

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "assign",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });

    return id;
  };

  const updateAssignment = async (id: string, data: Partial<Assignment>) => {
    await updateDoc(doc(db, "assignments", id), data);

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "update_assignment",
      userId: state.currentUser?.uid,
      entityId: id,
      data: data,
    });
  };

  const deleteAssignment = async (id: string) => {
    const assignment = state.assignments[id];
    if (!assignment) return;

    // Reset block states
    const batch = writeBatch(db);
    assignment.blockIds.forEach((blockId) => {
      batch.update(doc(db, "blocks", blockId), {
        estado: "pendiente",
      });
    });

    // Delete assignment
    batch.delete(doc(db, "assignments", id));

    await batch.commit();

    await logSystemEvent({
      type: "user_action",
      entity: "territory",
      action: "delete_assignment",
      userId: state.currentUser?.uid,
      entityId: id,
    });
  };

  const returnAssignment = async (id: string, reason?: string) => {
    await updateAssignment(id, {
      estado: "devuelto",
      notas: reason ? `Devuelto: ${reason}` : "Devuelto",
    });
  };

  // ===== UTILITY FUNCTIONS =====
  const getStats = (): AppStats => {
    const territories = Object.values(state.territories);
    const blocks = Object.values(state.blocks);
    const assignments = Object.values(state.assignments);
    const phones = Object.values(state.phoneNumbers);
    const users = Object.values(state.users);

    return {
      territories: {
        total: territories.length,
        active: territories.filter((t) => t.activo).length,
        assigned: territories.filter((t) => t.asignaciones.length > 0).length,
        completed: territories.filter((t) =>
          t.manzanas.every((b) => b.estado === "completado")
        ).length,
      },
      blocks: {
        total: blocks.length,
        available: blocks.filter((b) => b.estado === "pendiente").length,
        assigned: blocks.filter((b) => b.estado === "asignado").length,
        completed: blocks.filter((b) => b.estado === "completado").length,
      },
      assignments: {
        active: assignments.filter((a) => a.estado === "activo").length,
        completed: assignments.filter((a) => a.estado === "completado").length,
        expired: assignments.filter((a) => a.estado === "vencido").length,
        avgCompletionDays: 0, // TODO: Calculate based on actual data
      },
      phones: {
        total: phones.length,
        contacted: phones.filter((p) => p.estado === "Contestaron").length,
        pending: phones.filter((p) => p.estado === "").length,
        blocked: phones.filter((p) => p.estado === "No llamar").length,
        studies: phones.filter((p) => p.estado === "Estudio").length,
      },
      users: {
        total: users.length,
        active: users.filter((u) => u.isActive).length,
        admins: users.filter((u) => u.role === "admin").length,
        superAdmins: users.filter((u) => u.role === "super-admin").length,
        conductores: users.filter((u) => u.role === "conductor").length,
      },
    };
  };

  const refreshData = async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    // Force refresh all listeners by re-triggering them
    dispatch({ type: "SET_LOADING", payload: false });
  };

  const exportData = async (type: string) => {
    // TODO: Implement data export functionality
    return {};
  };

  const logSystemEvent = async (
    event: Omit<SystemEvent, "id" | "timestamp">
  ) => {
    const systemEvent: SystemEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    try {
      await setDoc(doc(db, "systemEvents", systemEvent.id), {
        ...systemEvent,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error logging system event:", error);
    }
  };

  // ✅ OPTIMIZACIÓN: Memoizar el value object para evitar re-renders innecesarios
  const value: AppContextValue = useMemo(
    () => ({
      state,

      // Auth
      signInWithPhone,
      verifyCode,
      signOut,
      signInAsSuperAdmin,
      signInAsConductor,
      checkUserPermission,

      // Territories
      createTerritory,
      updateTerritory,
      deleteTerritory,

      // Blocks
      createBlock,
      updateBlock,
      deleteBlock,

      // Addresses
      createAddress,
      updateAddress,
      deleteAddress,

      // Phone Numbers
      createPhone,
      updatePhone,
      deletePhone,
      bulkImportPhones,

      // Users
      createUser,
      updateUser,
      deleteUser,
      promoteUser,
      updateUserCredentials,

      // Assignments
      createAssignment,
      updateAssignment,
      deleteAssignment,
      returnAssignment,

      // Utilities
      getStats,
      refreshData,
      exportData,
      logSystemEvent,
    }),
    [
      state,
      signInWithPhone,
      verifyCode,
      signOut,
      signInAsSuperAdmin,
      signInAsConductor,
      checkUserPermission,
      createTerritory,
      updateTerritory,
      deleteTerritory,
      createBlock,
      updateBlock,
      deleteBlock,
      createAddress,
      updateAddress,
      deleteAddress,
      createPhone,
      updatePhone,
      deletePhone,
      bulkImportPhones,
      createUser,
      updateUser,
      deleteUser,
      promoteUser,
      updateUserCredentials,
      createAssignment,
      updateAssignment,
      deleteAssignment,
      returnAssignment,
      getStats,
      refreshData,
      exportData,
      logSystemEvent,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ===== HOOK =====
export function useUnifiedApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useUnifiedApp must be used within a UnifiedAppProvider");
  }
  return context;
}

export default UnifiedAppProvider;
