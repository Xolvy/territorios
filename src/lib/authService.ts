import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// Tipos para el sistema de roles
export interface UserRole {
  uid: string;
  email?: string;
  nombre: string;
  role: 'administrador' | 'conductor';
  isActive: boolean;
  createdAt?: any;
  lastLogin?: any;
  permissions?: string[];
}

export interface AdminPermissions {
  canManageTerritories: boolean;
  canManageUsers: boolean;
  canManageProgram: boolean;
  canManagePhones: boolean;
  canViewReports: boolean;
  canExportData: boolean;
}

const DEFAULT_ADMIN_PASSWORD = "Territorios2025";
const ROLES_COLLECTION = 'roles';
const SETTINGS_COLLECTION = 'settings';

// Referencias de Firestore
const getRolesCollection = () => collection(db, 'artifacts', 'conductores-app-v2', 'private', 'admin', ROLES_COLLECTION);
const getSettingsCollection = () => collection(db, 'artifacts', 'conductores-app-v2', 'private', 'admin', SETTINGS_COLLECTION);
const getUserRoleDoc = (uid: string) => doc(getRolesCollection(), uid);
const getSettingsDoc = (key: string) => doc(getSettingsCollection(), key);

export class AuthService {
  private static instance: AuthService;
  private currentUser: UserRole | null = null;
  
  private constructor() {}
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Verificar contraseña de administrador
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const settingsDoc = await getDoc(getSettingsDoc('admin_password'));
      const adminPassword = settingsDoc.exists() ? 
        settingsDoc.data().password : DEFAULT_ADMIN_PASSWORD;
      
