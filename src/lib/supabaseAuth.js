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
    displayName:
      meta.full_name ||
      meta.name ||
      // LinkedIn OIDC sends the parts, not a joined name.
      [meta.given_name, meta.family_name].filter(Boolean).join(" ") ||
      "",
    // Kept separate as well as joined: splitting a display name on
    // whitespace guesses wrong for anyone with two given names or a
    // compound family name, and LinkedIn already tells us the answer.
    firstName: meta.given_name || "",
    lastName: meta.family_name || "",
    photoURL: meta.avatar_url || meta.picture || "",
    locale: meta.locale || null,
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
/**
 * @param {string} [next] Where the provider should return to. Defaults to
 *   the teacher sign-in screen.
 *
 *   The default was the only option, and it sent EVERY Google sign-in to
 *   "/signin" — including a student's. They picked their account, came
 *   back to the teacher door, and were asked to sign in a second time;
 *   any `?join=` on the invitation link was dropped on the way, so the
 *   class they had followed the email to join never joined.
 *
 *   Whatever is passed must also be listed in Supabase → Authentication →
 *   URL Configuration → Redirect URLs, or Supabase substitutes the Site
 *   URL and the caller silently gets the old behaviour back.
 */
export async function signInWithGoogle(next) {
  unwrap(
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // "/signin", NOT "/". The funnel-resume effect that exchanges the
        // provider return into a routed session lives in the auth screens;
        // "/" is the marketing page, which used to leave a freshly
        // signed-in teacher standing on the hero with nowhere to go. The
        // marketing page also carries a forwarding shim in case the
        // Supabase redirect allowlist ever falls back to the site root.
        redirectTo: next ? redirectTo(next) : redirectTo("/signin"),
        // Force the account chooser every time, so a teacher signed into
        // several Google accounts in one browser can pick the right one.
        // Without this Google silently reuses the last account.
        queryParams: { prompt: "select_account" },
      },
    })
  );
  return null; // navigation is in flight; nothing to return
}

// LinkedIn. Supabase calls this provider "linkedin_oidc" — the older
// "linkedin" provider is the deprecated v1 API and is disabled on this
// project.
//
// Worth knowing what this can and cannot give us: the OIDC scopes below
// return the member's name, email and picture. Positions, employer,
// education and skills are NOT part of OpenID Connect — reading those
// needs LinkedIn Partner Program approval, which is an application, not
// a scope. So this fills the identity fields and nothing more; subjects
// and grades still have to come from the teacher or from a CV.
export async function signInWithLinkedIn() {
  unwrap(
    await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        // "/signin", NOT "/". The funnel-resume effect that exchanges the
        // provider return into a routed session lives in the auth screens;
        // "/" is the marketing page, which used to leave a freshly
        // signed-in teacher standing on the hero with nowhere to go. The
        // marketing page also carries a forwarding shim in case the
        // Supabase redirect allowlist ever falls back to the site root.
        redirectTo: redirectTo("/signin"),
        scopes: "openid profile email",
      },
    })
  );
  return null; // navigation is in flight
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
        // "/signin", NOT "/". The funnel-resume effect that exchanges the
        // provider return into a routed session lives in the auth screens;
        // "/" is the marketing page, which used to leave a freshly
        // signed-in teacher standing on the hero with nowhere to go. The
        // marketing page also carries a forwarding shim in case the
        // Supabase redirect allowlist ever falls back to the site root.
        redirectTo: redirectTo("/signin"),
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

