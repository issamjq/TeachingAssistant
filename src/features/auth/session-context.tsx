"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

  const hydrate = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, name, email, institution, staff_id, syllabus")
      .eq("id", session.user.id)
      .single();
    if (!profile) {
      // The profile row always exists once created — the only way RLS
      // hides it from its own owner is session_ok() failing, i.e. another
      // device claimed this account. Clear the stale local session too,
      // rather than leaving it to fail silently on every next call.
      await supabase.auth.signOut();
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
    await supabase.rpc("claim_session");
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
