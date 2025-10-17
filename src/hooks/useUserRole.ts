"use client";

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import UserRoleManager, { UserRole, UserDocument } from '@/lib/userRoleManager';

export interface UseUserRoleReturn {
  user: User | null;
  userDocument: UserDocument | null;
  role: UserRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => Promise<boolean>;
  refreshUserData: () => Promise<void>;
}

/**
 * Hook personalizado para gestionar roles y permisos de usuario
 */
export const useUserRole = (): UseUserRoleReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [userDocument, setUserDocument] = useState<UserDocument | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Actualiza los datos del usuario desde Firestore
   */
  const refreshUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setUserDocument(null);
        setRole(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        return;
      }

      // Obtener documento del usuario
      const userDoc = await UserRoleManager.getUserDocument(user.uid);
      
      if (userDoc) {
        setUserDocument(userDoc);
        setRole(userDoc.role);
        setIsAdmin(['admin', 'super-admin'].includes(userDoc.role));
        setIsSuperAdmin(userDoc.role === 'super-admin');
        
        // Actualizar último login
        await UserRoleManager.updateLastLogin(user.uid);
      } else {
        // Si no existe el documento, crear uno con rol básico
        const created = await UserRoleManager.createOrUpdateUser(user, 'conductor');
        if (created) {
          await refreshUserData(); // Volver a cargar después de crear
        } else {
          setError('Error al crear el documento de usuario');
        }
      }
    } catch (err: any) {
      console.error('Error refreshing user data:', err);
      setError(err.message || 'Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const hasPermission = async (permission: string): Promise<boolean> => {
    if (!user) return false;
    return UserRoleManager.hasPermission(permission, user.uid);
  };

  // Efecto para escuchar cambios en la autenticación
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        await refreshUserData();
      } else {
        setUserDocument(null);
        setRole(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Efecto para refrescar datos cuando cambia el usuario
  useEffect(() => {
    if (user) {
      refreshUserData();
    }
  }, [user]);

  return {
    user,
    userDocument,
    role,
    isAdmin,
    isSuperAdmin,
    loading,
    error,
    hasPermission,
    refreshUserData
  };
};

export default useUserRole;