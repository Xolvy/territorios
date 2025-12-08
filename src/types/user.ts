import { User as FirebaseUser } from "firebase/auth";

export type UserRole = "publicador" | "conductor" | "admin" | "super-admin";

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
  createdBy: string; // UID del admin que creó este usuario

  // Información adicional del conductor
  fullName?: string;
  serviceGroup?: string;
  notes?: string;

  // Providers vinculados
  linkedProviders: string[]; // ['phone', 'google.com', etc]

  // Metadata
  lastLogin?: Date;
  loginCount: number;
}

export interface CreateUserRequest {
  phoneNumber: string;
  fullName: string;
  serviceGroup?: string;
  role: UserRole;
  notes?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  conductorUsers: number;
  newUsersThisMonth: number;
}

export interface UpdateUserRequest {
  uid: string;
  fullName?: string;
  phoneNumber?: string; // Solo super-admin puede cambiar esto
  serviceGroup?: string;
  role?: UserRole;
  isActive?: boolean;
  notes?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  conductorUsers: number;
  newUsersThisMonth: number;
  recentLogins: number; // últimos 30 días
}

// Permisos por rol
export const PERMISSIONS = {
  publicador: ["territories.view", "phone.assigned", "profile.update"],
  "super-admin": [
    "users.create",
    "users.read",
    "users.update",
    "users.delete",
    "users.promote",
    "territories.manage",
    "phone.manage",
    "system.admin",
    "google.auth",
  ],
  admin: [
    "users.create",
    "users.read",
    "users.update",
    "territories.manage",
    "phone.manage",
    "system.admin",
    "google.auth",
  ],
  conductor: ["territories.view", "phone.assigned", "profile.update"],
} as const;

export type Permission =
  | "users.create"
  | "users.read"
  | "users.update"
  | "users.delete"
  | "users.promote"
  | "territories.manage"
  | "phone.manage"
  | "system.admin"
  | "google.auth"
  | "territories.view"
  | "phone.assigned"
  | "profile.update";

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
  // Verificación por teléfono (método original)
  if (phoneNumber === "+593994749286") {
    return true;
  }

  // Verificación por UID de Firebase (para tu cuenta existente)
  if (uid === "LvkcQrZS7yQobvnXoOoJthNduUT2") {
    return true;
  }

  // Verificación por email (para tu cuenta existente)
  if (email === "italo.fm0@gmail.com") {
    return true;
  }

  return false;
};

export const canPromoteUser = (
  promoterRole: UserRole,
  targetRole: UserRole
): boolean => {
  // Solo super-admin puede crear otros admins
  if (targetRole === "admin" || targetRole === "super-admin") {
    return promoterRole === "super-admin";
  }

  // Admins y super-admins pueden crear conductores
  return promoterRole === "admin" || promoterRole === "super-admin";
};

// Firebase Auth User extendido con nuestra información
export interface ExtendedFirebaseUser extends FirebaseUser {
  appUserData?: AppUser;
}
