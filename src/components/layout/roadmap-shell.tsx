"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useSession } from "@/features/auth/session-context";
import type { Role } from "@/features/auth/types";

// Every signed-in role can read the roadmap — unlike SuperAdminShell, this
// only checks that a session exists, not what role it holds.
function homeHrefFor(role: Role | undefined) {
  switch (role) {
    case "super_admin":
    case "sub_admin":
      return "/super-admin";
    case "organisation":
      return "/organisation";
    default:
      return "/overview";
  }
}

export function RoadmapShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/signin");
  }, [loading, user, router]);

  async function handleSignOut() {
    await signOut();
    router.push("/signin");
  }

  if (loading || !user) return null;

  return (
    <div className="theme-app min-h-svh bg-background text-foreground">
      <div className="flex h-16 items-center justify-between border-b border-border px-6 md:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Link href={homeHrefFor(user.role)}>
          <img src="/murchid-logo-green.svg" alt="Murchid" className="h-6 w-auto" />
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
