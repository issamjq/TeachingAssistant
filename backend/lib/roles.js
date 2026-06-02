// Role catalog + env-driven allowlist resolution.
//
// Top-level roles (single source of truth — DB CHECK + zod enums import
// from here):
//
//   dev          — engineering. Does everything. Built-in for issa.mjq@gmail.com.
//   super_admin  — business pyramid top. Built-in for karaaliissa@gmail.com.
//                  Creates admin/moe/owner accounts (with sub-roles), grants
//                  teacher access. Per-role rules defined later.
//   admin        — operational layer. Has sub-roles (operations, accountant,
//                  support). Some sub-roles can grant teacher access.
//   moe          — Ministry of Education. Has sub-roles (head, inspector,
//                  staff). Pyramid: head sits above inspector/staff.
//   owner        — business owner. Read-only dashboards. No CRUD.
//   teacher      — paying user. Default role. Tenant-isolated.
//
// Privileged-role assignment is env-driven, NOT admin-UI driven. The five
// env vars below are comma-separated allowlists. An email present in
// SUPER_ADMIN_EMAILS gets role='super_admin' on every login; same for
// DEV/ADMIN/MOE/OWNER. The built-in fallbacks hard-pin the project owner
// and super admin so they have access before any Render env is configured.
//
//   SUPER_ADMIN_EMAILS=karaaliissa@gmail.com
//   DEV_EMAILS=issa.mjq@gmail.com
//   ADMIN_EMAILS=ops@example.com
//   MOE_EMAILS=inspector@moe.gov.ae
//   OWNER_EMAILS=founder@example.com
//
// Env precedence on login (POST /api/auth/firebase): if an email matches
// a privileged list, that role is written to the DB even on the UPDATE
// path. Env IS the source of truth for the FIVE non-teacher root roles.
//
// Sub-roles (admin/moe only) are NOT env-driven — they're assigned by
// super_admin through the SuperAdminConsole and stored in teachers.sub_role.

export const ROLES = [
  "dev",
  "super_admin",
  "admin",
  "moe",
  "owner",
  "teacher",
];
export const DEFAULT_ROLE = "teacher";

// Roles that bypass the subscription paywall — they don't pay, they
// operate the platform or read reports.
export const PRIVILEGED_ROLES = new Set([
  "dev",
  "super_admin",
  "admin",
  "moe",
  "owner",
]);
export const isPrivilegedRole = (role) => PRIVILEGED_ROLES.has(role);

// Sub-role taxonomy. Per-role allowed values. An empty array means the
// role has no sub-roles (sub_role must be NULL). The DB CHECK constraint
// is generated from this map (see backend/db/init.js).
export const SUB_ROLES = {
  dev:         [],
  super_admin: [],
  admin:       ["operations", "accountant", "support"],
  moe:         ["head", "inspector", "staff"],
  owner:       [],
  teacher:     [],
};

// Returns true if `sub` is a valid sub-role for `role` (including null
// when the role has no sub-roles).
export function isValidSubRole(role, sub) {
  if (sub == null || sub === "") return true;
  return (SUB_ROLES[role] || []).includes(sub);
}

// Roles a given actor can ASSIGN to another account. Per the pyramid:
//   dev          — every role
//   super_admin  — admin, moe, owner, teacher
//   admin        — depends on sub_role. operations can create teacher
//                  accounts; accountant/support cannot grant access.
//   everything else — no grant permission
//
// Returning a set (not a boolean) because the UI needs to filter the
// role dropdown by what the actor can pick.
export function rolesGrantableBy(actor) {
  if (!actor) return new Set();
  if (actor.role === "dev") {
    return new Set(ROLES);
  }
  if (actor.role === "super_admin") {
    return new Set(["admin", "moe", "owner", "teacher"]);
  }
  if (actor.role === "admin" && actor.sub_role === "operations") {
    return new Set(["teacher"]);
  }
  return new Set();
}

export function canGrantRole(actor, targetRole) {
  return rolesGrantableBy(actor).has(targetRole);
}

// Built-in privileged emails. Ensures access even before Render env vars
// are configured. Augmented by the corresponding *_EMAILS env list.
const BUILTIN_DEV_EMAILS         = ["issa.mjq@gmail.com"];
const BUILTIN_SUPER_ADMIN_EMAILS = ["karaaliissa@gmail.com"];

const parseList = (raw) =>
  (raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

// Read env lazily so test setups / dotenv loads after import still work.
function lists() {
  return {
    dev:         new Set([...BUILTIN_DEV_EMAILS,         ...parseList(process.env.DEV_EMAILS)]),
    super_admin: new Set([...BUILTIN_SUPER_ADMIN_EMAILS, ...parseList(process.env.SUPER_ADMIN_EMAILS)]),
    admin:       new Set(parseList(process.env.ADMIN_EMAILS)),
    moe:         new Set(parseList(process.env.MOE_EMAILS)),
    owner:       new Set(parseList(process.env.OWNER_EMAILS)),
  };
}

// Returns the env-resolved role for an email, or null if the email is
// not in any privileged list (caller should default to 'teacher').
// Precedence dev > super_admin > owner > admin > moe — if an email is
// listed under multiple, the most-powerful one wins.
export function resolveReservedRole(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  if (!e) return null;
  const L = lists();
  if (L.dev.has(e))         return "dev";
  if (L.super_admin.has(e)) return "super_admin";
  if (L.owner.has(e))       return "owner";
  if (L.admin.has(e))       return "admin";
  if (L.moe.has(e))         return "moe";
  return null;
}
