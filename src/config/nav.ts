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
      { key: "reports", label: "Reports", icon: "reports" },
    ],
  },
];

/**
 * The pinned footer actions — settings, support and signing out.
 *
 * Separate from the sections above because they are not places in the
 * same sense: two are navigation, one opens the assistant, one ends the
 * session. Keeping them out of NAV_BY_ROLE means the role-bounce logic
 * in SECTIONS_BY_ROLE does not have to grow special cases for them.
 */
export interface NavAction {
  key: "account" | "support" | "logout";
  label: string;
  icon: string;
}

export const FOOTER_ACTIONS: NavAction[] = [
  { key: "account", label: "Settings", icon: "settings" },
  // Support opens the assistant rather than a page. It is already there,
  // it answers immediately, and a contact form that emails someone is a
  // worse answer to "how does the gradebook work".
  { key: "support", label: "Support", icon: "help" },
  { key: "logout", label: "Log out", icon: "logout" },
];

const ADMIN_NAV: NavSection[] = [
  {
    section: "Admin",
    items: [
      { key: "admin-dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "admin-console", label: "Teachers", icon: "students" },
    ],
  },
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
    ],
  },
];

const MOE_NAV: NavSection[] = [
  { section: "Ministry", items: [{ key: "moe-console", label: "MoE console", letter: "M" }] },
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
};

/** Landing section for each role when no section is specified. */
export const DEFAULT_ROUTE: Record<Role, string> = {
  teacher: "planner",
  admin: "admin-dashboard",
  dev: "dev-console",
  super_admin: "superadmin-dashboard",
  moe: "moe-console",
  owner: "owner-console",
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
    "bulletin-board",
    "lesson-plans",
    "schedule",
    "quizzes",
    "homework",
    "presentations",
    "activities",
    "database",
    "reports",
    "account",
  ]),
  admin: new Set(["admin-dashboard", "admin-console", "account"]),
  dev: new Set(["dev-console", "account"]),
  super_admin: new Set(["superadmin-dashboard", "superadmin-console", "account"]),
  moe: new Set(["moe-console", "account"]),
  owner: new Set(["owner-console", "account"]),
};

/** Where a nav key should navigate — some sections have a default sub-tab. */
export function navTargetFor(key: string): string[] {
  if (key === "lesson-plans") return ["lesson-plans", "templates"];
  if (key === "database") return ["database", "students"];
  return [key];
}
