"use client";

// =====================================================================
// Where "/" sends you
//
// A signed-in teacher opening murchid.com wants their dashboard, not the
// sales pitch they already bought. A visitor wants the sales pitch. This
// decides which, before either is painted.
//
// The hard requirement is NO FLASH. Reading the session with
// supabase.auth.getSession() is a promise, so by the time it resolves the
// landing page has already rendered and a teacher sees the marketing site
// blink past on every visit — which reads as a bug, and on a slow phone
// is a full second of the wrong page.
//
// So the check is synchronous. supabase-js persists its session under a
// known localStorage key, and reading that key during the first render
// costs nothing. The token is not verified here and does not need to be:
// this is a routing hint, and every actual request is authorised by the
// database. A forged localStorage entry gets you a dashboard that loads
// nothing.
//
// SEO is unaffected. The page is still statically rendered and still
// served whole to anything without a session — crawlers included.
// =====================================================================
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseUrl } from "@/config/env";
import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";

/** The key supabase-js writes its session to: sb-<project-ref>-auth-token. */
function sessionKey(): string | null {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Is there a stored session worth redirecting on?
 *
 * A stored session whose access token has expired still counts: it
 * carries a refresh token, and supabase-js will renew it on load. Only a
 * missing or unreadable entry means "signed out".
 */
function hasStoredSession(): boolean {
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

export default function EntryGate() {
  const router = useRouter();
  const params = useSearchParams();

  // `?home=1` is how a signed-in teacher asks for the marketing page on
  // purpose — the studio's logo links here. A URL rather than a stored
  // flag, so it survives a refresh, can be shared, and leaves no hidden
  // state to get stuck in.
  const wantsLanding = params.get("home") !== null;

  // Decided during the first render, so nothing paints twice.
  const [redirecting] = useState(() => !wantsLanding && hasStoredSession());

  useEffect(() => {
    if (redirecting) router.replace("/dashboard");
  }, [redirecting, router]);

  // Deliberately not a spinner. The redirect is near-instant on a warm
  // load, and a spinner that appears for 80ms is worse than a blank
  // frame — it reads as work happening.
  if (redirecting) return null;

  return (
    <Landing
      onOpenStudio={(where?: string) => navigate([where ?? "planner"])}
      heroVariant="atelier"
    />
  );
}
