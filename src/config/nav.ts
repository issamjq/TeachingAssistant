import type { Role } from "@/shared/types/domain";

// App-wide navigation config, lifted out of App.jsx.
//
// Lives in config/ rather than inside the studio-shell feature because more
// than one feature needs it: the shell renders the sidebar from it, and the
// dashboard routes its jump-tiles through navTargetFor so a tile and its nav
// item always land in the same place. The lint boundary caught the original
// placement — features must not reach into each other.
//
// Sectioned nav: italic Fraunces section headers with small letter/icon
// badges next to each label.

export interface NavItem {
  key: string;
  label: string;
  /** Semantic icon key, resolved to a lucide icon by the shell. */
  icon?: string;
  /** Mono letter badge — the fallback for anything without an icon. */
  letter?: string;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

// The teacher nav tells the product's story in section order: get
// oriented, plan the week, make the materials, run the classroom. The
// old scheme filed nine of fourteen items under one header called
// "Planners" — four of them content libraries that plan nothing.
const TEACHER_NAV: NavSection[] = [
  {
    section: "Overview",
    items: [
      // The working screen, and the one a teacher opens in the morning:
      // what am I teaching next, and is it ready. Dashboard stays as the
      // configurable overview it is, one rung down.
      { key: "week", label: "This week", icon: "week" },
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "studio", label: "Studio", icon: "studio" },
    ],
  },
  // When things happen. ONE calendar, not two: Calendar and Timetable
  // were the same week over the same table, drawn twice, with a
  // separate entry form each — so a lesson added in one was missing
  // from the other and nobody could say which was the real week. The
  // timetable folded into the calendar (day/week/month/agenda), which
  // is also the delivery surface: students receive work only through a
  // schedule slot (db/tune.sql §48). Goals stays its own thing — it
  // plans a term's arc, not a week's hours.
  {
    section: "Plan",
    items: [
      { key: "planner", label: "Calendar", icon: "scheduler" },
      { key: "goals", label: "Goals", icon: "goals" },
    ],
  },
  // What the teacher makes and reuses — the libraries, one per kind.
  {
    section: "Materials",
    items: [
      { key: "lesson-plans", label: "Lessons", icon: "lessons" },
      { key: "quizzes", label: "Quizzes", icon: "quizzes" },
      { key: "homework", label: "Homework", icon: "homework" },
      { key: "presentations", label: "Presentations", icon: "presentations" },
      { key: "activities", label: "Activities", icon: "activities" },
      { key: "library", label: "Templates", icon: "library" },
      // Her own uploads, as opposed to Templates, which is the curated
      // shelf the service publishes. Two different shelves, two words.
      { key: "materials", label: "Material", icon: "materials" },
    ],
  },
  // The class itself: who is in it, what they see, how they are doing.
  {
    section: "Classroom",
    items: [
      { key: "database", label: "Students", icon: "students" },
      { key: "bulletin-board", label: "Bulletin", icon: "bulletin" },
      { key: "reports", label: "Reports", icon: "reports" },
      { key: "teaching-skills", label: "Skills", icon: "skills" },
    ],
  },
];

// A sub-admin (the `admin` role) works the SAME platform surfaces as the
// super admin, but only the ones the super admin granted them. Each surface
// is gated by a capability (admin_can() in db/tune.sql §36); the nav below
// is the full set, filtered per grant by adminNav() at render time.
interface AdminSurface extends NavItem { cap: string; }
export const ADMIN_SURFACES: AdminSurface[] = [
  { cap: "admin.dashboard", key: "superadmin-dashboard", label: "Dashboard", icon: "dashboard" },
  { cap: "admin.accounts",  key: "superadmin-console",   label: "Accounts", icon: "keys" },
  { cap: "admin.dashboard", key: "superadmin-students",  label: "Students", icon: "students" },
  { cap: "admin.dashboard", key: "superadmin-orgs",      label: "Organisations", icon: "orgs" },
  { cap: "admin.analytics", key: "superadmin-product",   label: "Usage", icon: "activity" },
  { cap: "admin.friction",  key: "superadmin-friction",  label: "Friction", icon: "friction" },
  { cap: "admin.dashboard", key: "superadmin-usage",     label: "Tokens", icon: "tokens" },
  { cap: "admin.billing",   key: "superadmin-revenue",   label: "Revenue", icon: "coins" },
  { cap: "admin.platform",  key: "superadmin-costs",     label: "Pricing", icon: "pricing" },
  { cap: "admin.roles",     key: "superadmin-roles",     label: "Roles", icon: "shield" },
];

