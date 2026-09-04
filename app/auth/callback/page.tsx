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
        .select("institution, syllabus")
        .eq("id", user.id)
        .single();
      router.replace(
        profile?.institution && profile?.syllabus
          ? "/overview"
          : "/onboarding/teacher",
      );
    })();
  }, [router]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
