"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/config/env";
import type { Role, SessionUser } from "./types";

interface ProfileRow {
  role: Role;
  status: SessionUser["status"];
  name: string | null;
  email: string | null;
  institution: string | null;
  staff_id: string | null;
  syllabus: string | null;
}

function toSessionUser(authUser: User, profile: ProfileRow): SessionUser {
  return {
    id: authUser.id,
    name: profile.name ?? authUser.email ?? "",
    email: profile.email ?? authUser.email ?? "",
    role: profile.role,
    status: profile.status,
    institution: profile.institution,
    staffId: profile.staff_id,
    syllabus: profile.syllabus,
  };
}

interface OnboardingInput {
  institution: string;
  staffId?: string;
  syllabus: string;
}

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  configured: boolean;
  /** Set when hydrate() finds a valid token but no readable profile — the
   * one way that happens is another device claiming the session (see
   * session_ok() in db/tune.sql). Cleared by clearSupersededMessage(). */
  supersededMessage: string | null;
  clearSupersededMessage: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const SUPERSEDED_MESSAGE =
  "You've been signed out because this account was used on another device.";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [supersededMessage, setSupersededMessage] = useState<string | null>(null);
  // Set for the duration of a real claim_session() RPC. 2026-09-06
  // incident: a redundant auth event (TOKEN_REFRESHED firing right
  // alongside a genuine SIGNED_IN — seen in the live auth log, both
  // real events) could call the plain hydrate() below concurrently with
  // claimAndHydrate()'s own claim, reading profiles against the
  // *previous* login's still-current active_session_id before this
  // login's claim landed. Any hydrate() now waits out an in-flight claim
  // instead of racing it — claimAndHydrate() itself is unaffected, since
  // it awaits its own claim before ever reaching hydrate().
  const claimInFlightRef = useRef<Promise<void> | null>(null);

  const hydrate = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (claimInFlightRef.current) {
      await claimInFlightRef.current;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }
    const fetchProfile = () =>
      supabase!
        .from("profiles")
        .select("role, status, name, email, institution, staff_id, syllabus")
        .eq("id", session.user.id)
        .single();

    let { data: profile, error } = await fetchProfile();
    if (error && error.code !== "PGRST116") {
      // Transient failure (a cold connection right after a hard refresh,
      // a network blip) — not evidence of anything. Retry once before
      // deciding, rather than treating any hiccup as a sign-out signal.
      ({ data: profile, error } = await fetchProfile());
    }

    if (!profile) {
      if (error && error.code !== "PGRST116") {
        // Still failing, but not because RLS returned zero rows (PGRST116
        // is the only code that actually means that). Don't sign anyone
        // out over a network problem — leave the session alone and let
        // the next hydrate() try again.
        setLoading(false);
        return;
      }
      // PGRST116 (or no error and no data): the profile row always exists
      // once created, so RLS hiding it from its own owner means another
      // device claimed this session. Clear the stale local session too,
      // rather than leaving it to fail silently on every next call —
      // scope: 'local' only, never the default 'global'. A bare
      // signOut() deletes every session and refresh token the account
      // owns, everywhere — on 2026-09-06 that turned "you were signed
      // out here" into every device a teacher owned being logged out,
      // including on a fresh login of its own (see db/tune.sql's
      // "select own profile" policy for the other half of that fix).
      await supabase.auth.signOut({ scope: "local" });
      setSupersededMessage(SUPERSEDED_MESSAGE);
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(toSessionUser(session.user, profile as ProfileRow));
    setLoading(false);
  }, []);

  // Claims this session before the first profile read — the row this
  // overwrites may belong to a session that's about to be superseded, so
  // it must bypass RLS (see claim_session() in db/tune.sql). Idempotent:
  // safe to call more than once for the same session (the auth-state
  // listener below does it again for OAuth/magic-link redirects), since
  // it just resets active_session_id to the same value.
  const claimAndHydrate = useCallback(async () => {
    if (!supabase) return;
    const claim = Promise.resolve(supabase.rpc("claim_session")).then(() => {});
    claimInFlightRef.current = claim;
    await claim;
    claimInFlightRef.current = null;
    await hydrate();
  }, [hydrate]);

  useEffect(() => {
    hydrate();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Only a genuine new sign-in claims — never a token refresh or a
      // page reload restoring an already-open session, which would let a
      // superseded session silently re-claim itself back.
      if (event === "SIGNED_IN") {
        claimAndHydrate();
      } else {
        hydrate();
      }
    });
    return () => subscription.unsubscribe();
  }, [hydrate, claimAndHydrate]);

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signInWithPassword(email: string, password: string) {
    if (!supabase) throw new Error("Sign-in isn't configured yet");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await claimAndHydrate();
  }

  async function signUpWithPassword(
    email: string,
    password: string,
  ): Promise<{ needsEmailConfirmation: boolean }> {
    if (!supabase) throw new Error("Sign-in isn't configured yet");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (data.session) {
      await claimAndHydrate();
      return { needsEmailConfirmation: false };
    }
    return { needsEmailConfirmation: true };
  }

  // Supabase doesn't reveal whether the email has an account either way
  // — the caller should show the same "check your email" notice
  // regardless of what this resolves to.
  async function requestPasswordReset(email: string) {
    if (!supabase) throw new Error("Sign-in isn't configured yet");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  }

  // Only valid inside the recovery session established by the emailed
  // link (see app/auth/reset-password) — Supabase rejects this otherwise.
  async function updatePassword(newPassword: string) {
    if (!supabase) throw new Error("Sign-in isn't configured yet");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    await hydrate();
  }

  async function completeOnboarding(input: OnboardingInput) {
    if (!supabase || !user) return;
    await supabase
      .from("profiles")
      .update({
        institution: input.institution,
        staff_id: input.staffId ?? null,
        syllabus: input.syllabus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    await hydrate();
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        configured: isSupabaseConfigured,
        supersededMessage,
        clearSupersededMessage: () => setSupersededMessage(null),
        signInWithGoogle,
        signInWithPassword,
        signUpWithPassword,
        requestPasswordReset,
        updatePassword,
        completeOnboarding,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
