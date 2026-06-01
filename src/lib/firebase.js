// Firebase Web SDK — initialised once at module import.
//
// All VITE_FIREBASE_* values come from .env (and Vercel's project env
// vars in production). Analytics is initialised lazily on the client
// only — it crashes during SSR / first server render and we don't need
// it server-side anyway.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Vite hot-reloads the module on save; guard against double-init.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
// Force the account-chooser to show every time, so a teacher who's
// signed into multiple Google accounts in the same browser can pick
// the right one. Without this, Google silently re-uses the last one.
googleProvider.setCustomParameters({ prompt: "select_account" });

// Microsoft (Outlook + work + personal MS accounts). The provider ID
// must be exactly "microsoft.com" — that's how Firebase routes the
// OAuth flow to the right Azure handler. The same `prompt=select_account`
// trick forces the account chooser so multi-account users don't get
// silently re-signed-in with the wrong identity.
export const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.setCustomParameters({ prompt: "select_account" });
