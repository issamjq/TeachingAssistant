"use client";

import { useState } from "react";
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
  Menu,
  X,
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
] as const;

const BOTTOM_NAV = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/support", label: "Support", icon: LifeBuoy },
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Reset during render (React's documented alternative to an effect for
  // "adjust state when a prop changes") rather than useEffect, so a route
  // change closes the drawer without an extra post-commit render pass.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileNavOpen(false);
  }

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

  const navList = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
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
  );

  const bottomNav = (
    <nav className="flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border px-3 py-2">
      {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
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
  );

  const accountRow = (
    <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
      <Avatar className="size-8">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user?.name ?? "Teacher"}</p>
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
  );

  return (
    <div className="flex h-full overflow-hidden rounded-[1.75rem] shadow-2xl">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/murchid-logo-green.svg" alt="Murchid" className="h-6 w-auto" />
        </div>
        {navList}
        {bottomNav}
        {accountRow}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/murchid-logo-green.svg" alt="Murchid" className="h-5 w-auto" />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
            className="flex size-9 items-center justify-center rounded-full text-foreground/70 hover:bg-secondary"
          >
            <Menu className="size-5" />
          </button>
        </div>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
          {children}
        </main>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex w-72 max-w-[82vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl">
            <div className="flex h-16 items-center justify-between px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/murchid-logo-green.svg" alt="Murchid" className="h-6 w-auto" />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
                className="flex size-9 items-center justify-center rounded-full text-sidebar-foreground/70 hover:bg-sidebar-accent"
              >
                <X className="size-5" />
              </button>
            </div>
            {navList}
            {bottomNav}
            {accountRow}
          </aside>
        </div>
      ) : null}

      <Button
        asChild
        className="fixed right-6 bottom-6 z-40 h-11 rounded-full bg-lime px-5 text-lime-foreground shadow-lg hover:bg-lime/90"
      >
        <Link href="/support">
          <Sparkles className="size-4" />
          Ask for help
        </Link>
      </Button>
    </div>
  );
}
