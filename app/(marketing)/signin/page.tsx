"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/features/auth/session-context";
import { isOnboarded } from "@/features/auth/types";
import { AuthCard } from "@/features/auth/auth-card";

export default function SignInPage() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "super_admin" || user.role === "sub_admin") {
      router.replace("/super-admin");
    } else if (user.role === "organisation") {
      router.replace("/organisation");
    } else {
      router.replace(isOnboarded(user) ? "/overview" : "/onboarding/teacher");
    }
  }, [loading, user, router]);

  return (
    <div className="theme-marketing flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <AuthCard />
    </div>
  );
}
