"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "./session-context";
import { isOnboarded } from "./types";

export function RequireOnboardedTeacher({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    if (!isOnboarded(user)) {
      router.replace("/onboarding/teacher");
    }
  }, [loading, user, router]);

  if (loading || !user || !isOnboarded(user)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
