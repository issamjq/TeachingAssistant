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
  /** Unicode glyph badge. */
  icon?: string;
  /** Fallback mono letter badge. */
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
      { key: "dashboard", label: "Dashboard", icon: "◫" },
      { key: "studio", label: "AI Studio", icon: "✦" },
    ],
  },
  // "Planners" is the teacher's own word for everything they set. Grouped
  // by what a teacher makes rather than by which table it lands in —
  // lessons, quizzes and homework are one job to them even though the
  // schema stores them as one table discriminated by type.
  //
  // Exams are not a separate kind here. The schema has no exam type and
  // inventing a nav entry for a screen that would show quizzes is a dead
  // link with a different name on it, so exams live in Quizzes until
  // there is something that makes them genuinely different.
  {
    section: "Planners",
    items: [
      { key: "planner", label: "Planner", icon: "▦" },
      { key: "lesson-plans", label: "Lessons", letter: "L" },
      { key: "quizzes", label: "Quizzes & exams", letter: "Q" },
      { key: "homework", label: "Homework", letter: "H" },
      { key: "presentations", label: "Presentations", letter: "P" },
      { key: "activities", label: "Activities", letter: "A" },
      { key: "bulletin-board", label: "Bulletin board", letter: "B" },
    ],
  },
  {
    section: "Teacher",
    items: [
      { key: "database", label: "My students", letter: "C" },
      { key: "reports", label: "Reports", letter: "R" },
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
      { key: "admin-dashboard", label: "Dashboard", letter: "D" },
      { key: "admin-console", label: "Teachers", letter: "T" },
    ],
  },
];

const DEV_NAV: NavSection[] = [
  { section: "Dev", items: [{ key: "dev-console", label: "Dev console", letter: "D" }] },
];

const SUPERADMIN_NAV: NavSection[] = [
  {
    section: "Super admin",
    items: [
      { key: "superadmin-dashboard", label: "Dashboard", letter: "D" },
      { key: "superadmin-console", label: "Account access", letter: "A" },
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
