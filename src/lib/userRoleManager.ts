import { auth, db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

// Tipos de roles del sistema
export type UserRole = 'conductor' | 'admin' | 'super-admin';

// Interface para el documento de usuario en Firestore
export interface UserDocument {
  uid: string;
  phone: string;
  email?: string;
  role: UserRole;
  displayName: string;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

// Clase para gestionar roles y permisos de usuarios
export class UserRoleManager {
  
  /**
   * Obtiene el documento de usuario desde Firestore
   */
  static async getUserDocument(uid: string): Promise<UserDocument | null> {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        return userDoc.data() as UserDocument;
      }
      return null;
    } catch (error) {
      console.error('Error getting user document:', error);
      return null;
    }
  }

  /**
   * Crea o actualiza el documento de usuario en Firestore
   */
  static async createOrUpdateUser(user: User, role: UserRole = 'conductor', displayName?: string): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userData: UserDocument = {
        uid: user.uid,
        phone: user.phoneNumber || '',
        email: user.email || '',
        role,
        displayName: displayName || user.displayName || 'Usuario',
        active: true,
        createdAt: new Date(),
        lastLoginAt: new Date()
      };
      
      await setDoc(userDocRef, userData, { merge: true });
      return true;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      return false;
    }
  }

  /**
   * Actualiza el último login del usuario
   */
  static async updateLastLogin(uid: string): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        lastLoginAt: new Date()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Verifica si el usuario actual es administrador
   */
  static async isAdmin(uid?: string): Promise<boolean> {
    try {
      const userId = uid || auth.currentUser?.uid;
      if (!userId) return false;
      
      const userDoc = await this.getUserDocument(userId);
      return userDoc?.role === 'admin' || userDoc?.role === 'super-admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Verifica si el usuario actual es super-administrador
   */
  static async isSuperAdmin(uid?: string): Promise<boolean> {
    try {
      const userId = uid || auth.currentUser?.uid;
      if (!userId) return false;
      
      const userDoc = await this.getUserDocument(userId);
      return userDoc?.role === 'super-admin';
    } catch (error) {
      console.error('Error checking super-admin status:', error);
      return false;
    }
  }

  /**
   * Obtiene el rol del usuario actual
   */
  static async getCurrentUserRole(): Promise<UserRole | null> {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return null;
      
      const userDoc = await this.getUserDocument(uid);
      return userDoc?.role || null;
    } catch (error) {
      console.error('Error getting current user role:', error);
      return null;
    }
  }

  /**
   * Cambia el rol de un usuario (solo para super-admin)
   */
  static async changeUserRole(targetUid: string, newRole: UserRole): Promise<boolean> {
    try {
      // Verificar que el usuario actual es super-admin
      const isSuperAdmin = await this.isSuperAdmin();
      if (!isSuperAdmin) {
        console.error('Only super-admin can change user roles');
        return false;
      }
      
      const userDocRef = doc(db, 'users', targetUid);
      await updateDoc(userDocRef, {
        role: newRole,
        updatedAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error changing user role:', error);
      return false;
    }
  }

  /**
   * Obtiene los permisos del usuario según su rol
   */
  static getPermissionsForRole(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      'conductor': [
        'read:own-assignments',
        'read:territories',
        'read:phone-numbers'
      ],
      'admin': [
        'read:users',
        'write:users',
        'read:territories',
        'write:territories',
        'read:phone-numbers',
        'write:phone-numbers',
        'read:assignments',
        'write:assignments',
        'read:system-logs'
      ],
      'super-admin': [
        'read:*',
        'write:*',
        'admin:*',
        'read:settings',
        'write:settings',
        'manage:roles'
      ]
    };

    return permissions[role] || [];
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  static async hasPermission(permission: string, uid?: string): Promise<boolean> {
    try {
      const userId = uid || auth.currentUser?.uid;
      if (!userId) return false;
      
      const userDoc = await this.getUserDocument(userId);
      if (!userDoc) return false;
      
      const userPermissions = this.getPermissionsForRole(userDoc.role);
      
      // Verificar permisos específicos o wildcards
      return userPermissions.includes(permission) || 
             userPermissions.includes('*') || 
             userPermissions.some(p => p.endsWith(':*') && permission.startsWith(p.split(':')[0]));
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }
}

// Exportar instancia por defecto
export default UserRoleManager;