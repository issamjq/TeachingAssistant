"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Building2,
  LibraryBig,
  ShieldCheck,
  Cpu,
  DollarSign,
  Coins,
  BarChart3,
  AlertTriangle,
  KeyRound,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSession } from "@/features/auth/session-context";
import { AnalyticsTracker } from "@/features/analytics/analytics-tracker";

const NAV = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/accounts", label: "Accounts", icon: Users },
  { href: "/super-admin/students", label: "Students", icon: GraduationCap },
  { href: "/super-admin/orgs", label: "Organisations", icon: Building2 },
  { href: "/super-admin/library", label: "Shared library", icon: LibraryBig },
  { href: "/super-admin/roles", label: "Roles", icon: ShieldCheck },
  { href: "/super-admin/usage", label: "AI usage & credits", icon: Cpu },
  { href: "/super-admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/super-admin/costs", label: "Feature costs", icon: Coins },
  { href: "/super-admin/product", label: "Product analytics", icon: BarChart3 },
  { href: "/super-admin/friction", label: "Friction", icon: AlertTriangle },
  { href: "/super-admin/keys", label: "API keys", icon: KeyRound },
] as const;

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== "super_admin" && user.role !== "sub_admin")) {
      router.replace("/overview");
    }
  }, [loading, user, router]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  async function handleSignOut() {
    await signOut();
    router.push("/signin");
  }

  if (loading || !user || (user.role !== "super_admin" && user.role !== "sub_admin")) {
    return null;
  }

  return (
    <div className="theme-app flex min-h-svh bg-background text-foreground">
      <AnalyticsTracker />
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 flex-col justify-center gap-1 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/murchid-logo-green.svg" alt="Murchid" className="h-6 w-auto" />
          <p className="text-xs text-sidebar-foreground/60">
            {user.role === "super_admin" ? "Super admin" : "Sub-admin"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? "Admin"}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="rounded-md p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
    </div>
  );
}
