// Role catalog for the frontend. Mirrors the backend project's role catalog — keep
// the two in sync (top-level roles + sub-role taxonomy + grant rules).
//
// The canonical role lives in the accounts row on the server (set by
// the env allowlist on login). The localStorage value here is a *dev
// preview override* — lets the operator preview another role's
// sidebar/views without re-auth.
//
// The Role / SubRole unions live in shared/types/domain.ts so a typo like
// "superadmin" fails to compile rather than silently failing a check.
import type { Actor, Role, SubRole } from "../shared/types/domain";
import { readStorage, removeStorage, writeStorage } from "../shared/lib/storage";

const KEY = "murchid_role";

export const ROLES: readonly Role[] = [
  "dev",
  "super_admin",
  "admin",
  "moe",
  "owner",
  "teacher",
  "student",
];

// Sub-role taxonomy per top-level role. Empty array = no sub-roles
// (the dropdown is hidden).
export const SUB_ROLES: Record<Role, readonly SubRole[]> = {
  dev:         [],
  super_admin: [],
  admin:       ["operations", "accountant", "support"],
  moe:         ["head", "inspector", "staff"],
  owner:       [],
  teacher:     [],
  student:     [],
};

export const ROLE_LABELS: Record<Role, string> = {
  teacher:     "Teacher",
  admin:       "Admin",
  dev:         "Dev",
  super_admin: "Super admin",
  moe:         "MoE",
  owner:       "Owner",
  student:     "Student",
};

export const SUB_ROLE_LABELS: Record<SubRole, string> = {
  operations: "Operations",
  accountant: "Accountant",
  support:    "Support",
  head:       "Head",
  inspector:  "Inspector",
  staff:      "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  teacher:     "Your full personal teaching workspace — lessons, students, schedule, quizzes, homework.",
  admin:       "Manage teacher accounts and see system stats. No access to any teacher's content.",
  dev:         "Read-only data inspector, feature flags, and runtime info for debugging.",
  super_admin: "Pyramid top — manage account access for admin, MoE, owner, and teachers.",
  moe:         "Read-only dashboards and reports across schools. No studio access.",
  owner:       "Business owner — read-only dashboards for the metrics that matter.",
  student:     "Your own work — assigned quizzes and homework, scores, and attendance.",
};

// Mirror of backend rolesGrantableBy(). The actor's role + sub_role
// determines which top-level roles they can assign through the admin /
// super-admin UI. See the backend project's role catalog for the canonical rules.
export function rolesGrantableBy(actor: Actor | null | undefined): Role[] {
  if (!actor) return [];
  if (actor.role === "dev" || actor.role === "super_admin") return [...ROLES];
  if (actor.role === "admin" && actor.sub_role === "operations") return ["teacher"];
  return [];
}

// Narrows an untrusted string (localStorage, a URL param) to a real Role.
export const isRole = (v: unknown): v is Role =>
  typeof v === "string" && (ROLES as readonly string[]).includes(v);

export const getRole = (): Role => {
  const v = readStorage(KEY);
  return isRole(v) ? v : "teacher";
};

type RoleListener = (role: Role) => void;
const listeners = new Set<RoleListener>();

export const setRole = (r: Role): void => {
  if (!isRole(r)) return;
  writeStorage(KEY, r);
  listeners.forEach((fn) => fn(r));
};

/** Forget the stored role. Called on sign-out — see syncRoleFromServer. */
export const clearRole = (): void => {
  removeStorage(KEY);
};

/**
 * Make the account row the authority on what this browser may render.
 *
 * `murchid_role` was written only by the portal sign-ins, and read by
 * everything. So it survived the account that wrote it: a super admin
 * signing in left `super_admin` in localStorage, sign-out did not clear
 * it, and the next account on that device — a teacher, or one whose role
 * is NULL — opened the studio with the super-admin rail and landed on
 * /superadmin-dashboard. setRole() made it worse by design: it ignores a
 * value that is not a Role, so a null role did not reset the key, it
 * *kept* whatever was there.
 *
 * The data behind those screens was never exposed — every sa_* RPC
 * re-checks is_super_admin() in Postgres — but a console a teacher can
 * open is a bug whether or not it is populated.
 *
 * So: anything the server does not call a real role is a teacher, and the
 * key is written on every hydration rather than only at the portal.
 *
 * `dev` is the one exception, and it is the original purpose of this key:
 * a dev entering another portal previews that role's UI (portal.ts,
 * previewRoleForDev) while staying `dev` server-side. Overwriting the
 * local value would break that preview on the next /api/me, so a dev
 * keeps whatever they picked.
 */
export const syncRoleFromServer = (
  serverRole: unknown,
  serverRoles?: unknown
): void => {
  if (serverRole === "dev") return;
  const held = asRoles(serverRoles);
  const primary: Role = isRole(serverRole) ? serverRole : held[0] || "teacher";

  // Several roles: the one already chosen wins, so long as it is still one
  // of them. That is what makes the switcher stick — a teacher who is also
  // a student and picked the student view keeps it across reloads — and the
  // moment a role is taken away the browser falls back to the primary.
  const stored = getRole();
  const next: Role = held.length > 1 && held.includes(stored) ? stored : primary;

  // Compare against the *effective* role, not the raw key. On a browser
  // that has never stored one the key is absent while getRole() already
  // answers "teacher" — announcing a change there would bounce a teacher
  // who deep-linked to /planner back to /dashboard on every sign-in.
  const changed = stored !== next;
  writeStorage(KEY, next);
  if (changed) listeners.forEach((fn) => fn(next));
};

/** Narrow an untrusted list (an /api/me payload) to real Roles. */
export const asRoles = (v: unknown): Role[] =>
  Array.isArray(v) ? v.filter(isRole) : [];

export const onRoleChange = (fn: RoleListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
