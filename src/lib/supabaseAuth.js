"use client";

// Thin wrapper around Supabase Auth so the rest of the app touches one
// import surface. Replaces src/lib/firebaseAuth.js.
//
// The export names and return shapes here deliberately match the old
// Firebase module one-for-one, so the ~18 call sites across Landing,
// Studio, StudioShell, PortalSignIn and apiClient only changed their
// import path. See normalizeUser() for the shape contract.
//
// Token freshness: getSession() returns the cached access token and
// refreshes it transparently when it's close to expiry (supabase-js runs
// autoRefreshToken in the background). The api() helper calls this on
// every request — no manual refresh logic needed, same as before.
import { supabase } from "./supabaseClient";

// ── User shape adapter ────────────────────────────────────────────────
//
// Supabase and Firebase describe a user differently:
//
//   Firebase          Supabase
//   ---------------   ---------------------------------------
//   uid               id
//   email             email
//   displayName       user_metadata.full_name / .name
//   photoURL          user_metadata.avatar_url / .picture
//   emailVerified     email_confirmed_at != null
//
// Call sites already destructure the Firebase names, so we adapt here
// rather than editing every consumer. Google populates both full_name
// and name; Azure sends name only — accept either.
function normalizeUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    uid: user.id,
    email: user.email || meta.email || "",
    displayName: meta.full_name || meta.name || "",
    photoURL: meta.avatar_url || meta.picture || "",
    emailVerified: Boolean(user.email_confirmed_at),
    provider: user.app_metadata?.provider || null,
    // The untouched Supabase user, for anything not mapped above.
    raw: user,
  };
}

// Supabase returns errors as a value ({ data, error }) rather than
// throwing. Every call site here was written against a throwing API, so
// we rethrow — and carry `code` across, because the sign-in screens
// branch on error codes.
function unwrap({ data, error }) {
  if (error) {
    const e = new Error(error.message);
    e.code = error.code || error.name || "supabase_error";
    e.status = error.status;
    throw e;
  }
  return data;
}

// Where the browser should land after an OAuth / email-link round trip.
// Must be registered in the Supabase dashboard under
// Authentication → URL Configuration → Redirect URLs, or Supabase
// refuses the redirect and sends the user to the Site URL instead.
function redirectTo(path = "/") {
  if (typeof window === "undefined") return undefined;
  return window.location.origin + path;
}

// ── OAuth ─────────────────────────────────────────────────────────────
//
// IMPORTANT behavioural change from Firebase: these do NOT return a
// user. Firebase's signInWithPopup opened a popup and resolved with the
// signed-in user, so callers could `const user = await signInWithGoogle()`.
// Supabase performs a full top-level redirect: the page navigates away
// and this promise never resolves with a user.
//
// Callers must instead react to the session arriving — either via
// onAuthChange() or by reading getCurrentUser() after the redirect
// completes. The sign-in screens were updated accordingly.
export async function signInWithGoogle() {
  unwrap(
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo("/"),
        // Force the account chooser every time, so a teacher signed into
        // several Google accounts in one browser can pick the right one.
        // Without this Google silently reuses the last account.
        queryParams: { prompt: "select_account" },
      },
    })
  );
  return null; // navigation is in flight; nothing to return
}

// Microsoft / Outlook. Supabase calls this provider "azure" (it fronts
// the Microsoft identity platform); it must be enabled in the dashboard
// with an Azure app registration of its own — the Firebase Microsoft
// provider config does NOT carry over.
export async function signInWithMicrosoft() {
  unwrap(
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: redirectTo("/"),
        // openid/email/profile are what populate user_metadata; without
        // them the display name and avatar come back empty.
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    })
  );
  return null;
}

export async function signOut() {
  return unwrap(await supabase.auth.signOut());
}

