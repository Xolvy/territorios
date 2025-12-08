// Tipos centralizados para toda la aplicación
import { User as FirebaseUser } from "firebase/auth";

// ===== TIPOS DE USUARIO =====
export type UserRole = "conductor" | "admin" | "super-admin";

export interface AppUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  fullName?: string;
  notes?: string;
  linkedProviders: string[];
  lastLogin?: Date;
  loginCount: number;
}

// ===== TIPOS DE TERRITORIOS Y MANZANAS =====
export interface Territory {
  id: string;
  numero: number;
  totalManzanas: number;
  manzanas: Block[];
  asignaciones: Assignment[];
  historialAsignaciones: HistoryAssignment[];
  ultimaModificacion?: Date;
  activo: boolean;
  descripcion?: string;
  coordenadas?: { lat: number; lng: number };
  limites?: string;
}

export interface Block {
  id: string;
  numero: number;
  territoryId: string;
  direcciones: Address[];
  estado: "pendiente" | "asignado" | "trabajado" | "completado";
  fechaUltimaVisita?: Date;
  notas?: string;
  activo: boolean;
}

export interface Address {
  id: string;
  blockId: string;
  direccion: string;
  coordenadas?: { lat: number; lng: number };
  telefonos: PhoneNumber[];
  estado: "no_visitado" | "visitado" | "revisita" | "estudio" | "no_contactar";
  ultimaVisita?: Date;
  notas?: string;
  activo: boolean;
}

export interface PhoneNumber {
  id: string;
  addressId?: string;
  nombre: string;
  telefono: string;
  direccion: string;
  publicador?: string;
  estado: TelephoneStatus;
  comentarios?: string;
  fechaUltimaLlamada?: Date;
  fechaBloqueo?: Date;
  fechaRevisita?: Date;
  suspendido?: boolean;
  creadoEn?: Date;
  modificadoEn?: Date;
  creadoPor?: string;
  modificadoPor?: string;
  activo: boolean;
}

export type TelephoneStatus =
  | ""
  | "Colgaron"
  | "Contestaron"
  | "No contestaron"
  | "No llamar"
  | "Revisita"
  | "Suspendido"
  | "Estudio"
  | "Testigo";

// ===== ASIGNACIONES =====
export interface Assignment {
  id: string;
  conductorId: string;
  conductorName: string;
  territoryId: string;
  blockIds: string[];
  fechaAsignacion: Date;
  fechaVencimiento?: Date;
  estado: "activo" | "completado" | "vencido" | "devuelto";
  turno?: string;
  notas?: string;
  progreso?: number; // 0-100
}

export interface HistoryAssignment {
  id: string;
  assignmentId: string;
  conductor: string;
  conductorOriginal: string;
  fechaDevolucion: Date;
  razon?: string;
  manzanasCompletadas?: number;
  notas?: string;
}

// ===== PERSONAS =====
export interface Conductor {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  activo: boolean;
  fechaRegistro: Date;
  asignacionesActivas: number;
  totalAsignaciones: number;
  privilegios: string[];
}

// ===== PROGRAMA Y REUNIONES =====
export interface ProgramaReunion {
  id: string;
  fecha: Date;
  hora: string;
  lugar: string;
  conductor: string;
  auxiliar?: string;
  faceta: string;
  territorio?: string;
  manzanas?: string[];
  participantes?: string[];
  notas?: string;
  estado: "programado" | "realizado" | "cancelado";
  activo: boolean;
}

export interface Lugar {
  id: string;
  nombre: string;
  direccion: string;
  coordenadas?: { lat: number; lng: number };
  capacidad?: number;
  activo: boolean;
  notas?: string;
}

export interface Faceta {
  id: string;
  nombre: string;
  descripcion?: string;
  duracion?: number; // minutos
  activo: boolean;
  categoria: "discurso" | "demostracion" | "lectura" | "otro";
}

