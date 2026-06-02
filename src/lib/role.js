// Role catalog for the frontend. Mirrors backend/lib/roles.js — keep
// the two in sync (top-level roles + sub-role taxonomy + grant rules).
//
// The canonical role lives in the teachers row on the server (set by
// the env allowlist on login). The localStorage value here is a *dev
// preview override* — lets the operator preview another role's
// sidebar/views without re-auth.

const KEY = "murchid_role";

export const ROLES = [
  "dev",
  "super_admin",
  "admin",
  "moe",
  "owner",
  "teacher",
];

// Sub-role taxonomy per top-level role. Empty array = no sub-roles
// (the dropdown is hidden).
export const SUB_ROLES = {
  dev:         [],
  super_admin: [],
  admin:       ["operations", "accountant", "support"],
  moe:         ["head", "inspector", "staff"],
  owner:       [],
  teacher:     [],
};

export const ROLE_LABELS = {
  teacher:     "Teacher",
  admin:       "Admin",
  dev:         "Dev",
  super_admin: "Super admin",
  moe:         "MoE",
  owner:       "Owner",
};

export const SUB_ROLE_LABELS = {
  operations: "Operations",
  accountant: "Accountant",
  support:    "Support",
  head:       "Head",
  inspector:  "Inspector",
  staff:      "Staff",
};

export const ROLE_DESCRIPTIONS = {
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
export function rolesGrantableBy(actor) {
  if (!actor) return [];
  if (actor.role === "dev" || actor.role === "super_admin") return [...ROLES];
  if (actor.role === "admin" && actor.sub_role === "operations") return ["teacher"];
  return [];
}

export const getRole = () => {
  if (typeof localStorage === "undefined") return "teacher";
  const v = localStorage.getItem(KEY);
  return ROLES.includes(v) ? v : "teacher";
};

const listeners = new Set();
export const setRole = (r) => {
  if (!ROLES.includes(r)) return;
  localStorage.setItem(KEY, r);
  listeners.forEach((fn) => fn(r));
};
export const onRoleChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
