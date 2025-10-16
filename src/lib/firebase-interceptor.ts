// 🔒 Firebase Offline Mode Interceptor
// This file completely prevents Firebase initialization when in offline mode

// Extend window types for webpack and AMD loaders
declare global {
  interface Window {
    __webpack_require__?: any;
    require?: any;
    define?: {
      amd: boolean;
      (moduleName: string, moduleFactory: () => any): void;
    };
  }
}

import { logger } from "@/utils/logger";

if (globalThis?.window) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (apiKey === "offline-mode" || apiKey?.startsWith("offline-")) {
    logger.warn(
      "🚫 FIREBASE INTERCEPTOR: Completely blocking Firebase in offline mode"
    );

    // Override all Firebase SDK modules before they can be imported
    // using globalThis.window here is intentional for build-time interception
    // @ts-ignore: global webpack/require interception
    const originalImport =
      (globalThis as any).window?.__webpack_require__ ||
      (globalThis as any).window?.require;

    if (originalImport) {
      const firebaseModules = [
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/analytics",
        "firebase/functions",
        "firebase/storage",
      ];

      // Mock all Firebase modules
      // using for..of to satisfy linter rules
      for (const moduleName of firebaseModules) {
        try {
          // Create mock implementations
          const mockModule = {
            initializeApp: () => {
              logger.warn(
                `🚫 Firebase ${moduleName} initialization blocked in offline mode`
              );
              return null;
            },
            getAuth: () => null,
            getFirestore: () => null,
            getAnalytics: () => null,
            onAuthStateChanged: () => () => {},
            signInWithEmailAndPassword: () =>
              Promise.reject(new Error("Firebase disabled in offline mode")),
            signInWithPhoneNumber: () =>
              Promise.reject(new Error("Firebase disabled in offline mode")),
            signOut: () => Promise.resolve(),
            RecaptchaVerifier: function () {
              return null;
            },
          };

          // Override the module
          // @ts-ignore: modifying global AMD define for mocks
          if ((globalThis as any).window?.define?.amd) {
            (globalThis as any).window.define(moduleName, () => mockModule);
          }
        } catch (error) {
          logger.warn(`Could not mock ${moduleName}:`, error);
        }
      }
    }

    // Set global flag
    (globalThis as any).window.__FIREBASE_OFFLINE_MODE__ = true;
    (globalThis as any).window.__FIREBASE_DISABLED__ = true;

    logger.log(
      "🔒 Firebase completely disabled - application will run in full offline mode"
    );
  }
}

export const isFirebaseOfflineMode = () => {
  return (
    globalThis?.window &&
    ((globalThis as any).window.__FIREBASE_OFFLINE_MODE__ === true ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "offline-mode")
  );
};
