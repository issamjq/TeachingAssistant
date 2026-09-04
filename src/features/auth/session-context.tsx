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
  signInWithGoogle: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    setUser(profile ? toSessionUser(session.user, profile as ProfileRow) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    hydrate();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => hydrate());
    return () => subscription.unsubscribe();
  }, [hydrate]);

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
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
        signInWithGoogle,
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
