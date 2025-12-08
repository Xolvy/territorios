export interface Territory {
  id: string;
  numero: number;
  totalManzanas: number;
  asignaciones: Assignment[];
  historialAsignaciones: HistoryAssignment[];
  ultimaModificacion?: Date;
}

export interface Assignment {
  conductor: string;
  manzanas: number[];
  fechaAsignacion: string;
  estado: "activo" | "completado";
  turno?: string;
}

export interface HistoryAssignment {
  conductor: string;
  conductorOriginal: string;
  fechaDevolucion: string;
  manzanas?: number[];
}

export interface Conductor {
  id: string;
  nombre: string;
}

export interface Publicador {
  id: string;
  nombre: string;
}

export interface Lugar {
  id: string;
  nombre: string;
}

export interface Faceta {
  id: string;
  nombre: string;
}

export interface ProgramaReunion {
  id: string;
  fecha: string;
  hora: string;
  lugar: string;
  conductor: string;
  auxiliar?: string;
  faceta: string;
  territorio?: string;
  timestamp: Date;
}

export interface TelephoneRecord {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  publicador?: string;
  estado: TelephoneStatus;
  comentarios?: string;
  fechaUltimaLlamada?: Date;
  fechaBloqueo?: Date; // Para "No llamar" (6 meses)
  fechaRevisita?: Date; // Para "Revisita"
  suspendido?: boolean;
  creadoEn?: Date;
  modificadoEn?: Date;
  creadoPor?: string;
  modificadoPor?: string;
}

export type TelephoneStatus =
  | ""
  | "Colgaron"
  | "Contestaron"
  | "No contestaron"
  | "No llamar"
  | "Revisita"
  | "Suspendido"
  | "Testigo";

export interface TelephoneGenerated {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  publicador: string;
  estado: TelephoneStatus;
  fechaGeneracion: Date;
  sessionId: string; // Para agrupar los números de una sesión
}

export interface TelephoneBulkImport {
  nombre: string;
  direccion: string;
  telefono: string;
  estado?: TelephoneStatus;
}

export interface TelephoneSession {
  id: string;
  fechaGeneracion: Date;
  numeros: TelephoneGenerated[];
  completada: boolean;
}

export interface AppState {
  conductores: Conductor[];
  publicadores: Publicador[];
  territorios: Record<string, Territory>;
  programa: ProgramaReunion[];
  lugares: Lugar[];
  facetas: Faceta[];
  listadoTelefonico: TelephoneRecord[];
  listadoTelefonicoActual: TelephoneRecord[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

export interface ModalState {
  isOpen: boolean;
  type: string;
  title: string;
  data?: any;
}

export interface DashboardStats {
  territoriosAsignados: number;
  territoriosCompletados: number;
  progresoPromedio: number;
}

// User roles and permissions types
export interface UserRole {
  uid: string;
  nombre: string;
  role: "administrador" | "conductor";
  createdAt: Date;
  createdBy?: string;
}

export interface AdminPermissions {
  canAssignTerritories: boolean;
  canManageUsers: boolean;
  canManagePhones: boolean;
  canViewReports: boolean;
  canConfigureSystem: boolean;
}

// Admin functions types
export type AsignarTerritorioFunction = (
  territorioId: string,
  hermanoId: string,
  manzanas: string[]
) => Promise<boolean>;

export type DevolverTerritorioFunction = (
  territorioId: string
) => Promise<boolean>;
