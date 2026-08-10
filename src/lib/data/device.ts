// =====================================================================
// Single-device sign-in, without a server to enforce it
//
// The account stays active on one device at a time. That used to be an
// Express middleware comparing a header; with the browser talking to
// Postgres directly there is no middleware, so the database asks
// instead — `is_current_device()` in db/tune.sql compares
// `users.active_session_id` against the `session_id` claim carried by
// every Supabase access token.
//
// The claim is the point: it is IN the signed token, so a browser cannot
// forge it and no custom header has to be plumbed through PostgREST.
//
// Two halves live here:
//   claimDevice()  taking over on sign-in
//   deviceState()  finding out you have been taken over, so the app can
//                  say so instead of showing empty screens
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

/** The session id inside the current access token, or null. */
export async function currentSessionId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return null;
  try {
    // Decoding, not verifying. Verification is Postgres's job on every
    // query; this only needs to know which session this tab is holding.
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).session_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Take this device as the active one.
 *
 * Called after a successful sign-in. Two steps, and both matter:
 *
 *   1. Write our session id to users.active_session_id. Every RLS policy
 *      on the teacher's data compares against it, so this is what
 *      immediately shuts the other device out — including one holding a
 *      still-valid access token.
 *
 *   2. Revoke the other sessions' refresh tokens through GoTrue. Without
 *      this the other device keeps refreshing and would come back the
 *      moment it re-claimed; with it, its token expires and cannot be
 *      renewed.
 *
 * Step 2 is best-effort. If it fails the account is still protected by
 * step 1, and failing a sign-in over it would be the worse outcome.
 */
export async function claimDevice(): Promise<string | null> {
  const sessionId = await currentSessionId();
  if (!sessionId) return null;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const { error } = await supabase
    .from("users")
    .update({ active_session_id: sessionId, last_login_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) {
    console.warn("[device] could not claim:", error.message);
    return null;
  }

  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    /* the database gate already holds; this only shortens the other
       device's remaining token life */
  }
  return sessionId;
}

export type DeviceState =
  | { state: "current" }
  | { state: "superseded" }
  | { state: "unclaimed" }
  | { state: "unknown" };

/**
 * Is this still the active device?
 *
 * `users` is deliberately NOT gated on the device check, precisely so
 * this can be read after being locked out — a screen that cannot find
 * out why it is empty can only show a generic error.
 */
export async function deviceState(): Promise<DeviceState> {
  const [sessionId, { data: auth }] = await Promise.all([
    currentSessionId(),
    supabase.auth.getUser(),
  ]);
  const uid = auth?.user?.id;
  if (!uid || !sessionId) return { state: "unknown" };

  const { data, error } = await supabase
    .from("users").select("active_session_id").eq("id", uid).maybeSingle();
  if (error || !data) return { state: "unknown" };
  if (!data.active_session_id) return { state: "unclaimed" };
  return data.active_session_id === sessionId ? { state: "current" } : { state: "superseded" };
}

/**
 * Why did that write fail?
 *
 * A policy refusal is a single 42501 whatever the reason, so the cause
 * has to be worked out afterwards. Order matters: being on the wrong
 * device also blocks reads, so it is the more complete explanation and
 * is checked first.
 */
export async function explainRefusal(): Promise<
  { reason: "superseded" | "subscription" | "unknown"; message: string }
> {
  const dev = await deviceState();
  if (dev.state === "superseded") {
    return {
      reason: "superseded",
      message:
        "You've been signed out because this account was used on another device. " +
        "For security, Murchid stays active on one device at a time.",
    };
  }

  const { data } = await supabase
    .from("subscriptions").select("status, current_period_end, trial_ends_at").maybeSingle();
  if (data) {
    const ends = data.current_period_end ?? data.trial_ends_at;
    const dead = ["canceled", "expired", "suspended"].includes(data.status);
    const over = ends ? new Date(ends).getTime() < Date.now() : false;
    if (dead || over) {
      return {
        reason: "subscription",
        message:
          data.status === "trialing"
            ? "Your free trial has ended. Choose a plan to keep creating — everything you've made is still here."
            : "Your subscription has ended. Choose a plan to keep creating — everything you've made is still here, and you can still open and export it.",
      };
    }
  }
  return { reason: "unknown", message: "You don't have permission to do that." };
}
