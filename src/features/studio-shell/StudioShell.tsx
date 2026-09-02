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

import React, { useEffect, useMemo, useState } from "react";
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
  CalendarClock,
  Target,
  BookOpen,
  LibraryBig,
  FileText,
  ClipboardCheck,
  PenLine,
  MonitorPlay,
  Puzzle,
  Pin,
  Users,
  BarChart3,
  KeyRound,
  GraduationCap,
  Coins,
  Building2,
  ChevronDown,
  Activity,
  TriangleAlert,
  ShieldCheck,
  Landmark,
  Briefcase,
  Terminal,
  Cpu,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { asRoles, clearRole, getRole, onRoleChange, ROLE_LABELS, setRole, syncRoleFromServer } from "@/lib/role";
import { CreditWarning } from "@/features/studio-ai/CreditMeter";
import { api, ApiError } from "@/shared/lib/apiClient";
import { navigate, replace, clearRoute } from "@/lib/route";
import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import { useAccount, clearAccount, updateProfile } from "@/lib/account";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import type { Role } from "@/shared/types/domain";
import dynamic from "next/dynamic";
import AccountMenu from "@/views/AccountMenu";
import HelpPopover from "@/views/HelpPopover";
import MurchidLogo from "@/components/MurchidLogo";
import Avatar from "@/components/Avatar";
import TeachingRail from "@/views/TeachingRail";
import DeviceNotice from "./DeviceNotice";
import { ContextPanelRegion, useContextPanelState } from "@/shared/shell/ContextPanel";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { ALLOW_API_OVERRIDE } from "@/config/env";
import { startTelemetry, trackView } from "@/lib/telemetry";
import {
  NAV_BY_ROLE,
  DEFAULT_ROUTE,
  SECTIONS_BY_ROLE,
  TEACHING_RAIL_SECTIONS,
  navTargetFor,
  adminNav,
  adminSections,
  adminHome,
  platformNav,
  platformSections,
} from "@/config/nav";

const SIDEBAR_COLLAPSED_KEY = "murchid.sidebar.collapsed";

// Preview builds only. A lazy chunk, so production never fetches it: the
// flag inlines to `false`, the chip never renders, and an unrendered
// dynamic import is never requested. The override functions themselves
// hard-return on the same flag, so the panel is not the security
// boundary — see src/shared/lib/apiBase.ts.
const DevApiEndpoint = ALLOW_API_OVERRIDE
  ? dynamic(() => import("./DevApiEndpoint"), { ssr: false })
  : () => null;

