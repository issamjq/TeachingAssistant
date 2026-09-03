"use client";

// Is this browser carrying a Supabase session?
//
// Extracted from EntryGate, which had the only copy. It is now needed in
// two places — EntryGate decides whether "/" redirects to the dashboard,
// and the marketing nav decides whether to offer "Sign in" or a way back
// into the app — and two copies of a rule about auth is one too many.
//
// THIS IS A ROUTING HINT, NOT AUTHORISATION. The token is not verified
// here and does not need to be: every actual request is authorised by the
// database through RLS. A forged localStorage entry buys you a dashboard
// that loads nothing.

import { useSyncExternalStore } from "react";
import { supabaseUrl } from "@/config/env";

/** The key supabase-js writes its session to: sb-<project-ref>-auth-token. */
function sessionKey(): string | null {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Is there a stored session worth acting on?
 *
 * A stored session whose access token has expired still counts: it
 * carries a refresh token, and supabase-js will renew it on load. Only a
 * missing or unreadable entry means "signed out".
 *
 * Safe to call during render — it is synchronous and returns false on the
 * server, where there is no storage to read.
 */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  const key = sessionKey();
  if (!key) return false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed?.refresh_token || parsed?.access_token);
  } catch {
    return false;
  }
}

/**
 * The same answer, for markup that has to survive hydration.
 *
 * useSyncExternalStore rather than an effect, and the three arguments
 * are doing three different jobs:
 *
 *   · getServerSnapshot returns false, so the server and the FIRST
 *     client render agree. That is what keeps "/" statically renderable
 *     — this feeds a link that is in the static HTML, so reading storage
 *     during the first render would hand React different markup than the
 *     server produced. EntryGate can read it during render because it
 *     returns null either way; this cannot.
 *   · getSnapshot reads storage on every render after hydration, so the
 *     link corrects itself the moment React takes over. A boolean is a
 *     stable snapshot, so this cannot loop.
 *   · subscribe listens for `storage`, which fires when ANOTHER tab
 *     signs in or out. Sign out in one tab and the other tab's nav stops
 *     offering the dashboard without a reload.
 *
 * The cost is one frame of the signed-out label for a signed-in visitor,
 * which beats a hydration mismatch on the one page that must stay static.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function useHasSession(): boolean {
  return useSyncExternalStore(subscribe, hasStoredSession, () => false);
}
