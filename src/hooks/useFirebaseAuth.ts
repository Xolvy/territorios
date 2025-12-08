"use client";

import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { userService } from "../lib/userService";
import { AppUser, UserRole, hasPermission, Permission } from "../types/user";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
}

export const useFirebaseAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    firebaseUser: null,
    appUser: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!auth) {
      setAuthState({
        firebaseUser: null,
        appUser: null,
        loading: false,
        error: "Firebase Auth no está configurado",
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log(
          "🔑 Estado de autenticación cambió:",
          firebaseUser?.uid || "No autenticado"
        );

        if (firebaseUser) {
          try {
            // Vincular el usuario de Firebase con nuestros datos de app
            let appUser: AppUser | null = null;

            try {
              appUser = await userService.linkFirebaseUser(firebaseUser);
            } catch (userError) {
              console.warn(
                "No se pudo obtener usuario de la base de datos:",
                userError
              );
            }

            // Si no existe el usuario en nuestra base de datos y es anónimo, crear uno temporal
            if (!appUser && firebaseUser.isAnonymous) {
              console.log(
                "🔧 Creando usuario anónimo con permisos de super-admin"
              );
              appUser = {
                uid: firebaseUser.uid,
                displayName: "Super Admin",
                email: firebaseUser.email || "admin@sistema.local",
                role: "super-admin" as UserRole,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: firebaseUser.uid,
                linkedProviders: ["anonymous"],
                loginCount: 1,
                lastLogin: new Date(),
              } as AppUser;
            }

            // Si aún no hay appUser y no es anónimo, denegar acceso
            if (!appUser && !firebaseUser.isAnonymous) {
              await firebaseSignOut(auth);
              setAuthState({
                firebaseUser: null,
                appUser: null,
                loading: false,
                error: "Usuario no autorizado. Contacte al administrador.",
              });
              return;
            }

            // Verificar si el usuario está activo (solo para usuarios no anónimos)
            if (appUser && !firebaseUser.isAnonymous && !appUser.isActive) {
              await firebaseSignOut(auth);
              setAuthState({
                firebaseUser: null,
                appUser: null,
                loading: false,
                error: "Cuenta desactivada. Contacte al administrador.",
              });
              return;
            }

            setAuthState({
              firebaseUser,
              appUser,
              loading: false,
              error: null,
            });
          } catch (error: any) {
            console.error("Error en proceso de autenticación:", error);
            setAuthState({
              firebaseUser: null,
              appUser: null,
              loading: false,
              error: error.message || "Error de autenticación",
            });
          }
        } else {
          setAuthState({
            firebaseUser: null,
            appUser: null,
            loading: false,
            error: null,
          });
        }
      },
      (error) => {
        console.error("Error en auth state changed:", error);
        setAuthState({
          firebaseUser: null,
          appUser: null,
          loading: false,
          error: error.message,
        });
      }
    );

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      if (auth) {
        await firebaseSignOut(auth);
        console.log("👋 Usuario desautenticado exitosamente");
      }
    } catch (error: any) {
      console.error("Error signing out:", error);
      setAuthState((prev) => ({
        ...prev,
        error: error.message,
      }));
    }
  };

  // Utility functions
  const isAuthenticated = !!authState.firebaseUser && !!authState.appUser;
  const isConductor = authState.appUser?.role === "conductor";
  const isAdmin = authState.appUser?.role === "admin";
  const isSuperAdmin = authState.appUser?.role === "super-admin";
  const isAdminOrAbove = isAdmin || isSuperAdmin;

  const checkPermission = (permission: Permission): boolean => {
    if (!authState.appUser) return false;
    return hasPermission(authState.appUser.role, permission);
  };

  const canAccessAdminPanel = (): boolean => {
    return checkPermission("system.admin");
  };

  const canUseGoogleAuth = (): boolean => {
    return checkPermission("google.auth");
  };

  const canManageUsers = (): boolean => {
    return checkPermission("users.create");
  };

  return {
    ...authState,
    signOut,
    isAuthenticated,
    isConductor,
    isAdmin,
    isSuperAdmin,
    isAdminOrAbove,
    checkPermission,
    canAccessAdminPanel,
    canUseGoogleAuth,
    canManageUsers,
  };
};

export default useFirebaseAuth;
