"use client";

// The studio chrome: sidebar rail, mobile drawer, top bar, and the scroll
// container every studio page renders into.
//
// Extracted from App.jsx, which used to be shell AND section dispatcher in
// one 812-line file. The dispatcher is gone — the App Router resolves which
// section renders, and this component only supplies the frame. Sections
// arrive as `children` from app/(studio)/<section>/page.tsx.
//
// It stays a client component: it owns drawer/collapse state, the Supabase
// auth gate, the single-device heartbeat, and role-based bouncing.
//
// Note: App.jsx also computed a `crumbs` array in 17 places. Nothing ever
// rendered it — it was dead code and is not carried over.

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  X,
  Sparkles,
  ArrowRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  CalendarRange,
  Target,
  BookOpen,
  ClipboardCheck,
  PenLine,
  MonitorPlay,
  Puzzle,
  Pin,
  Users,
  BarChart3,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { getRole, onRoleChange, ROLE_LABELS } from "@/lib/role";
import { api, ApiError } from "@/shared/lib/apiClient";
import { navigate, replace, clearRoute } from "@/lib/route";
import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import { useAccount, clearAccount, updateProfile } from "@/lib/account";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import type { Role } from "@/shared/types/domain";
import AccountMenu from "@/views/AccountMenu";
import HelpPopover from "@/views/HelpPopover";
import MurchidLogo from "@/components/MurchidLogo";
import Avatar from "@/components/Avatar";
import TeachingRail from "@/views/TeachingRail";
import {
  NAV_BY_ROLE,
  DEFAULT_ROUTE,
  SECTIONS_BY_ROLE,
  TEACHING_RAIL_SECTIONS,
  navTargetFor,
} from "@/config/nav";

const SIDEBAR_COLLAPSED_KEY = "murchid.sidebar.collapsed";

// Semantic key → icon. Letters were placeholders from before the nav
// had a design; an icon says what a place IS before the label is read,
// which a mono "H" never did.
const NAV_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  studio: Sparkles,
  scheduler: CalendarRange,
  goals: Target,
  lessons: BookOpen,
  quizzes: ClipboardCheck,
  homework: PenLine,
  presentations: MonitorPlay,
  activities: Puzzle,
  bulletin: Pin,
  students: Users,
  reports: BarChart3,
  keys: KeyRound,
};

function NavBadge({ letter, icon }: { letter?: string; icon?: string }) {
  const Icon = icon ? NAV_ICON[icon] : undefined;
  if (Icon) {
    return (
      <span className="murchid-nav-badge" aria-hidden>
        <Icon size={15} strokeWidth={1.9} />
      </span>
    );
  }
  // Anything unmapped keeps the letter rather than a blank square.
  return (
    <span className="murchid-nav-badge" aria-hidden>
      {letter || icon}
    </span>
  );
}