/**
 * Email a student the link that signs them in, from the teacher's client.
 *
 * This is the only mail this repo can send. Supabase Auth's mailer is
 * reachable with the publishable key; everything else (Resend) lives on
 * the separate backend and is still in test mode. So the invite IS the
 * magic link — there is no separate "you've been added" notification.
 *
 * `shouldCreateUser` stays true on purpose: an invited student has no
 * auth identity yet, and the row a teacher typed is not one. The account
 * it mints is inert until link_student_account() claims a roster row for
 * it (db/tune.sql §35), and it cannot become a teacher — §36's trigger
 * makes the profile row a teacher by default, but with no faculty row
 * behind it the studio never opens.
 *
 * Lands on /student, which resolves the session into a student and
 * routes to their dashboard.
 *
 * Two things must be true in the Supabase dashboard for this to arrive:
 *
 *   1. the redirect URL is allowlisted (Authentication → URL configuration);
 *   2. the **Magic Link template** points at `/student` with a token hash:
 *
 *        <a href="{{ .SiteURL }}/student?token_hash={{ .TokenHash }}&type=magiclink">
 *
 *      This client runs `flowType: "pkce"`, and the default template's
 *      ConfirmationURL comes back as `?code=…`, which is worthless without
 *      the verifier held in the browser that ASKED for it. That browser is
 *      the teacher's; the student clicks on their own device. A token hash
 *      carries no device state, so it survives the hop — see the
 *      verifyOtp() branch in StudentSignIn.
 *
 * Supabase's built-in SMTP is rate-limited to a handful of messages an
 * hour. Configure a custom SMTP provider before inviting a whole class.
 */
export async function sendStudentInvite(email) {
  unwrap(
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo("/student"), shouldCreateUser: true },
    })
  );
}

// Complete a cross-device magic link: ?token_hash=…&type=… carries no PKCE
// verifier, so it is verified rather than exchanged. Returns the user, or
// null when the URL holds no token hash (the same-device ?code= links are
// already exchanged by detectSessionInUrl before anything calls here).
export async function completeTokenHashSignIn(url) {
  if (typeof window === "undefined") return null;
  const u = new URL(url || window.location.href);
  const token_hash = u.searchParams.get("token_hash");
  const type = u.searchParams.get("type");
  if (!token_hash || !type) return null;
  const data = unwrap(await supabase.auth.verifyOtp({ token_hash, type }));
  return normalizeUser(data.user ?? data.session?.user);
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

/**
 * One entry point for "here is my email and password" — the single-page
 * auth the landing now uses.
 *
 * The problem it solves: GoTrue answers `invalid_credentials` for BOTH a
 * wrong password and an unknown email, deliberately, so a login form
 * can't be used to discover which addresses have accounts. That is the
 * right default, and it makes "you already have an account, check your
 * password" impossible to say from the sign-in call alone.
 *
 * So: try to sign in. If that fails on credentials, try to sign up. The
 * sign-up answer disambiguates what the sign-in could not —
 * `user_already_exists` means the address is taken, which means the
 * password was simply wrong. Anything else is a genuine new account.
 *
 * Sign-in is attempted FIRST on purpose. The other order would create an
 * account as a side effect of a typo'd password.
 *
 * @returns {{ user: object, isNew: boolean }}
 */
export async function signInOrSignUp(email, password) {
  try {
    const data = unwrap(await supabase.auth.signInWithPassword({ email, password }));
    return { user: normalizeUser(data.user), isNew: false };
  } catch (signInError) {
    // Only ambiguous credential failures are worth a second attempt.
    // A rate limit or a network fault must surface as itself.
    if (signInError?.code !== "invalid_credentials") throw signInError;

    try {
      const data = unwrap(
        await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo("/") },
        })
      );
      return { user: normalizeUser(data.user), isNew: true };
    } catch (signUpError) {
      const taken =
        signUpError?.code === "user_already_exists" ||
        signUpError?.code === "email_exists";
      if (!taken) throw signUpError;
      // The address exists, so the password they gave is the wrong one.
      throw Object.assign(new Error("Wrong password for this account."), {
        code: "wrong_password",
      });
    }
  }
}

// Send a password reset email. Supabase emails a recovery link; clicking
// it returns the user to the app with a live session in "recovery" mode,
// at which point updatePassword() below sets the new one. (Firebase
// hosted its own reset page — with Supabase the reset UI is ours.)
export async function sendPasswordReset(email) {
  unwrap(
    await supabase.auth.resetPasswordForEmail(email, {
      // A real screen, not a query flag on the marketing page. The old
      // "/?resetPassword=1" was read by nothing: EntryGate saw the fresh
      // recovery session and bounced her to the dashboard with the
      // password still unchanged.
      redirectTo: redirectTo("/reset-password"),
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
