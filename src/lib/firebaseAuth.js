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
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, fetchSignInMethodsForEmail,
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

// ── Email link (passwordless) sign-in ─────────────────────────────────
//
// Works for ANY email provider — Outlook, Hotmail, Gmail, school emails,
// anything. Firebase sends a magic link, the user clicks it, comes back
// to murchid.com, and we complete the sign-in. No password, no OAuth
// publisher verification, no provider config drama.
//
// Storage: we stash the email in localStorage between sendLink and
// the user clicking the link, because Firebase needs it again to
// complete the sign-in (this is the security measure that ties the
// link to the device that requested it).
const PENDING_EMAIL_KEY = "murchid.emaillink.pending";

export async function sendEmailLink(email) {
  const actionCodeSettings = {
    // After the user clicks the email link, they come back to this
    // URL. We detect the link on boot (main.jsx) and complete sign-in.
    url: window.location.origin + "/?completeEmailSignIn=1",
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  // Persist so completeEmailLinkSignIn() can read it after the round-trip.
  try { localStorage.setItem(PENDING_EMAIL_KEY, email); } catch { /* ignore */ }
}

// Returns true if the current URL is a Firebase email sign-in link.
export function isEmailSignInLink(url) {
  return isSignInWithEmailLink(auth, url);
}

// Complete the email-link sign-in. Reads the pending email from local
// storage (set during sendEmailLink). If absent — e.g. the user clicked
// the link on a different device — we prompt the caller to ask for the
// email again before calling this.
export async function completeEmailLinkSignIn(url, fallbackEmail) {
  let email = fallbackEmail;
  if (!email) {
    try { email = localStorage.getItem(PENDING_EMAIL_KEY) || ""; } catch { /* ignore */ }
  }
  if (!email) {
    const err = new Error("Email address required to complete sign-in.");
    err.code = "auth/email-required-for-completion";
    throw err;
  }
  const result = await signInWithEmailLink(auth, email, url);
  try { localStorage.removeItem(PENDING_EMAIL_KEY); } catch { /* ignore */ }
  return result.user;
}

// ── Email + password ──────────────────────────────────────────────────
//
// The primary auth path for users who don't want a Google account or
// Microsoft enterprise consent dance. Set once at sign-up, used
// instantly forever after. Magic-link sign-in stays available as the
// "Forgot password" recovery and new-device fallback.

export async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

// Send a password reset email. Firebase emails a link that opens
// Firebase's own reset page; after the user picks a new password, they
// come back to murchid.com and can sign in.
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

// Check whether an email already has any sign-in method registered.
// Returns an array of providers ("password", "google.com", etc.) —
// empty array means the email is available to sign up.
//
// Caveat: when Firebase project setting "Email enumeration protection"
// is ON (default for new projects), this ALWAYS returns an empty
// array regardless of whether the email exists, to prevent address
// harvesting. In that case the duplicate check still works at submit
// time (auth/email-already-in-use catches it).
export async function lookupEmailMethods(email) {
  try {
    return await fetchSignInMethodsForEmail(auth, email);
  } catch {
    return [];
  }
}

// One-shot promise that resolves when Firebase has finished restoring
// the user from IndexedDB on a hard refresh. Without this, the very
// first api() call after a reload fires while auth.currentUser is
// still null, attaches no Bearer token, and 401s. We memoise it so
// every later call is free.
//
// Firebase 10+ exposes auth.authStateReady() directly; we fall back
// to onAuthStateChanged for older versions in case the dep range
// ever resolves to an older SDK.
let _authReady = null;
function authStateReady() {
  if (_authReady) return _authReady;
  _authReady = (typeof auth.authStateReady === "function")
    ? auth.authStateReady()
    : new Promise((resolve) => {
        const off = onAuthStateChanged(auth, () => { off(); resolve(); });
      });
  return _authReady;
}

// Returns the current Firebase ID token, refreshing it if expired.
// Waits for Firebase to restore the session before reading
// currentUser — otherwise a refresh of a deep URL like /account would
// race past the SDK and end up unauthenticated. Returns null when no
// user is actually signed in.
export async function getIdToken(forceRefresh = false) {
  await authStateReady();
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