export default function StudioShell({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(getRole);
  const [navOpen, setNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => readStorage(SIDEBAR_COLLAPSED_KEY) === "1"
  );
  const account = useAccount();
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  // The section is the first path segment — the shell needs it for active
  // nav state and to decide whether the teaching rail shows.
  const section = (pathname || "/").split("/").filter(Boolean)[0] || DEFAULT_ROUTE[role];

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      writeStorage(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  // Wait for Supabase to resolve the auth state, then either hydrate /api/me
  // into the local account.profile (signed in) or clear the local account and
  // bounce to landing (signed out elsewhere, token revoked, etc).
  useEffect(() => {
    let cancelled = false;
    let off = () => {};
    (async () => {
      const { onAuthChange } = await import("@/lib/supabaseAuth");
      off = onAuthChange(async (user: unknown) => {
        if (cancelled) return;
        if (!user) {
          // Supabase says nobody is signed in — e.g. a signed-out visitor
          // swipes back and the browser restores /planner. Routing is purely
          // URL-driven, so clearing the account isn't enough; reset the route
          // to "/" so landing renders. Never show the studio shell unauthed.
          if (account) clearAccount();
          clearRoute();
          return;
        }
        try {
          const me = await api<Record<string, string>>("/api/me");
          if (cancelled || !me) return;
          const cur = account?.profile || {};
          const patch: Record<string, string> = {};
          if (me.first_name && cur.firstName !== me.first_name) patch.firstName = me.first_name;
          if (me.last_name && cur.lastName !== me.last_name) patch.lastName = me.last_name;
          if (me.staff_id && cur.staffId !== me.staff_id) patch.staffId = me.staff_id;
          if (me.email && cur.email !== me.email) patch.email = me.email;
          if (Object.keys(patch).length > 0) updateProfile(patch);
        } catch (err) {
          // An authenticated user with no DB row (closed the tab during
          // onboarding) or an elapsed subscription must go back to landing to
          // finish plan-pick / renew. Other errors stay silent.
          const code = err instanceof ApiError ? err.code : undefined;
          if (code === "no_teacher_row" || code === "subscription_expired") {
            if (account) clearAccount();
            clearRoute();
          }
        }
      });
    })();
    return () => {
      cancelled = true;
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Sign out fully: revoke the Supabase session, drop every cached
   * identity, then a full page load so no React state survives.
   *
   * The cached faculty id matters — without clearing it the next teacher
   * to sign in on this device inherits it and writes their rows against
   * someone else's profile.
   */
  const signOutFully = async () => {
    try {
      const { signOut } = await import("@/lib/supabaseAuth");
      await signOut();
    } catch (e) {
      console.warn("Supabase signOut failed:", e);
    }
    const [{ clearSessionId }, { clearIdent }] = await Promise.all([
      import("@/lib/session"),
      import("@/lib/data/session"),
    ]);
    clearSessionId();
    clearIdent();
    clearAccount();
    clearRoute();
    window.location.assign("/");
  };

  // The logo leaves the studio for the marketing site. `?home=1` is what
  // stops the entry gate bouncing straight back — without it, "/" sees a
  // stored session and returns the teacher to the dashboard they were
  // trying to leave.
  const openLanding = () => router.push("/?home=1");

  // Single-device enforcement heartbeat. Re-validate every 20s; if the
  // account has since signed in elsewhere this returns 401
  // `session_superseded` and apiClient tears the session down on its own, so
  // the OLD device logs out promptly rather than failing at its next action.
  useEffect(() => {
    if (!account) return undefined;
    const id = setInterval(() => {
      api("/api/auth/me").catch(() => {
        /* apiClient handles supersession */
      });
    }, 20000);
    return () => clearInterval(id);
  }, [account]);

  // Role switcher (Account → role) — follow it to that role's home.
  useEffect(
    () =>
      onRoleChange((next) => {
        setRoleState(next);
        navigate([DEFAULT_ROUTE[next]]);
      }),
    []
  );

  // Bounce sections that don't apply to the current role. Replace, not push,
  // so the back button doesn't re-trigger the bounce.
  useEffect(() => {
    if (!SECTIONS_BY_ROLE[role].has(section)) {
      replace([DEFAULT_ROUTE[role]]);
    }
  }, [role, section]);

  // Any route change closes the mobile drawer + account menu so the new
  // screen is visible immediately after tapping a nav item.
  //
  // Adjusted during render rather than in an effect. App.jsx used an effect,
  // which paints the new route with the drawer still open and only then
  // re-renders it closed — a cascading render React can skip entirely when
  // the update happens before paint.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
    setAccountMenuOpen(false);
  }

  // Translate a nav/section key, falling back to its English label when the
  // key isn't in the dictionary yet (phased rollout).
  const navT = (key: string, fallback?: string) => {
    const s = t(`nav.${key}` as TranslationKey);
    return s === `nav.${key}` ? (fallback ?? key) : s;
  };

  // Display name + initials for the sidebar chip.
  //   1. Full name (bold)      — falls back to the email local-part
  //   2. Staff ID (mono)       — hidden if blank
  //   3. Role label (italic)   — hidden when line 1 already shows it
  const firstName = account?.profile?.firstName || "";
  const lastName = account?.profile?.lastName || "";
  const staffId = account?.profile?.staffId || "";
  const emailLocalPart = (account?.profile?.email || "").split("@")[0];
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || emailLocalPart || "";
  const displayInitial =
    `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() ||
    (account?.profile?.email || "T")[0].toUpperCase();
  const roleKey = `account.${role}` as TranslationKey;
  const roleLabel = t(roleKey) === `account.${role}` ? ROLE_LABELS[role] : t(roleKey);

  const nav = NAV_BY_ROLE[role];
  const sidebarActive = section === "account" ? "account" : section;
  const handleNavClick = (key: string) => navigate(navTargetFor(key));

  // Studio launcher — the hero CTA, lifted out of the nav list. Sits just
  // above the account chip so the two persistent affordances pair up.


  // Rendered once for the desktop rail and again inside the mobile drawer,
  // so navigation is identical everywhere.
  const sidebarBody = (
    <>
      <div className="flex items-center pe-2">
        <button
          onClick={openLanding}
          className="murchid-sidebar-brand flex-1 flex items-center px-5 pt-6 pb-4 text-left"
          aria-label="Go to the Murchid home page"
          title="Murchid home"
        >
          <MurchidLogo
            className="h-[50px] w-auto text-ink"
            style={{ "--murchid-logo-accent": "#8e5435" } as React.CSSProperties}
          />
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          title="Hide sidebar"
          aria-label="Hide sidebar"
          className="hidden md:flex h-8 w-8 mt-3 rounded-md text-ink-soft hover:text-ink hover:bg-paper-warm items-center justify-center transition-colors"
        >
          <PanelLeftClose size={16} className="rtl:rotate-180" />
        </button>
      </div>

      {/* Hairline between the brand block and the first nav tab. */}
      <div className="h-px bg-line/60 mx-5 mt-1 mb-3" />

      <nav className="px-2 flex-1 overflow-y-auto pb-3" aria-label="Primary">
        {/* Items get a per-item stagger via inline --mi (mount index). The
            index is global across the nav so sections cascade one after
            another rather than in parallel. */}
        {(() => {
          let mi = 0;
          return nav.map((s, sectionIdx) => (
            <section
              key={s.section || `sec-${sectionIdx}`}
              className="murchid-sidebar-section"
            >
              {s.section && (
                <p className="murchid-sidebar-section-label">
                  {navT(s.section.toLowerCase(), s.section)}
                </p>
              )}
              <div className="space-y-0.5 px-1">
                {s.items.map((item) => {
                  const isActive = sidebarActive === item.key;
                  const myIndex = mi++;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item.key)}
                      data-tour={`nav-${item.key}`}
                      style={{ "--mi": myIndex } as React.CSSProperties}
                      className={`murchid-sidebar-item ${
                        isActive ? "murchid-sidebar-item-active" : ""
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <NavBadge letter={item.letter} icon={item.icon} />
                      <span className="truncate flex-1">{navT(item.key, item.label)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ));
        })()}
      </nav>

      <div className="relative">
        <button
          onClick={() => setAccountMenuOpen((o) => !o)}
          title={t("accountMenu.open")}
          data-tour="account"
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          className={`murchid-sidebar-account ${
            accountMenuOpen ? "murchid-sidebar-account-active" : ""
          }`}
        >
          <Avatar
            avatarId={account?.profile?.avatarId}
            // Signed in with LinkedIn or Google? Show their actual face.
            photoUrl={account?.profile?.avatarUrl}
            initial={displayInitial}
            size={34}
            className="murchid-sidebar-account-avatar"
          />
          <div className="flex-1 min-w-0 text-start">
            <p className="text-sm font-medium leading-tight truncate text-ink">
              {displayName || roleLabel}
            </p>
            {staffId && (
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mt-0.5 truncate">
                {staffId}
              </p>
            )}
            {displayName && (
              <p className="font-serif italic text-[11px] text-muted mt-0.5 truncate">
                {roleLabel}
              </p>
            )}
          </div>
          <ChevronRight size={14} className="text-muted flex-shrink-0 rtl:rotate-180" />
        </button>
        <AccountMenu
          open={accountMenuOpen}
          onClose={() => setAccountMenuOpen(false)}
          user={account}
          showUpgrade
          onOpenSettings={() => navigate(["account"])}
          onOpenHelp={() => {
            const launcher = document.querySelector<HTMLButtonElement>(
              '[aria-label="Open the assistant"]'
            );
            if (launcher) launcher.click();
            else setHelpOpen(true);
          }}
          onUpgrade={() => navigate(["signup"])}
          onLogout={signOutFully}
        />
      </div>
    </>
  );

  return (
    <div className="murchid-studio-app murchid-studio-canvas h-[100dvh] flex text-ink font-sans overflow-hidden">
      {/* Desktop / iPad-landscape rail — collapsible, state persists.
          Collapsing animates width 256px ↔ 0 (overflow-hidden clips the
          fixed-width inner column so contents don't reflow mid-slide)
          rather than snapping to display:none. */}
      <aside
        className={`murchid-sidebar flex-shrink-0 h-full overflow-hidden print:hidden hidden md:block transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          sidebarCollapsed ? "md:w-0" : "md:w-64"
        }`}
      >
        {/* The floating pane. The fixed-width inner column keeps the
            contents from reflowing mid-slide while the aside animates;
            the gutters live HERE, not on the aside — padding on a w-64
            aside around a w-64 column was 268px in a 256px clip, which
            silently cut the pane's right edge off. */}
        <div className="w-64 h-full py-3 ps-3 pe-1.5">
          <div className="murchid-sidebar-pane">{sidebarBody}</div>
        </div>
      </aside>

      {/* Mobile / iPad-portrait drawer — slides in over a scrim. Identical
          nav to desktop; closes on any route change. */}
      <div className={`md:hidden ${navOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setNavOpen(false)}
          className={`fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 print:hidden ${
            navOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <aside
          className={`murchid-sidebar murchid-sidebar-drawer fixed inset-y-0 start-0 z-50 w-[82vw] max-w-xs flex flex-col h-[100dvh] shadow-2xl transition-transform duration-300 ease-out print:hidden ${
            navOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
          }`}
          aria-label="Primary"
          aria-hidden={!navOpen}
        >
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="absolute top-3 end-3 z-10 h-9 w-9 rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
          {sidebarBody}
        </aside>
      </div>

      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile top bar — the only nav affordance below md. Language lives
            in the account menu (Settings), not here. */}
        <div className="md:hidden flex items-center gap-3.5 px-4 h-16 border-b border-line/70 bg-paper-cool/85 backdrop-blur-md flex-shrink-0 print:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="-ms-1 h-11 w-11 rounded-xl text-ink hover:bg-paper-warm active:scale-95 flex items-center justify-center transition"
          >
            <Menu size={22} strokeWidth={1.9} />
          </button>
          <span className="h-7 w-px bg-line/70" aria-hidden="true" />
          <button
            onClick={openLanding}
            className="flex-1 flex items-center text-start min-w-0"
            aria-label="Go to the Murchid home page"
            title="Murchid home"
          >
            <MurchidLogo
              className="h-[42px] w-auto text-ink"
              style={{ "--murchid-logo-accent": "#8e5435" } as React.CSSProperties}
            />
          </button>
        </div>

        <div
          className={`murchid-content-pane relative flex-1 overflow-y-auto px-4 pt-4 pb-6 sm:px-6 md:my-3 md:me-3 md:ms-1.5 md:pt-4 md:pb-3 md:pe-6 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            sidebarCollapsed ? "md:ps-16" : "md:ps-8"
          }`}
        >
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Show sidebar"
              aria-label="Show sidebar"
              className="hidden md:flex absolute top-3 start-3 z-20 h-9 w-9 rounded-md text-ink-soft hover:text-ink hover:bg-paper-warm items-center justify-center transition print:hidden"
            >
              <PanelLeftOpen size={16} className="rtl:rotate-180" />
            </button>
          )}
          {TEACHING_RAIL_SECTIONS.has(section) ? (
            <div className="lg:flex lg:gap-6 h-full">
              <div className="flex-1 min-w-0">{children}</div>
              <div className="hidden lg:block flex-shrink-0">
                <TeachingRail />
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      <HelpPopover open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
