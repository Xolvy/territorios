import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  linkWithCredential,
  PhoneAuthProvider,
  User as FirebaseUser,
  updateProfile,
} from "firebase/auth";
import { db, auth } from "./firebase";
import {
  AppUser,
  CreateUserRequest,
  UpdateUserRequest,
  UserStats,
  isSuperAdmin,
} from "../types/user";

class UserService {
  private COLLECTION_NAME = "users";

  private getUserRef(uid: string) {
    return doc(db, this.COLLECTION_NAME, uid);
  }

  private getUsersCollection() {
    return collection(db, this.COLLECTION_NAME);
  }

  /**
   * Crear un nuevo usuario (solo administradores)
   */
  async createUser(
    request: CreateUserRequest,
    createdBy: string
  ): Promise<AppUser> {
    if (!db) throw new Error("Firebase no está configurado");

    // Verificar que el número no exista
    const existingUser = await this.getUserByPhone(request.phoneNumber);
    if (existingUser) {
      throw new Error("Ya existe un usuario con ese número de teléfono");
    }

    // Generar un UID único para el usuario
    const uid = `phone_${request.phoneNumber.replace(/[^0-9]/g, "")}`;

    // Determinar rol automáticamente para super-admin
    const role = isSuperAdmin(request.phoneNumber, undefined, undefined)
      ? "super-admin"
      : request.role;

    const newUser: AppUser = {
      uid,
      phoneNumber: request.phoneNumber,
      fullName: request.fullName,
      serviceGroup: request.serviceGroup,
      role,
      notes: request.notes,
      isActive: true,
      loginCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      linkedProviders: ["phone"],
    };

    await setDoc(this.getUserRef(uid), newUser);

    // Optional: create a Firebase Auth user if email/password provided via env policy
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken(/* forceRefresh */ true);
        const pseudoEmail = `${request.phoneNumber.replace(
          /[^0-9]/g,
          ""
        )}@phone.local`;
        await fetch(`/api/admin/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            email: pseudoEmail,
            password:
              (process.env.NEXT_PUBLIC_DEFAULT_USER_PASSWORD as string) ||
              "Territorios123",
            phoneNumber: request.phoneNumber,
            displayName: request.fullName,
          }),
        });
      }
    } catch (e) {
      console.warn("No se pudo crear el usuario en Firebase Auth:", e);
      // Continue without blocking Firestore creation
    }
    return newUser;
  }

  /**
   * Obtener usuario por número de teléfono
   */
  async getUserByPhone(phoneNumber: string): Promise<AppUser | null> {
    try {
      const q = query(
        this.getUsersCollection(),
        where("phoneNumber", "==", phoneNumber)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { uid: doc.id, ...doc.data() } as AppUser;
    } catch (error) {
      console.error("Error buscando usuario por teléfono:", error);
      return null;
    }
  }

  /**
   * Obtener usuario por UID
   */
  async getUserById(uid: string): Promise<AppUser | null> {
    try {
      const docSnap = await getDoc(this.getUserRef(uid));
      if (!docSnap.exists()) return null;

      return { uid: docSnap.id, ...docSnap.data() } as AppUser;
    } catch (error) {
      console.error("Error obteniendo usuario:", error);
      return null;
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUser(
    uid: string,
    updates: Partial<UpdateUserRequest>
  ): Promise<void> {
    try {
      // Filtrar valores undefined para evitar errores de Firebase
      const cleanUpdates: any = {};
      Object.keys(updates).forEach((key) => {
        if (updates[key as keyof UpdateUserRequest] !== undefined) {
          cleanUpdates[key] = updates[key as keyof UpdateUserRequest];
        }
      });

      const userRef = this.getUserRef(uid);
      await updateDoc(userRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error actualizando usuario:", error);
      throw new Error("Error al actualizar el usuario");
    }
  }

  /**
   * Actualizar número de teléfono del usuario (solo super-admin)
   * Actualiza tanto Firestore como Firebase Auth
   */
  async updateUserPhoneNumber(
    uid: string,
    newPhoneNumber: string,
    updatedBy: string
  ): Promise<void> {
    try {
      // Verificar permisos del usuario que hace la actualización
      const updaterUser = await this.getUserById(updatedBy);
      if (!updaterUser || updaterUser.role !== "super-admin") {
        throw new Error(
          "Solo el super administrador puede cambiar números de teléfono"
        );
      }

      // Verificar que el nuevo número no esté ya en uso
      const existingUser = await this.getUserByPhone(newPhoneNumber);
      if (existingUser && existingUser.uid !== uid) {
        throw new Error("Ya existe un usuario con ese número de teléfono");
      }

      // Obtener el usuario actual para verificar el número anterior
      const currentUser = await this.getUserById(uid);
      if (!currentUser) {
        throw new Error("Usuario no encontrado");
      }

      const oldPhoneNumber = currentUser.phoneNumber;

      // Actualizar en Firestore
      const userRef = this.getUserRef(uid);
      await updateDoc(userRef, {
        phoneNumber: newPhoneNumber,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy,
        phoneNumberHistory: {
          previousNumber: oldPhoneNumber,
          changedAt: serverTimestamp(),
          changedBy: updatedBy,
        },
      });

      // Actualizar el UID si es necesario (basado en nuevo número)
      const newUid = `phone_${newPhoneNumber.replace(/[^0-9]/g, "")}`;
      if (uid !== newUid && uid.startsWith("phone_")) {
        // Si el UID cambió, necesitamos crear un nuevo documento y eliminar el anterior
        const userData = await getDoc(userRef);
        if (userData.exists()) {
          const newUserRef = this.getUserRef(newUid);
          await setDoc(newUserRef, {
            ...userData.data(),
            uid: newUid,
            phoneNumber: newPhoneNumber,
            updatedAt: serverTimestamp(),
            updatedBy: updatedBy,
          });

          // Eliminar el documento anterior
          await deleteDoc(userRef);
        }
      }

      // Intentar actualizar en Firebase Auth usando la API del servidor
      try {
        const response = await fetch("/api/admin/update-phone", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userUid: newUid || uid,
            oldPhoneNumber: oldPhoneNumber,
            newPhoneNumber: newPhoneNumber,
            updatedBy: updatedBy,
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(
            "✅ Actualización de Firebase Auth procesada:",
            result.message
          );
        } else {
          console.warn(
            "⚠️ Error en actualización de Firebase Auth:",
            result.error
          );
        }
      } catch (authError) {
        console.warn(
          "No se pudo actualizar Firebase Auth automáticamente:",
          authError
        );
        // La actualización en Firestore ya se hizo, así que no fallar completamente
      }
    } catch (error) {
      console.error("Error actualizando número de teléfono:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Error al actualizar el número de teléfono"
      );
    }
  }

  /**
   * Registrar último acceso del usuario
   */
  async updateLastLogin(uid: string): Promise<void> {
    try {
      const userRef = this.getUserRef(uid);
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error actualizando último acceso:", error);
      // No lanzar error aquí para no interrumpir el proceso de login
    }
  }

  /**
   * Desactivar usuario
   */
  async deactivateUser(uid: string): Promise<void> {
    try {
      const userRef = this.getUserRef(uid);
      await updateDoc(userRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error desactivando usuario:", error);
      throw new Error("Error al desactivar el usuario");
    }
  }

  /**
   * Activar usuario
   */
  async activateUser(uid: string): Promise<void> {
    try {
      const userRef = this.getUserRef(uid);
      await updateDoc(userRef, {
        isActive: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error activando usuario:", error);
      throw new Error("Error al activar el usuario");
    }
  }

  /**
   * Eliminar usuario permanentemente
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      const userRef = this.getUserRef(uid);
      await deleteDoc(userRef);
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      throw new Error("Error al eliminar el usuario");
    }
  }

  /**
   * Obtener todos los usuarios
   */
  async getAllUsers(): Promise<AppUser[]> {
    try {
      const usersSnapshot = await getDocs(
        query(this.getUsersCollection(), orderBy("createdAt", "desc"))
      );

      return usersSnapshot.docs.map(
        (doc) =>
          ({
            uid: doc.id,
            ...doc.data(),
          } as AppUser)
      );
    } catch (error) {
      console.error("Error obteniendo usuarios:", error);
      throw new Error("Error al obtener la lista de usuarios");
    }
  }

  /**
   * Vincular usuario con Firebase Auth
   */
  async linkFirebaseUser(firebaseUser: FirebaseUser): Promise<AppUser | null> {
    try {
      // Buscar usuario existente por email o UID
      let appUser: AppUser | null = null;

      // Primero buscar por UID específico (tu cuenta)
      if (firebaseUser.uid) {
        appUser = await this.getUserById(firebaseUser.uid);
      }

      // Si no existe por UID, buscar por teléfono
      if (!appUser && firebaseUser.phoneNumber) {
        appUser = await this.getUserByPhone(firebaseUser.phoneNumber);
      }

      // Si no existe y es el super-admin (por cualquier método), crear automáticamente
      if (
        !appUser &&
        isSuperAdmin(
          firebaseUser.phoneNumber || undefined,
          firebaseUser.uid,
          firebaseUser.email || undefined
        )
      ) {
        // Para tu cuenta específica, usar el UID real de Firebase
        const uid = firebaseUser.uid;

        appUser = {
          uid,
          phoneNumber: firebaseUser.phoneNumber || "+593994749286", // Fallback
          email: firebaseUser.email || undefined,
          fullName: firebaseUser.displayName || "Super Administrador",
          role: "super-admin",
          serviceGroup: "",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          linkedProviders: ["password"], // Indicar que usa email/password
          loginCount: 0,
          notes: "Usuario super administrador - Acceso completo al sistema",
        };

        // Guardar directamente en Firestore con el UID de Firebase
        const userRef = this.getUserRef(uid);
        const clean = (obj: any): any => {
          if (obj === null || obj === undefined) return obj;
          if (Array.isArray(obj)) return obj.map(clean);
          if (typeof obj === "object") {
            return Object.fromEntries(
              Object.entries(obj)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, clean(v)])
            );
          }
          return obj;
        };
        await setDoc(
          userRef,
          clean({
            ...appUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        console.log("✅ Super admin creado automáticamente:", uid);
      }

      if (!appUser) {
        console.log("Usuario no encontrado en base de datos local");
        return null;
      }

      // Actualizar información del usuario con datos de Firebase
      const updates: any = {
        lastLogin: serverTimestamp(),
      };

      // Agregar información de email si está disponible
      if (firebaseUser.email && !appUser.email) {
        updates.email = firebaseUser.email;
      }

      // Agregar información de nombre si está disponible
      if (firebaseUser.displayName && !appUser.fullName) {
        updates.fullName = firebaseUser.displayName;
      }

      // Actualizar proveedores vinculados
      const linkedProviders = appUser.linkedProviders || [];
      firebaseUser.providerData.forEach((provider: any) => {
        if (!linkedProviders.includes(provider.providerId)) {
          linkedProviders.push(provider.providerId);
        }
      });
      updates.linkedProviders = linkedProviders;

      await this.updateUser(appUser.uid, updates);

      return {
        ...appUser,
        ...updates,
        lastLogin: new Date(),
      };
    } catch (error) {
      console.error("Error vinculando usuario:", error);
      return null;
    }
  }

  /**
   * Vincular cuenta de Google con usuario existente
   */
  // Google account linking disabled

  /**
   * Obtiene estadísticas de usuarios
   */
  async getUserStats(): Promise<UserStats> {
    try {
      if (!db) {
        return {
          totalUsers: 0,
          activeUsers: 0,
          adminUsers: 0,
          conductorUsers: 0,
          newUsersThisMonth: 0,
          recentLogins: 0,
        };
      }

      const usersSnapshot = await getDocs(this.getUsersCollection());
      const users = usersSnapshot.docs.map(
        (doc) => ({ uid: doc.id, ...doc.data() } as AppUser)
      );

      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.isActive).length,
        adminUsers: users.filter((u) =>
          ["admin", "super-admin"].includes(u.role)
        ).length,
        conductorUsers: users.filter((u) => u.role === "conductor").length,
        newUsersThisMonth: users.filter((u) => {
          const createdAt = u.createdAt;
          if (!createdAt) return false;

          let createdDate: Date;
          if (createdAt instanceof Date) {
            createdDate = createdAt;
          } else if (
            createdAt &&
            typeof (createdAt as any).toDate === "function"
          ) {
            createdDate = (createdAt as any).toDate();
          } else {
            return false;
          }

          return createdDate >= monthAgo;
        }).length,
        recentLogins: users.filter((u) => {
          const lastLogin = u.lastLogin;
          if (!lastLogin) return false;

          let loginDate: Date;
          if (lastLogin instanceof Date) {
            loginDate = lastLogin;
          } else if (
            lastLogin &&
            typeof (lastLogin as any).toDate === "function"
          ) {
            loginDate = (lastLogin as any).toDate();
          } else {
            return false;
          }

          return loginDate >= thirtyDaysAgo;
        }).length,
      };
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        conductorUsers: 0,
        newUsersThisMonth: 0,
        recentLogins: 0,
      };
    }
  }
}

export const userService = new UserService();
export default userService;