// ===== SESIONES Y BULK OPERATIONS =====
export interface TelephoneSession {
  id: string;
  fechaGeneracion: Date;
  numeros: PhoneNumber[];
  completada: boolean;
  publicador: string;
  territorio?: string;
  sessionType: "manual" | "bulk_import" | "generated";
}

export interface BulkImportOperation {
  id: string;
  tipo: "territories" | "blocks" | "addresses" | "phones" | "users";
  archivo: string;
  fechaImport: Date;
  registrosTotal: number;
  registrosExitosos: number;
  registrosError: number;
  errores: string[];
  usuario: string;
  estado: "procesando" | "completado" | "error";
}

// ===== ESTADO DE LA APLICACIÓN =====
export interface AppState {
  // Datos principales
  territories: Record<string, Territory>;
  blocks: Record<string, Block>;
  addresses: Record<string, Address>;
  phoneNumbers: Record<string, PhoneNumber>;

  // Personas
  conductores: Record<string, Conductor>;
  users: Record<string, AppUser>;

  // Programa
  programa: Record<string, ProgramaReunion>;
  lugares: Record<string, Lugar>;
  facetas: Record<string, Faceta>;

  // Asignaciones
  assignments: Record<string, Assignment>;
  assignmentHistory: Record<string, HistoryAssignment>;

  // Sesiones
  telephoneSessions: Record<string, TelephoneSession>;
  bulkOperations: Record<string, BulkImportOperation>;

  // Estado UI
  isLoading: boolean;
  isAuthenticated: boolean;
  currentUser?: AppUser;
  selectedTerritory?: string;
  selectedBlock?: string;

  // Configuración
  settings: AppSettings;
}

export interface AppSettings {
  // Configuración de territorios
  territorySettings: {
    autoAssignExpiration: boolean;
    defaultExpirationDays: number;
    maxBlocksPerAssignment: number;
    requireApprovalForReassignment: boolean;
  };

  // Configuración de teléfonos
  phoneSettings: {
    autoGenerateFromAddresses: boolean;
    blockPhoneAfterMonths: number;
    autoSuspendAfterAttempts: number;
    requireNotesForStatus: boolean;
  };

  // Configuración de usuarios
  userSettings: {
    requirePhoneVerification: boolean;
    autoActivateNewUsers: boolean;
    defaultRole: UserRole;
    sessionTimeoutMinutes: number;
  };

  // Configuración de la aplicación
  appSettings: {
    offlineMode: boolean;
    autoBackup: boolean;
    backupIntervalDays: number;
    dataRetentionMonths: number;
    theme: "light" | "dark" | "auto";
    language: string;
  };
}

// ===== PERMISOS Y AUTORIZACION =====
export const PERMISSIONS = {
  conductor: [
    "territories.view",
    "territories.assign_blocks",
    "phone.assigned",
    "phone.update_status",
    "profile.update",
    "assignments.view_own",
    "assignments.create",
    "assignments.manage_own",
  ],
  admin: [
    "users.read", // Solo puede ver usuarios
    "territories.manage",
    "blocks.manage",
    "addresses.manage",
    "phone.manage",
    "assignments.manage",
    "programa.manage",
    "places.manage",
    "facetas.manage",
    "bulk.import",
    "reports.view",
    "settings.manage",
  ],
  "super-admin": [
    "users.create", // Solo super-admin puede crear usuarios
    "users.read",
    "users.update", // Solo super-admin puede modificar usuarios
    "users.delete", // Solo super-admin puede eliminar usuarios
    "users.promote", // Solo super-admin puede cambiar roles
    "users.credentials", // Solo super-admin puede modificar credenciales
    "territories.manage",
    "blocks.manage",
    "addresses.manage",
    "phone.manage",
    "assignments.manage",
    "programa.manage",
    "places.manage",
    "facetas.manage",
    "bulk.import",
    "bulk.export",
    "reports.view",
    "settings.manage",
    "system.admin",
    "data.backup",
    "data.restore",
  ],
} as const;

