"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!supabase) {
        router.replace("/signin");
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );
      if (error) {
        router.replace("/signin");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/signin");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, institution, syllabus")
        .eq("id", user.id)
        .single();
      // Role first, onboarding status only for the teacher branch —
      // matching RequireOnboardedTeacher one screen later. Previously
      // this only ever checked institution/syllabus, so an admin or
      // organisation account (institution/syllabus always null for
      // those roles) landed on the teacher onboarding funnel instead of
      // its own console.
      if (profile?.role === "super_admin" || profile?.role === "sub_admin") {
        router.replace("/super-admin");
      } else if (profile?.role === "organisation") {
        router.replace("/organisation");
      } else {
        router.replace(
          profile?.institution && profile?.syllabus
            ? "/overview"
            : "/onboarding/teacher",
        );
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