      return password === adminPassword;
    } catch (error) {
      console.error('Error verificando contraseña:', error);
      return password === DEFAULT_ADMIN_PASSWORD;
    }
  }

  // Cambiar contraseña de administrador
  async changeAdminPassword(newPassword: string, currentUser: UserRole): Promise<void> {
    if (currentUser.role !== 'administrador') {
      throw new Error('Solo los administradores pueden cambiar la contraseña');
    }

    await setDoc(getSettingsDoc('admin_password'), {
      password: newPassword,
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp()
    });
  }

  // Inicializar usuario por primera vez
  async initializeUser(uid: string, nombre: string, isFirstAdmin = false): Promise<UserRole> {
    const userRole: UserRole = {
      uid,
      nombre,
      role: isFirstAdmin ? 'administrador' : 'conductor',
      isActive: true,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };

    await setDoc(getUserRoleDoc(uid), userRole);
    this.currentUser = userRole;
    return userRole;
  }

  // Obtener rol del usuario
  async getUserRole(uid: string): Promise<UserRole | null> {
    try {
      const userDoc = await getDoc(getUserRoleDoc(uid));
      
      if (userDoc.exists()) {
        const userData = { uid: userDoc.id, ...userDoc.data() } as unknown as UserRole;
        
        // Actualizar último login
        await updateDoc(getUserRoleDoc(uid), {
          lastLogin: serverTimestamp()
        });
        
        this.currentUser = userData;
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo rol del usuario:', error);
      return null;
    }
  }

  // Verificar si es administrador
  isAdmin(userRole: UserRole | null): boolean {
    return userRole?.role === 'administrador' && userRole?.isActive === true;
  }

  // Verificar si es conductor
  isConductor(userRole: UserRole | null): boolean {
    return userRole?.role === 'conductor' && userRole?.isActive === true;
  }

  // Promover usuario a administrador
  async promoteToAdmin(targetUid: string, currentUser: UserRole): Promise<void> {
    if (!this.isAdmin(currentUser)) {
      throw new Error('Solo los administradores pueden promover usuarios');
    }

    const targetUserDoc = await getDoc(getUserRoleDoc(targetUid));
    if (!targetUserDoc.exists()) {
      throw new Error('Usuario no encontrado');
    }

    await updateDoc(getUserRoleDoc(targetUid), {
      role: 'administrador',
      updatedAt: serverTimestamp(),
      promotedBy: currentUser.uid
    });
  }

  // Degradar administrador a conductor
  async demoteToUser(targetUid: string, currentUser: UserRole): Promise<void> {
    if (!this.isAdmin(currentUser)) {
      throw new Error('Solo los administradores pueden degradar usuarios');
    }

    if (targetUid === currentUser.uid) {
      throw new Error('No puedes degradarte a ti mismo');
    }

    await updateDoc(getUserRoleDoc(targetUid), {
      role: 'conductor',
      updatedAt: serverTimestamp(),
      demotedBy: currentUser.uid
    });
  }

  // Obtener todos los usuarios
  async getAllUsers(): Promise<UserRole[]> {
    try {
      const snapshot = await getDocs(getRolesCollection());
      return snapshot.docs.map(doc => ({ 
        uid: doc.id, 
        ...doc.data() 
      })) as unknown as UserRole[];
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return [];
    }
  }

  // Obtener administradores
  async getAdmins(): Promise<UserRole[]> {
    try {
      const q = query(getRolesCollection(), where('role', '==', 'administrador'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        uid: doc.id, 
        ...doc.data() 
      })) as unknown as UserRole[];
    } catch (error) {
      console.error('Error obteniendo administradores:', error);
      return [];
    }
  }

  // Activar/desactivar usuario
  async toggleUserStatus(targetUid: string, isActive: boolean, currentUser: UserRole): Promise<void> {
    if (!this.isAdmin(currentUser)) {
      throw new Error('Solo los administradores pueden cambiar el estado de usuarios');
    }

    if (targetUid === currentUser.uid && !isActive) {
      throw new Error('No puedes desactivarte a ti mismo');
    }

    await updateDoc(getUserRoleDoc(targetUid), {
      isActive,
      updatedAt: serverTimestamp(),
      statusChangedBy: currentUser.uid
    });
  }

  // Verificar si existe al menos un administrador
  async hasAdmins(): Promise<boolean> {
    try {
      const admins = await this.getAdmins();
      return admins.some(admin => admin.isActive);
    } catch (error) {
      console.error('Error verificando administradores:', error);
      return false;
    }
  }

  // Obtener usuario actual
  getCurrentUser(): UserRole | null {
    return this.currentUser;
  }

  // Limpiar sesión
  clearSession(): void {
    this.currentUser = null;
  }

  // Verificar permisos específicos
  hasPermission(userRole: UserRole | null, permission: keyof AdminPermissions): boolean {
    if (!userRole || !userRole.isActive) return false;
    
    // Los administradores tienen todos los permisos
    if (userRole.role === 'administrador') return true;
    
    // Los conductores solo tienen permisos limitados
    if (userRole.role === 'conductor') {
      const conductorPermissions: (keyof AdminPermissions)[] = [
        'canViewReports'
      ];
      return conductorPermissions.includes(permission);
    }
    
    return false;
  }

  // Obtener permisos del usuario
  getUserPermissions(userRole: UserRole | null): AdminPermissions {
    const defaultPermissions: AdminPermissions = {
      canManageTerritories: false,
      canManageUsers: false,
      canManageProgram: false,
      canManagePhones: false,
      canViewReports: false,
      canExportData: false
    };

    if (!userRole || !userRole.isActive) {
      return defaultPermissions;
    }

    if (userRole.role === 'administrador') {
      return {
        canManageTerritories: true,
        canManageUsers: true,
        canManageProgram: true,
        canManagePhones: true,
        canViewReports: true,
        canExportData: true
      };
    }

    if (userRole.role === 'conductor') {
      return {
        ...defaultPermissions,
        canViewReports: true
      };
    }

    return defaultPermissions;
  }
}

// Singleton instance
export const authService = AuthService.getInstance();
export default authService;
