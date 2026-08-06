// Role catalog for the frontend. Mirrors backend/lib/roles.js — keep
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

const KEY = "murchid_role";

export const ROLES: readonly Role[] = [
  "dev",
  "super_admin",
  "admin",
  "moe",
  "owner",
  "teacher",
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
};

export const ROLE_LABELS: Record<Role, string> = {
  teacher:     "Teacher",
  admin:       "Admin",
  dev:         "Dev",
  super_admin: "Super admin",
  moe:         "MoE",
  owner:       "Owner",
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
};

// Mirror of backend rolesGrantableBy(). The actor's role + sub_role
// determines which top-level roles they can assign through the admin /
// super-admin UI. See backend/lib/roles.js for the canonical rules.
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
  if (typeof localStorage === "undefined") return "teacher";
  const v = localStorage.getItem(KEY);
  return isRole(v) ? v : "teacher";
};

type RoleListener = (role: Role) => void;
const listeners = new Set<RoleListener>();

export const setRole = (r: Role): void => {
  if (!isRole(r)) return;
  localStorage.setItem(KEY, r);
  listeners.forEach((fn) => fn(r));
};

export const onRoleChange = (fn: RoleListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
