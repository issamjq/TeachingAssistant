// Thin wrapper around Firebase Auth so the rest of the app touches one
// import surface. Keeps signInWithPopup, signOut, getIdToken, and the
// onAuthStateChanged subscription in one place.
//
// Token freshness: getIdToken(false) returns a cached token if it's
// still valid (~1 hour), or auto-refreshes if it isn't. The api()
// helper uses this on every request — no manual refresh logic needed.
import {
  signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged, GoogleAuthProvider,
} from "firebase/auth";
import { auth, googleProvider, microsoftProvider } from "./firebase";

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  // For analytics / debugging — the credential includes the Google
  // OAuth access token, which we don't currently use but might want
  // later (e.g. read the user's Google Calendar).
  GoogleAuthProvider.credentialFromResult(result);
  return result.user; // { uid, email, displayName, photoURL, ... }
}

// Microsoft / Outlook sign-in. Identical flow to Google — Firebase
// hides the OAuth back-and-forth and returns the same User shape, so
// downstream code (bootstrap, name pre-fill, audit) doesn't branch by
// provider. The MS access token sits on the result if we ever want to
// read mailboxes / calendars later; we drop it for now.
export async function signInWithMicrosoft() {
  const result = await signInWithPopup(auth, microsoftProvider);
  return result.user;
}

export async function signOut() {
  return fbSignOut(auth);
}

// Returns the current Firebase ID token, refreshing it if expired.
// Returns null when no user is signed in.
export async function getIdToken(forceRefresh = false) {
  const u = auth.currentUser;
  if (!u) return null;
  return u.getIdToken(forceRefresh);
}

// Subscribe to auth state changes. The callback receives the User or
// null. Returns an unsubscribe function — pair with useEffect cleanup.
export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

// Current Firebase user (may be null). Sync — safe to read in render.
export function currentUser() {
  return auth.currentUser;
}
