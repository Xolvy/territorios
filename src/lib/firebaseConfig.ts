// DEPRECATED: This file is completely disabled to prevent Firebase initialization conflicts
// Use src/lib/firebase.ts instead, which respects .env.local offline configuration

console.warn(
  "🚫 firebaseConfig.ts is DEPRECATED and disabled - redirecting to firebase.ts"
);

// Import from the correct firebase configuration
import { app, db, auth, isFirebaseEnabled } from "./firebase";

// Disabled analytics to prevent initialization
const analytics = null;

// Re-export everything from the main firebase configuration
export { app, db, auth, analytics, isFirebaseEnabled };
export default { app, db, auth, analytics, isFirebaseEnabled };
