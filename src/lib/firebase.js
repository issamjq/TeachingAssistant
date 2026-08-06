// Firebase Web SDK — initialised once at module import.
//
// Configuration comes from src/config/env.ts (NEXT_PUBLIC_FIREBASE_* env
// vars). Analytics is initialised lazily on the client only — it crashes
// during SSR / first server render and we don't need it server-side anyway.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { firebaseConfig } from "../config/env";

// Next fast-refreshes the module on save; guard against double-init.
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
