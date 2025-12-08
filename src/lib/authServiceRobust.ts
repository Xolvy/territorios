import {
  User,
  // GoogleAuthProvider,
  EmailAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  // signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithCredential,
  updateProfile,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  linkWithCredential,
  unlink,
  fetchSignInMethodsForEmail,
  ConfirmationResult,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// Enhanced User Profile Interface
export interface UserProfile {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  photoURL: string | null;
  role: "super_admin" | "admin" | "conductor" | "viewer";
  permissions: UserPermission[];
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  linkedProviders: string[];
  createdAt: any;
  updatedAt: any;
  lastLogin: any;
  createdBy?: string; // Admin who created this user
  metadata?: {
    firstLogin: any;
    loginCount: number;
    preferredLanguage: string;
    timezone: string;
    theme: "light" | "dark" | "system";
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
}

export interface UserPermission {
  resource: string; // "territories", "conductors", "reports", etc.
  actions: string[]; // ["read", "write", "delete", "admin"]
  conditions?: any; // Additional conditions
}

export interface AuthMethod {
  id: "google" | "email" | "phone";
  name: string;
  icon: string;
  description: string;
  available: boolean;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  phoneNumber?: string;
  verificationCode?: string;
  recaptchaToken?: string;
}

export interface SignupData extends LoginCredentials {
  displayName: string;
  acceptedTerms: boolean;
}

// Auth Service Class
export class RobustAuthService {
  private static instance: RobustAuthService;
  private currentUser: UserProfile | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private phoneConfirmation: ConfirmationResult | null = null;
  private authStateListeners: Array<(user: UserProfile | null) => void> = [];

  private constructor() {
    this.initializeAuthStateListener();
  }

  static getInstance(): RobustAuthService {
    if (!RobustAuthService.instance) {
      RobustAuthService.instance = new RobustAuthService();
    }
    return RobustAuthService.instance;
  }

  // Initialize auth state listener
  private initializeAuthStateListener() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userProfile = await this.getUserProfile(firebaseUser.uid);
          if (userProfile) {
            // Update last login
            await this.updateUserLastLogin(firebaseUser.uid);
            this.currentUser = userProfile;
          } else {
            // Create new user profile if doesn't exist
            this.currentUser = await this.createUserProfile(firebaseUser);
          }
        } catch (error) {
          console.error("Error loading user profile:", error);
          this.currentUser = null;
        }
      } else {
        this.currentUser = null;
      }

      // Notify all listeners
      this.authStateListeners.forEach((listener) => listener(this.currentUser));
    });
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    this.authStateListeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  // Get available authentication methods
  getAvailableAuthMethods(): AuthMethod[] {
    return [
      {
        id: "email",
        name: "Email",
        icon: "📧",
        description: "Email y contraseña",
        available: true,
      },
      {
        id: "phone",
        name: "Teléfono",
        icon: "📱",
        description: "Número de celular",
        available: true,
      },
    ];
  }

  // Google Sign In disabled

  // Email/Password Sign In
  async signInWithEmail(email: string, password: string): Promise<UserProfile> {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      let userProfile = await this.getUserProfile(user.uid);
      if (!userProfile) {
        userProfile = await this.createUserProfile(user);
      }

      return userProfile;
    } catch (error: any) {
      console.error("Email sign in error:", error);
      throw this.handleAuthError(error);
    }
  }

  // Email/Password Sign Up
  async signUpWithEmail(signupData: SignupData): Promise<UserProfile> {
    try {
      if (!signupData.email || !signupData.password) {
        throw new Error("Email and password are required");
      }

      // Check if email is already in use
      const signInMethods = await fetchSignInMethodsForEmail(
        auth,
        signupData.email
      );
      if (signInMethods.length > 0) {
        throw new Error("El email ya está en uso. Intenta iniciar sesión.");
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        signupData.email,
        signupData.password
      );

      const user = result.user;

      // Update display name
      if (signupData.displayName) {
        await updateProfile(user, { displayName: signupData.displayName });
      }

      // Send email verification
      await sendEmailVerification(user);

      // Create user profile
      const userProfile = await this.createUserProfile(user, {
        displayName: signupData.displayName,
      });

      return userProfile;
    } catch (error: any) {
      console.error("Email sign up error:", error);
      throw this.handleAuthError(error);
    }
  }

  // Initialize phone authentication
  initializePhoneAuth(containerId: string = "recaptcha-container"): void {
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier.clear();
    }

    this.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        console.log("reCAPTCHA solved");
      },
      "expired-callback": () => {
        console.log("reCAPTCHA expired");
      },
    });
  }

  // Send SMS verification code
  async sendPhoneVerificationCode(phoneNumber: string): Promise<void> {
    try {
      if (!this.recaptchaVerifier) {
        throw new Error("reCAPTCHA not initialized");
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      this.phoneConfirmation = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        this.recaptchaVerifier
      );

      console.log("SMS sent successfully");
    } catch (error: any) {
      console.error("Phone verification error:", error);
      throw this.handleAuthError(error);
    }
  }

  // Verify SMS code and sign in
  async verifyPhoneCode(verificationCode: string): Promise<UserProfile> {
    try {
      if (!this.phoneConfirmation) {
        throw new Error("No hay solicitud de verificación pendiente");
      }

      const result = await this.phoneConfirmation.confirm(verificationCode);
      const user = result.user;

      let userProfile = await this.getUserProfile(user.uid);
      if (!userProfile) {
        userProfile = await this.createUserProfile(user);
      } else {
        // Update phone verification status
        await this.updateUserProfile(user.uid, {
          isPhoneVerified: true,
          updatedAt: serverTimestamp(),
        });
      }

      return userProfile;
    } catch (error: any) {
      console.error("Phone verification error:", error);
      throw this.handleAuthError(error);
    }
  }

  // Format phone number to E.164 format
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, "");

    // Add Mexico country code if not present
    if (digits.length === 10) {
      return `+52${digits}`;
    } else if (digits.length === 12 && digits.startsWith("52")) {
      return `+${digits}`;
    } else if (digits.length === 13 && digits.startsWith("52")) {
      return `+${digits}`;
    }

    return `+${digits}`;
  }

  // Create user profile in Firestore
  private async createUserProfile(
    firebaseUser: User,
    additionalData?: Partial<UserProfile>
  ): Promise<UserProfile> {
    const userProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      phoneNumber: firebaseUser.phoneNumber,
      displayName:
        firebaseUser.displayName || additionalData?.displayName || "Usuario",
      photoURL: firebaseUser.photoURL,
      role: "conductor", // Default role
      permissions: this.getDefaultPermissions("conductor"),
      isActive: true,
      isEmailVerified: firebaseUser.emailVerified,
      isPhoneVerified: !!firebaseUser.phoneNumber,
      linkedProviders: firebaseUser.providerData.map((p) => p.providerId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      metadata: {
        firstLogin: serverTimestamp(),
        loginCount: 1,
        preferredLanguage: "es",
        timezone: "America/Mexico_City",
        theme: "system",
        notifications: {
          email: true,
          push: true,
          sms: true,
        },
      },
      ...additionalData,
    };

    // Remove undefined fields before persisting
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

    await setDoc(doc(db, "users", firebaseUser.uid), clean(userProfile));
    return userProfile;
  }

  // Get user profile from Firestore
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await updateDoc(doc(db, "users", uid), {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    });
  }

  // Update user last login
  private async updateUserLastLogin(uid: string): Promise<void> {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        "metadata.loginCount": arrayUnion(1),
      });
    } catch (error) {
      console.error("Error updating last login:", error);
    }
  }

  // Get default permissions by role
  private getDefaultPermissions(role: UserProfile["role"]): UserPermission[] {
    const permissionsByRole = {
      super_admin: [{ resource: "*", actions: ["*"] }],
      admin: [
        { resource: "territories", actions: ["read", "write", "delete"] },
        { resource: "conductors", actions: ["read", "write", "delete"] },
        { resource: "reports", actions: ["read", "write"] },
        { resource: "users", actions: ["read", "write"] },
      ],
      conductor: [
        { resource: "territories", actions: ["read"] },
        { resource: "assignments", actions: ["read", "write"] },
        { resource: "reports", actions: ["read"] },
      ],
      viewer: [
        { resource: "territories", actions: ["read"] },
        { resource: "reports", actions: ["read"] },
      ],
    };

    return permissionsByRole[role] || permissionsByRole.conductor;
  }

  // Check if user has permission
  hasPermission(
    resource: string,
    action: string,
    user?: UserProfile | null
  ): boolean {
    const userProfile = user || this.currentUser;
    if (!userProfile || !userProfile.isActive) return false;

    // Super admin has all permissions
    if (userProfile.role === "super_admin") return true;

    // Check specific permissions
    return userProfile.permissions.some((permission) => {
      const hasResource =
        permission.resource === "*" || permission.resource === resource;
      const hasAction =
        permission.actions.includes("*") || permission.actions.includes(action);
      return hasResource && hasAction;
    });
  }

  // Admin functions - Grant admin role
  async grantAdminRole(targetUid: string, grantedBy: string): Promise<void> {
    // Verify granter is admin
    if (!this.hasPermission("users", "admin")) {
      throw new Error("No tienes permisos para otorgar roles de administrador");
    }

    await this.updateUserProfile(targetUid, {
      role: "admin",
      permissions: this.getDefaultPermissions("admin"),
      updatedAt: serverTimestamp(),
      createdBy: grantedBy,
    });
  }

  // Revoke admin role
  async revokeAdminRole(targetUid: string): Promise<void> {
    // Verify current user is admin
    if (!this.hasPermission("users", "admin")) {
      throw new Error("No tienes permisos para revocar roles de administrador");
    }

    await this.updateUserProfile(targetUid, {
      role: "conductor",
      permissions: this.getDefaultPermissions("conductor"),
      updatedAt: serverTimestamp(),
    });
  }

  // Get all users (admin only)
  async getAllUsers(): Promise<UserProfile[]> {
    if (!this.hasPermission("users", "read")) {
      throw new Error("No tienes permisos para ver usuarios");
    }

    const usersQuery = query(
      collection(db, "users"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(usersQuery);
    return snapshot.docs.map((doc) => doc.data() as UserProfile);
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
      this.currentUser = null;
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  // Handle auth errors
  private handleAuthError(error: any): Error {
    const errorMessages = {
      "auth/user-not-found": "Usuario no encontrado",
      "auth/wrong-password": "Contraseña incorrecta",
      "auth/email-already-in-use": "El email ya está en uso",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
      "auth/invalid-email": "Email inválido",
      "auth/user-disabled": "Usuario deshabilitado",
      "auth/too-many-requests":
        "Demasiados intentos fallidos. Intenta más tarde",
      "auth/network-request-failed": "Error de conexión",
      "auth/invalid-phone-number": "Número de teléfono inválido",
      "auth/invalid-verification-code": "Código de verificación inválido",
      "auth/code-expired": "El código de verificación ha expirado",
    };

    const message =
      errorMessages[error.code as keyof typeof errorMessages] || error.message;
    return new Error(message);
  }
}

// Export singleton instance
export const robustAuthService = RobustAuthService.getInstance();