// Semantic key → icon. Letters were placeholders from before the nav
// had a design; an icon says what a place IS before the label is read,
// which a mono "H" never did.
const NAV_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  studio: Sparkles,
  scheduler: CalendarRange,
  // The weekly teaching grid — the surface where work is delivered.
  timetable: CalendarClock,
  goals: Target,
  library: LibraryBig,
  materials: FileText,
  lessons: BookOpen,
  quizzes: ClipboardCheck,
  homework: PenLine,
  presentations: MonitorPlay,
  activities: Puzzle,
  bulletin: Pin,
  students: Users,
  skills: GraduationCap,
  reports: BarChart3,
  keys: KeyRound,
  coins: Coins,
  orgs: Building2,
  activity: Activity,
  friction: TriangleAlert,
  shield: ShieldCheck,
  ministry: Landmark,
  owner: Briefcase,
  terminal: Terminal,
  // Tokens and pricing both used to be `coins`, which made Revenue and
  // Credit costs indistinguishable in a rail read at a glance. One is
  // what the models burn, the other is the price list.
  tokens: Cpu,
  pricing: Tag,
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
  /**
   * The stored role is adopted AFTER mount, never during the first render.
   *
   * getRole() reads localStorage, which exists in the browser and not on
   * the server. Used as the useState initialiser it ran in both places and
   * disagreed: the server rendered a teacher's sidebar, the client rendered
   * a super admin's, and React threw the whole tree away with a hydration
   * mismatch — "Overview" on the server against "Super admin" on the
   * client. Everything still worked, which is why it survived: the console
   * carried the error and the screen looked fine.
   *
   * Seeding with the same value the server used makes the first paint
   * agree by construction. The effect below is the only thing that reads
   * storage, and it runs once hydration is done.
   */
  const [role, setRoleState] = useState<Role>("teacher");
  /**
   * Has the stored role been read yet?
   *
   * The seed above is the server's guess, not this browser's answer, and
   * for one render they disagree. The bounce below must not run in that
   * window: a student opening /student-class directly was judged against
   * a teacher's sections, failed, and was thrown back to a home page —
   * every time, on every reload, while clicking the same link inside the
   * app worked perfectly.
   */
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    const stored = getRole();
    if (stored !== "teacher") setRoleState(stored);
    setRoleReady(true);
  }, []);

  /**
   * Wake the AI service the moment the studio opens.
   *
   * Render's free tier spins down; first byte on a cold generate was
   * ~6.2s vs ~175ms warm (todo/backend-integration.md §6). Any request
   * wakes it — a 404 included — so one fire-and-forget ping when the
   * shell mounts means by the time a teacher has typed a brief, the
   * service is already up. /api/keepwarm does the same from a scheduled
   * pinger for the first hit of the day.
   */
  useEffect(() => {
    import("@/shared/lib/apiBase").then(({ apiBase }) => {
      fetch(apiBase() + "/api/studio/health", { cache: "no-store" }).catch(() => {});
    });
  }, []);
  // Every role this account holds, from /api/me. One entry is the ordinary
  // case and the switcher stays hidden; more than one means the person is
  // genuinely both things and gets to choose which interface they are in.
  const [heldRoles, setHeldRoles] = useState<Role[]>([]);
  // Resolved capability map from /api/me — drives a sub-admin's nav.
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => readStorage(SIDEBAR_COLLAPSED_KEY) === "1"
  );
  const account = useAccount();
  // Whether a section is filling the second left column, and whether it
  // is open. Only used to set `data-panel` on the root — the responsive
  // rule that drops the nav to icons lives in CSS, keyed to the
  // viewport, so it can never affect a wide layout.
  const panel = useContextPanelState();
  // Between md and 1152 the viewport cannot carry a labelled rail AND the
  // context panel AND the work. Derived from the viewport, never from the
  // panel's control: on a wide screen opening the panel changes nothing
  // here, and this cannot persist, so docking to a monitor restores the
  // labels without anyone touching a setting.
  const tooNarrowForBoth = useMediaQuery("(min-width: 768px) and (max-width: 1151px)");
  const railIcons = sidebarCollapsed || (tooNarrowForBoth && panel.present && !panel.collapsed);
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  // A sub-admin's surfaces are whatever the super admin granted; everyone
  // else's are the static per-role config. `perms` fills in from /api/me.
  const isAdmin = role === "admin";
  /**
   * Which billing mode the platform is in (db/tune.sql §89). It rides
   * along on the credits payload rather than getting its own endpoint,
   * so a super admin throwing the switch reaches every teacher on her
   * next generation with no poll and no reload.
   *
   * `null` means "not answered yet", and it is treated as HIDE rather
   * than as show. A Plans link that appears for a moment and then
   * vanishes is worse than one that arrives a beat late: during a free
   * period it advertises something that does not exist, and a teacher
   * who clicks it in that moment lands on a redirect.
   *
   * A failed fetch resolves to TRUE, not to null. Billing on is the
   * default and the paying customer is the one who gets hurt by guessing
   * wrong — losing the link to the plan she is paying for because a
   * request timed out is the worse of the two failures.
   */
  const [billingOn, setBillingOn] = useState<boolean | null>(null);

  /**
   * A platform capability granted to an MoE officer or an owner has to
   * show up somewhere. `admin` is handled separately because that role
   * IS its grants — strip them and no screen remains — whereas these
   * two have a console of their own that the grants add to.
   */
  const roleSections = useMemo(() => {
    if (isAdmin) return adminSections(perms);
    const extra = platformSections(perms);
    if (!extra.length) return SECTIONS_BY_ROLE[role];
    return new Set([...SECTIONS_BY_ROLE[role], ...extra]);
  }, [isAdmin, perms, role]);

  /**
   * Plans and billing are not features of a role, they are features of a
   * billing mode, so they are subtracted here rather than removed from
   * SECTIONS_BY_ROLE. That config answers "may this role reach this
   * screen"; the switch answers "does this screen exist right now", and
   * folding the second into the first would mean a static file had to be
   * edited to throw a runtime switch.
   *
   * Subtracting here also closes the URL bar. `allowedSections` is what
   * the redirect effect below checks, so with billing off a teacher who
   * types /plans is bounced to her dashboard by the same guard that
   * already handles a stale /quizzes — no separate route check to keep
   * in step.
   */
  const allowedSections = useMemo(() => {
    if (billingOn !== false) return roleSections;
    const open = new Set(roleSections);
    open.delete("plans");
    open.delete("billing");
    return open;
  }, [roleSections, billingOn]);
  const homeRoute = isAdmin ? adminHome(perms) : DEFAULT_ROUTE[role];

  // The section is the first path segment — the shell needs it for active
  // nav state and to decide whether the teaching rail shows.
  const section = (pathname || "/").split("/").filter(Boolean)[0] || homeRoute;

  /**
   * Product telemetry. Mounted here rather than in the root layout for
   * two reasons: the layout is a server component and must stay one, and
   * the marketing site is measured by Clarity and Analytics already —
   * this ledger is about the WORKSPACE, which those two cannot see
   * behind the sign-in.
   *
   * It records a section key, a control's own label, click positions and
   * durations. It does not record page content, form values, or a URL
   * with an id in it. See lib/telemetry.ts for what that rules out.
   */
  useEffect(() => startTelemetry(), []);

  useEffect(() => {
    if (section) trackView(section);
  }, [section]);

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
          const me = await api<Record<string, any>>("/api/me");
          if (cancelled || !me) return;
          // The account row decides which rail this browser renders. Until
          // this call, `murchid_role` was written only by the portal
          // sign-ins and never cleared, so it outlived the account that
          // wrote it — see syncRoleFromServer. Role first, then the
          // capabilities that refine it.
          syncRoleFromServer(me.role, me.roles);
          setHeldRoles(asRoles(me.roles));
          // Keep the resolved capability map so the sub-admin nav reflects
          // exactly what the super admin granted.
          if (me.permissions && typeof me.permissions === "object") setPerms(me.permissions);
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
    clearRole();
    clearRoute();
    window.location.assign("/");
  };

  // The logo leaves the studio for the marketing site. `?home=1` is what
  // stops the entry gate bouncing straight back — without it, "/" sees a
  // stored session and returns the teacher to the dashboard they were
  // trying to leave.
  const openLanding = () => router.push("/?home=1");

  // Single-device enforcement lives in <DeviceNotice />, rendered below.
  //
  // What used to be here polled /api/auth/me for a 401 `session_superseded`.
  // That endpoint is a Supabase read now, over four tables none of which are
  // device-gated, so it answers 200 whether or not this device still holds
  // the account — and a superseded device sat showing empty screens with
  // nothing to tell it why. The check has to ask about the device directly.

  // Role switcher (Account → role) — follow it to that role's home.
  useEffect(
    () =>
      onRoleChange((next) => {
        setRoleState(next);
        navigate([DEFAULT_ROUTE[next]]);
      }),
    []
  );

  // Bounce sections that don't apply to the current role (or that a
  // sub-admin wasn't granted). Replace, not push, so the back button
  // doesn't re-trigger the bounce.
  useEffect(() => {
    // Not until this browser has said who it is — see roleReady.
    if (!roleReady) return;
    if (!allowedSections.has(section)) {
      replace([homeRoute]);
    }
    // `billingOn` belongs in here: it is the one input that can change
    // while the teacher is standing still. Role and section only move
    // because she moved, but the switch is thrown by someone else, and
    // without this a teacher sitting on /plans when billing goes off
    // keeps the page — and the checkout button on it — until she happens
    // to navigate.
  }, [role, roleReady, section, perms, billingOn]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * The subjects under Classes, for a student.
   *
   * Not in the nav config because they are not static: a student holds
   * one grade and however many subjects teachers have invited them to.
   * Fetched once per session — a subject appearing mid-session means a
   * teacher just invited them, which a page load will pick up.
   */
  /**
   * A teacher's balance, for the warning that follows her around.
   *
   * It lived only in the studio, so a teacher who ran low while writing a
   * bulletin or planning a term saw nothing until the generation refused.
   * Every screen that can spend now shares one banner.
   */
  const [credits, setCredits] = useState<any>(null);
  useEffect(() => {
    if (role !== "teacher") return;
    let off = false;
    const load = () =>
      api("/api/auth/credits")
        .then((c: any) => {
          if (off) return;
          setCredits(c || null);
          setBillingOn(c?.billing_enabled !== false);
        })
        .catch(() => { if (!off) setBillingOn(true); });
    load();
    // The studio announces a spend the moment one lands.
    const onSpent = () => load();
    window.addEventListener("murchid:credits", onSpent);
    return () => { off = true; window.removeEventListener("murchid:credits", onSpent); };
  }, [role]);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [classesOpen, setClassesOpen] = useState(true);
  useEffect(() => {
    if (role !== "student") return;
    let off = false;

    const loadClasses = () => {
      api("/api/student/subjects")
        .then((r: any) => { if (!off) setSubjects(Array.isArray(r) ? r : []); })
        .catch(() => {});
    };
    loadClasses();

    /**
     * A newly joined class appears without a reload.
     *
     * The list was fetched once per session, so following an invitation
     * link left the new subject missing until a refresh.
     */
    const onChanged = () => loadClasses();
    window.addEventListener("murchid:classes-changed", onChanged);

    /**
     * Present, because they are here.
     *
     * The register a teacher would otherwise take by hand. Once per day
     * per teacher, and it writes nothing on a date already recorded — so
     * a teacher who corrected a mark is not overruled by the next page
     * load, and refreshing does not inflate anything.
     *
     * Deliberately silent: a student must never be kept out of their
     * work because a register failed, and there is nothing they could do
     * about it if they were told.
     */
    api("/api/student/present", { method: "POST" }).catch(() => {});
    return () => {
      off = true;
      window.removeEventListener("murchid:classes-changed", onChanged);
    };
  }, [role]);

  const nav = isAdmin
    ? adminNav(perms)
    : role === "super_admin" || role === "teacher" || role === "student"
      // The super admin already lists every surface, and neither a
      // teacher nor a student can hold a platform capability — the
      // database refuses one. Appending a section here would be dead
      // code in all three cases.
      ? NAV_BY_ROLE[role]
      : [...NAV_BY_ROLE[role], ...platformNav(perms)];
  const sidebarActive = section === "account" ? "account" : section;
  const handleNavClick = (key: string) => {
    // Classes is a container once it has subjects in it: clicking the
    // parent opens the list rather than navigating to a page that would
    // only repeat what is now directly underneath it.
    // A container once it has classes in it: clicking the parent opens
    // the list rather than navigating to a page that repeats what is now
    // directly underneath it.
    if (key === "student-classes" && subjects.length > 0) {
      setClassesOpen((o) => !o);
      return;
    }
    navigate(navTargetFor(key));
  };

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
          title={sidebarCollapsed ? "Show labels" : "Shrink to icons"}
          aria-label={sidebarCollapsed ? "Show sidebar labels" : "Shrink sidebar to icons"}
          aria-expanded={!sidebarCollapsed}
          className="murchid-sidebar-toggle hidden md:flex h-8 w-8 mt-3 rounded-md text-ink-soft hover:text-ink hover:bg-paper-warm items-center justify-center transition-colors"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={16} className="rtl:rotate-180" />
          ) : (
            <PanelLeftClose size={16} className="rtl:rotate-180" />
          )}
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
                  const button = (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item.key)}
                      data-tour={`nav-${item.key}`}
                      style={{ "--mi": myIndex } as React.CSSProperties}
                      className={`murchid-sidebar-item ${
                        isActive ? "murchid-sidebar-item-active" : ""
                      }`}
                      /* The only thing identifying an item once the rail
                         is icons-only. */
                      title={navT(item.key, item.label)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <NavBadge letter={item.letter} icon={item.icon} />
                      <span className="truncate flex-1">{navT(item.key, item.label)}</span>
                      {item.key === "student-classes" && subjects.length > 0 && (
                        <ChevronDown
                          size={13}
                          className={`flex-shrink-0 transition-transform ${classesOpen ? "" : "-rotate-90"}`}
                        />
                      )}
                    </button>
                  );

                  /**
                   * The student's subjects, nested under Classes.
                   *
                   * One grade, several subjects — a maths teacher and an
                   * English teacher each invited them separately, and each
                   * roster row is one of these. The teacher's name rides
                   * along because "Science" means nothing to a child with
                   * two science teachers.
                   */
                  if (item.key === "student-classes" && subjects.length > 0 && classesOpen) {
                    return (
                      <React.Fragment key={item.key}>
                        {button}
                        <div className="ms-6 ps-2 border-s border-line/70 space-y-0.5">
                          {subjects.map((sub: any) => {
                            const active = section === "student-class"
                              && pathname?.includes(sub.student_row_id);
                            return (
                              <button
                                key={sub.student_row_id}
                                onClick={() => navigate(["student-class", sub.student_row_id])}
                                title={`${sub.subject || "Class"}${sub.teacher ? ` · ${sub.teacher}` : ""}`}
                                className={`murchid-sidebar-item w-full ${active ? "murchid-sidebar-item-active" : ""}`}
                              >
                                <span className="truncate flex-1 text-start">
                                  {sub.subject || "Class"}
                                </span>
                                {sub.work_count > 0 && (
                                  <span className="font-mono text-[9px] text-muted flex-shrink-0">
                                    {sub.work_count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </React.Fragment>
                    );
                  }
                  return button;
                })}
              </div>
            </section>
          ));
        })()}
      </nav>

      {ALLOW_API_OVERRIDE && <DevApiEndpoint />}

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
          /* Teachers only, and only while there is something to upgrade to.
             `billingOn` rides on the credits fetch, which only runs for
             teachers — so for a super admin it stays null and this read as
             "show", leaving "Upgrade plan" in the menu of someone who has
             no plan, during a free period with no plans to sell. Two
             wrongs in one line. "Credits used" still stays in both modes:
             a teacher on a fixed grant needs to see where it went more
             than one on a plan does. */
          showUpgrade={role === "teacher" && billingOn !== false}
          onOpenSettings={() => navigate(["account"])}
          onOpenHelp={() => {
            const launcher = document.querySelector<HTMLButtonElement>(
              '[aria-label="Open the assistant"]'
            );
            if (launcher) launcher.click();
            else setHelpOpen(true);
          }}
          /* An existing teacher going to `signup` was the old behaviour and
             plainly wrong — she has an account; what she wants is a plan. */
          onUpgrade={() => navigate(["plans"])}
          /* Teachers only — a student has no balance to account for. */
          showUsage={role === "teacher"}
          onOpenUsage={() => navigate(["credit-usage"])}
          showBilling={role === "teacher" && billingOn !== false}
          onOpenBilling={() => navigate(["billing"])}
          onLogout={signOutFully}
          roles={heldRoles}
          activeRole={role}
          onSwitchRole={setRole}
        />
      </div>
    </>
  );

  return (
    <div
      className="murchid-studio-app murchid-studio-canvas h-[100dvh] flex text-ink font-sans overflow-hidden"
      data-panel={panel.present ? (panel.collapsed ? "closed" : "open") : "none"}
      data-rail={railIcons ? "icons" : "full"}
    >
      {/* Renders nothing until this device has been superseded, at which
          point it says so over the top of whatever is behind it. */}
      <DeviceNotice onSignOut={signOutFully} />

      {/* Desktop / iPad-landscape rail. Collapsing goes to an ICON RAIL,
          not to zero: the nav is how a teacher leaves this screen, and a
          collapsed state that removes it entirely trades one problem for
          a worse one. Width and the icons-only presentation are both
          driven by `data-rail` on the app root — see globals.css. */}
      <aside
        className="murchid-sidebar flex-shrink-0 h-full overflow-hidden print:hidden hidden md:block transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      >
        {/* The gutters live HERE, not on the aside — padding on a w-64
            aside around a w-64 column was 268px in a 256px clip, which
            silently cut the pane's right edge off. */}
        <div className="murchid-sidebar-col h-full py-3 ps-3 pe-1.5">
          <div className="murchid-sidebar-pane">{sidebarBody}</div>
        </div>
      </aside>

      {/* The second left column. Renders nothing unless the current
          section has registered content for it — see ContextPanel.tsx for
          why it sits here rather than inside the section. */}
      <ContextPanelRegion />

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
            // The panel supplies a gutter on this edge when it is there.
            panel.present ? "md:ps-6" : "md:ps-8"
          }`}
        >
          {/* One banner for every screen that can spend. The studio has
              its own estimate on the composer; this is the low-balance
              warning, which is worth seeing wherever she is working. */}
          {role === "teacher" && section !== "studio" && (
            <div className="max-w-[900px] mx-auto w-full">
              <CreditWarning credits={credits} />
            </div>
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