// Defaults an admin has before the super admin customises anything —
// mirrors ROLE_DEFAULTS.admin / admin_can(). Used until /api/me's resolved
// permissions arrive, so the sidebar doesn't flash empty.
export const DEFAULT_ADMIN_PERMS: Record<string, boolean> = {
  "admin.dashboard": true,
  "admin.accounts": true,
  "admin.analytics": true,
  "admin.friction": true,
  "admin.billing": false,
  "admin.platform": false,
  "admin.audit": false,
  "admin.roles": false,
};

type Perms = Record<string, boolean> | null | undefined;
const grantedSurfaces = (perms: Perms) =>
  ADMIN_SURFACES.filter((s) => (perms || DEFAULT_ADMIN_PERMS)[s.cap]);

/** The admin's sidebar — only the surfaces they were granted. */
export function adminNav(perms: Perms): NavSection[] {
  const items = grantedSurfaces(perms).map(({ key, label, icon }) => ({ key, label, icon }));
  return items.length ? [{ section: "Admin", items }] : [];
}
/** URL sections a granted admin may reach (plus their own account). */
export function adminSections(perms: Perms): Set<string> {
  const set = new Set(grantedSurfaces(perms).map((s) => s.key));
  set.add("account");
  return set;
}
/** Where an admin lands — their first granted surface. */
export function adminHome(perms: Perms): string {
  return grantedSurfaces(perms)[0]?.key || "account";
}

/**
 * The same surfaces, for a role that is NOT `admin`.
 *
 * `admin` is defined by its grants — take them away and there is no
 * screen left, which is why adminNav() returns the whole sidebar. An MoE
 * officer or an owner is different: they have a console of their own,
 * and a platform capability is something ADDED to it. Since db/tune.sql
 * §95 both can hold one, so both need somewhere for it to appear.
 *
 * Returns nothing at all when nothing is granted — the common case, and
 * an empty "Platform" heading over no items is worse than no heading.
 */
export function platformNav(perms: Perms): NavSection[] {
  const items = ADMIN_SURFACES.filter((s) => perms?.[s.cap]).map(({ key, label, icon }) => ({
    key,
    label,
    icon,
  }));
  return items.length ? [{ section: "Platform", items }] : [];
}

/** URL sections those grants open up, on top of the role's own. */
export function platformSections(perms: Perms): string[] {
  return ADMIN_SURFACES.filter((s) => perms?.[s.cap]).map((s) => s.key);
}

const ADMIN_NAV: NavSection[] = [
  { section: "Admin", items: ADMIN_SURFACES.map(({ key, label, icon }) => ({ key, label, icon })) },
];

const DEV_NAV: NavSection[] = [
  { section: "Dev", items: [{ key: "dev-console", label: "Console", icon: "terminal" }] },
];