// ── Email link (passwordless) sign-in ─────────────────────────────────
//
// Works for any email provider. Supabase emails a magic link; the user
// clicks it, comes back to the app, and supabase-js completes the
// sign-in automatically (detectSessionInUrl in supabaseClient.ts).
//
// Unlike Firebase, there is nothing to stash in localStorage between
// send and click: the PKCE verifier is stored by the SDK itself, and
// the email is carried in the link. That removes the old
// "clicked the link on a different device" failure mode, so the
// fallbackEmail argument below is accepted but no longer needed.
export async function sendEmailLink(email) {
  unwrap(
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo("/?completeEmailSignIn=1") },
    })
  );
}

// Returns true if the current URL looks like a Supabase auth callback.
// PKCE links come back as ?code=…; older/alternate links use
// #access_token=… or ?token_hash=…&type=…. Accept all three.
export function isEmailSignInLink(url) {
  try {
    const u = new URL(url || window.location.href);
    return Boolean(
      u.searchParams.get("code") ||
        u.searchParams.get("token_hash") ||
        /(^|&)access_token=/.test(u.hash.replace(/^#/, ""))
    );
  } catch {
    return false;
  }
}

// Complete an email-link sign-in.
//
// In almost every case supabase-js has already done this by the time
// anything calls here — detectSessionInUrl exchanges the code during
// client construction. So we check for an existing session first and
// only fall back to an explicit exchange if there isn't one (e.g. the
// exchange raced with a hard navigation).
export async function completeEmailLinkSignIn(url, _fallbackEmail) {
  const existing = await supabase.auth.getSession();
  if (existing.data?.session) return normalizeUser(existing.data.session.user);

  const code = new URL(url || window.location.href).searchParams.get("code");
  if (!code) {
    const err = new Error("This sign-in link is invalid or has already been used.");
    err.code = "auth/invalid-email-link";
    throw err;
  }
  const data = unwrap(await supabase.auth.exchangeCodeForSession(code));
  return normalizeUser(data.user ?? data.session?.user);
}

// ── Email + password ──────────────────────────────────────────────────

export async function signUpWithEmail(email, password) {
  const data = unwrap(
    await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo("/") },
    })
  );
  return normalizeUser(data.user);
}

export async function signInWithEmail(email, password) {
  const data = unwrap(
    await supabase.auth.signInWithPassword({ email, password })
  );
  return normalizeUser(data.user);
}

// Send a password reset email. Supabase emails a recovery link; clicking
// it returns the user to the app with a live session in "recovery" mode,
// at which point updatePassword() below sets the new one. (Firebase
// hosted its own reset page — with Supabase the reset UI is ours.)
export async function sendPasswordReset(email) {
  unwrap(
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo("/?resetPassword=1"),
    })
  );
}

// Set a new password for the currently-signed-in (or recovery-session)
// user. No Firebase equivalent was needed because Firebase hosted the
// reset form itself.
export async function updatePassword(newPassword) {
  const data = unwrap(await supabase.auth.updateUser({ password: newPassword }));
  return normalizeUser(data.user);
}

// ── Session ───────────────────────────────────────────────────────────

// Returns the current access token, refreshing it if it's expired.
// Returns null when no user is signed in.
//
// The old Firebase version needed an authStateReady() gate so a hard
// refresh of a deep URL wouldn't fire api() before the SDK had restored
// the user from IndexedDB. getSession() already awaits that restore
// internally, so the race is handled for us.
export async function getIdToken(forceRefresh = false) {
  if (forceRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    // A failed refresh means the session is genuinely gone (revoked,
    // expired beyond recovery) — report signed-out rather than throwing
    // into every api() caller.
    if (refreshed.error) return null;
    return refreshed.data.session?.access_token ?? null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

// Subscribe to auth state changes. The callback receives the normalized
// user (or null). Returns an unsubscribe function — pair with useEffect
// cleanup, exactly like the Firebase version.
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(normalizeUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}

// Current user, async.
//
// NOTE: this differs from the Firebase module, whose currentUser() was
// synchronous and safe to read during render. Supabase has no equivalent
// synchronous accessor — the session lives in storage and is read
// asynchronously — so callers must await. Every call site was updated.
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return normalizeUser(data.session?.user ?? null);
}
