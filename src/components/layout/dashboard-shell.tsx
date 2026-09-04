"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  BookOpen,
  CalendarDays,
  User,
  LifeBuoy,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { useSession } from "@/features/auth/session-context";
import { ClassesNavTree } from "@/components/layout/classes-nav-tree";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/goal-planner", label: "Goal Planner", icon: Sparkles },
  { href: "/classes", label: "My Classes", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/support", label: "Support", icon: LifeBuoy },
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();

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

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 px-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            M
          </span>
          <span className="font-serif text-base font-medium tracking-tight">
            Murchid
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <div key={href}>
                <Link
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
                {href === "/classes" ? <ClassesNavTree /> : null}
              </div>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.name ?? "Teacher"}
            </p>
            <StatusPill status={user?.status ?? "pending"} />
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
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      <Button
        asChild
        className="fixed right-6 bottom-6 h-11 rounded-full px-5 shadow-lg"
      >
        <Link href="/support">
          <Sparkles className="size-4" />
          Ask for help
        </Link>
      </Button>
    </div>
  );
}