const SUPERADMIN_NAV: NavSection[] = [
  {
    section: "Platform",
    items: [
      { key: "superadmin-dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "superadmin-console", label: "Accounts", icon: "keys" },
      { key: "superadmin-roles", label: "Roles", icon: "shield" },
    ],
  },
  // The two screens that answer "is the product working for people",
  // kept apart from the ones that answer "how many of them are there".
  // They are read at different times and by different people.
  {
    section: "Product",
    items: [
      { key: "superadmin-product", label: "Usage", icon: "activity" },
      { key: "superadmin-friction", label: "Friction", icon: "friction" },
      { key: "superadmin-students", label: "Students", icon: "students" },
      { key: "superadmin-orgs", label: "Organisations", icon: "orgs" },
    ],
  },
  {
    section: "Money",
    items: [
      { key: "superadmin-usage", label: "Tokens", icon: "tokens" },
      { key: "superadmin-revenue", label: "Revenue", icon: "coins" },
      { key: "superadmin-costs", label: "Pricing", icon: "pricing" },
    ],
  },
];

// `letter` badges were the fallback for a rail with no icon of its own.
// Both of these have one now, so the badge is a real mark rather than an
// initial standing in for a missing one.
const MOE_NAV: NavSection[] = [
  { section: "Ministry", items: [{ key: "moe-console", label: "Dashboard", icon: "ministry" }] },
];

// A student sees their own world, nothing else.
const STUDENT_NAV: NavSection[] = [
  {
    section: "Work",
    items: [
      { key: "student-dashboard", label: "Dashboard", icon: "dashboard" },
      /**
       * Classes expands into the subjects this student is taught.
       *
       * The children are not listed here because they are not static: a
       * student holds one grade and however many subjects teachers have
       * invited them to, which is known only at runtime. The shell fills
       * them in from /api/student/subjects.
       */
      { key: "student-classes", label: "Classes", icon: "lessons" },
      { key: "student-attendance", label: "Attendance", icon: "reports" },
    ],
  },
];

const OWNER_NAV: NavSection[] = [
  { section: "Owner", items: [{ key: "owner-console", label: "Dashboard", icon: "owner" }] },
];

export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  teacher: TEACHER_NAV,
  admin: ADMIN_NAV,
  dev: DEV_NAV,
  super_admin: SUPERADMIN_NAV,
  moe: MOE_NAV,
  owner: OWNER_NAV,
  student: STUDENT_NAV,
};

/** Landing section for each role when no section is specified. */
export const DEFAULT_ROUTE: Record<Role, string> = {
  teacher: "week",
  admin: "superadmin-dashboard",
  dev: "dev-console",
  super_admin: "superadmin-dashboard",
  moe: "moe-console",
  owner: "owner-console",
  student: "student-dashboard",
};

// Sections that get the Outlook-style right rail (mini-calendar + upcoming
// days). Planner already has its own calendar so it stays out.
export const TEACHING_RAIL_SECTIONS = new Set([
  "lesson-plans",
  "quizzes",
  "homework",
  "presentations",
  "activities",
]);

// Sections legitimately reachable from the URL bar for each role. Anything
// outside this list bounces back to the role's default — keeps a stale
// /quizzes from rendering for an admin who switched roles.
export const SECTIONS_BY_ROLE: Record<Role, Set<string>> = {
  teacher: new Set([
    "week",
    "dashboard",
    "studio",
    "planner",
    "goals",
    "library",
    "materials",
    "bulletin-board",
    "lesson-plans",
    "quizzes",
    "homework",
    "presentations",
    "activities",
    "database",
    "teaching-skills",
    "reports",
    "account",
    "plans",
    "credit-usage",
    "billing",
  ]),
  admin: new Set([
    "superadmin-dashboard", "superadmin-console", "superadmin-students",
    "superadmin-orgs", "superadmin-usage", "superadmin-revenue", "superadmin-costs",
    "superadmin-product", "superadmin-friction", "superadmin-roles", "account",
  ]),
  dev: new Set(["dev-console", "account"]),
  super_admin: new Set([
    "superadmin-dashboard", "superadmin-console", "superadmin-roles",
    "superadmin-product", "superadmin-friction", "superadmin-students",
    "superadmin-orgs", "superadmin-usage", "superadmin-revenue",
    "superadmin-costs", "account",
  ]),
  moe: new Set(["moe-console", "account"]),
  owner: new Set(["owner-console", "account"]),
  student: new Set([
    "student-dashboard", "student-classes", "student-class", "student-work",
    "student-attendance", "account",
  ]),
};

/** Where a nav key should navigate — some sections have a default sub-tab. */
export function navTargetFor(key: string): string[] {
  // Lessons lands on the teacher's own saved lessons now — the in-section
  // template list was superseded by the Template library section.
  if (key === "database") return ["database", "students"];
  // "schedule" is still the key a dashboard tile, an alert and the
  // assistant reach for — it is the word for the thing. There is just
  // one screen behind it now. Resolved here rather than left to the
  // config redirect so an in-app jump does not cost a round trip.
  if (key === "schedule") return ["planner"];
  return [key];
}
