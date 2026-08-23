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

const TEACHER_NAV: NavSection[] = [
  {
    section: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "studio", label: "AI Studio", icon: "studio" },
    ],
  },
  // "Planners" is everything the teacher sets ahead of time. Scheduler,
  // not "Planner" — inside a section called Planners, an item called
  // Planner said nothing; the thing it opens is the timetable.
  {
    section: "Planners",
    items: [
      { key: "planner", label: "Scheduler", icon: "scheduler" },
      { key: "goals", label: "Goal planner", icon: "goals" },
      { key: "library", label: "Template library", icon: "library" },
      { key: "lesson-plans", label: "Lessons", icon: "lessons" },
      { key: "quizzes", label: "Quizzes & exams", icon: "quizzes" },
      { key: "homework", label: "Homework", icon: "homework" },
      { key: "presentations", label: "Presentations", icon: "presentations" },
      { key: "activities", label: "Activities", icon: "activities" },
      { key: "bulletin-board", label: "Bulletin board", icon: "bulletin" },
    ],
  },
  {
    section: "Teacher",
    items: [
      { key: "database", label: "My students", icon: "students" },
      { key: "teaching-skills", label: "Teaching skills", icon: "skills" },
      { key: "reports", label: "Reports", icon: "reports" },
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
  { cap: "admin.platform",  key: "superadmin-costs",     label: "Credit costs", icon: "coins" },
];

// Defaults an admin has before the super admin customises anything —
// mirrors ROLE_DEFAULTS.admin / admin_can(). Used until /api/me's resolved
// permissions arrive, so the sidebar doesn't flash empty.
export const DEFAULT_ADMIN_PERMS: Record<string, boolean> = {
  "admin.dashboard": true,
  "admin.accounts": true,
  "admin.billing": false,
  "admin.platform": false,
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

const ADMIN_NAV: NavSection[] = [
  { section: "Admin", items: ADMIN_SURFACES.map(({ key, label, icon }) => ({ key, label, icon })) },
];

const DEV_NAV: NavSection[] = [
  { section: "Dev", items: [{ key: "dev-console", label: "Dev console", icon: "dashboard" }] },
];

const SUPERADMIN_NAV: NavSection[] = [
  {
    section: "Super admin",
    items: [
      { key: "superadmin-dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "superadmin-console", label: "Account access", icon: "keys" },
      { key: "superadmin-students", label: "Students", icon: "students" },
      { key: "superadmin-orgs", label: "Organisations", icon: "orgs" },
      { key: "superadmin-costs", label: "Credit costs", icon: "coins" },
    ],
  },
];

const MOE_NAV: NavSection[] = [
  { section: "Ministry", items: [{ key: "moe-console", label: "MoE console", letter: "M" }] },
];

// A student sees their own world, nothing else.
const STUDENT_NAV: NavSection[] = [
  {
    section: "My work",
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
  { section: "Owner", items: [{ key: "owner-console", label: "Owner console", letter: "O" }] },
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
  teacher: "planner",
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
    "dashboard",
    "studio",
    "planner",
    "goals",
    "library",
    "bulletin-board",
    "lesson-plans",
    "schedule",
    "quizzes",
    "homework",
    "presentations",
    "activities",
    "database",
    "teaching-skills",
    "reports",
    "account",
  ]),
  admin: new Set([
    "superadmin-dashboard", "superadmin-console", "superadmin-students",
    "superadmin-orgs", "superadmin-costs", "account",
  ]),
  dev: new Set(["dev-console", "account"]),
  super_admin: new Set(["superadmin-dashboard", "superadmin-console", "superadmin-students", "superadmin-orgs", "superadmin-costs", "account"]),
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
  return [key];
}