export type Permission =
  | "users.create"
  | "users.read"
  | "users.update"
  | "users.delete"
  | "users.promote"
  | "users.credentials"
  | "territories.view"
  | "territories.manage"
  | "territories.assign_blocks"
  | "blocks.manage"
  | "addresses.manage"
  | "phone.assigned"
  | "phone.manage"
  | "phone.update_status"
  | "assignments.view_own"
  | "assignments.create"
  | "assignments.manage"
  | "assignments.manage_own"
  | "programa.manage"
  | "places.manage"
  | "facetas.manage"
  | "bulk.import"
  | "bulk.export"
  | "reports.view"
  | "settings.manage"
  | "system.admin"
  | "data.backup"
  | "data.restore"
  | "profile.update";

// ===== UTILIDADES =====
export const hasPermission = (
  role: UserRole,
  permission: Permission
): boolean => {
  const rolePermissions = PERMISSIONS[role] as readonly Permission[];
  return rolePermissions.includes(permission);
};

export const isSuperAdmin = (
  phoneNumber?: string,
  uid?: string,
  email?: string
): boolean => {
  if (phoneNumber === "+593994749286") return true;
  if (uid === "LvkcQrZS7yQobvnXoOoJthNduUT2") return true;
  if (email === "italo.fm0@gmail.com") return true;
  return false;
};

export const canPromoteUser = (
  promoterRole: UserRole,
  targetRole: UserRole
): boolean => {
  if (targetRole === "admin" || targetRole === "super-admin") {
    return promoterRole === "super-admin";
  }
  return promoterRole === "admin" || promoterRole === "super-admin";
};

// ===== INTERFACES DE FORMULARIOS =====
export interface CreateTerritoryRequest {
  numero: number;
  descripcion?: string;
  coordenadas?: { lat: number; lng: number };
  limites?: string;
}

export interface CreateBlockRequest {
  numero: number;
  territoryId: string;
  notas?: string;
}

export interface CreateAddressRequest {
  direccion: string;
  blockId: string;
  coordenadas?: { lat: number; lng: number };
  notas?: string;
}

export interface CreateUserRequest {
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  notes?: string;
}

export interface UpdateUserRequest {
  uid: string;
  fullName?: string;
  phoneNumber?: string;
  role?: UserRole;
  isActive?: boolean;
  notes?: string;
}

export interface CreateAssignmentRequest {
  conductorId: string;
  territoryId: string;
  blockIds: string[];
  fechaVencimiento?: Date;
  notas?: string;
}

export interface TelephoneBulkImport {
  nombre: string;
  direccion: string;
  telefono: string;
  estado?: TelephoneStatus;
  notas?: string;
}

// ===== ESTADISTICAS =====
export interface AppStats {
  territories: {
    total: number;
    active: number;
    assigned: number;
    completed: number;
  };
  blocks: {
    total: number;
    available: number;
    assigned: number;
    completed: number;
  };
  assignments: {
    active: number;
    completed: number;
    expired: number;
    avgCompletionDays: number;
  };
  phones: {
    total: number;
    contacted: number;
    pending: number;
    blocked: number;
    studies: number;
  };
  users: {
    total: number;
    active: number;
    admins: number;
    superAdmins: number;
    conductores: number;
  };
}

// Firebase Auth User extendido
export interface ExtendedFirebaseUser extends FirebaseUser {
  appUserData?: AppUser;
}

// ===== TIPOS DE EVENTOS PARA TRACKING =====
export interface SystemEvent {
  id: string;
  type: "user_action" | "system_action" | "data_change" | "error";
  entity: "territory" | "block" | "assignment" | "user" | "phone" | "system";
  action: string;
  userId?: string;
  entityId?: string;
  data?: any;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export interface DataVersion {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  data: any;
  userId: string;
  timestamp: Date;
  comment?: string;
}
