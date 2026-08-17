// Permission catalog. The super admin drawer lets a head-of-project
// override these per-account; the studio (when feature-gating is wired
// in) reads `account.permissions[key]` to decide whether to render a
// surface. Empty `permissions` JSON means "use the role's defaults".
//
// Storage: accounts.permissions JSONB. Reads/writes go through
// /api/superadmin/account/:id/permissions.
//
// Key conventions: `<surface>.<feature>` lowercased, dot-separated.

// ⚠️ THIS FILE MUST STAY PLAIN JAVASCRIPT.
// The superadmin console's backend imports PERMISSION_KEYS from here to validate
// permission payloads. Node runs it untranspiled, so a .ts extension breaks
// the API server at boot. Types come from JSDoc, read by TypeScript via
// allowJs.

/** @typedef {import("../shared/types/domain").PermissionKey} PermissionKey */
/** @typedef {import("../shared/types/domain").PermissionMap} PermissionMap */
/** @typedef {import("../shared/types/domain").Role} Role */
/** @typedef {{ key: PermissionKey, label: string }} PermissionEntry */
/** @typedef {{ id: string, label: string, description: string, keys: PermissionEntry[] }} PermissionGroup */

export const PERMISSION_GROUPS = /** @type {PermissionGroup[]} */ ([
  {
    id: "studio",
    label: "Studio",
    description: "Teaching builders — what the user can author.",
    keys: [
      { key: "studio.lesson_plans",  label: "Lesson plans" },
      { key: "studio.quizzes",       label: "Quizzes" },
      { key: "studio.homework",      label: "Homework" },
      { key: "studio.presentations", label: "Presentations" },
      { key: "studio.activities",    label: "Activities" },
      { key: "studio.ai_studio",     label: "AI studio (generation)" },
    ],
  },
  {
    id: "reports",
    label: "Reports & dashboards",
    description: "Read-only views of the data this user has access to.",
    keys: [
      { key: "reports.dashboard",  label: "Main dashboard" },
      { key: "reports.attendance", label: "Attendance reports" },
      { key: "reports.grades",     label: "Grades reports" },
      { key: "reports.schools",    label: "Schools overview" },
      { key: "reports.export_pdf", label: "PDF export" },
    ],
  },
  {
    id: "data",
    label: "Data management",
    description: "Records the user can read or edit.",
    keys: [
      { key: "data.students",  label: "Students" },
      { key: "data.schools",   label: "Schools" },
      { key: "data.schedule",  label: "Schedule" },
      { key: "data.library",   label: "Library resources" },
    ],
  },
  {
    id: "account",
    label: "Account & billing",
    description: "What this user can change about themselves.",
    keys: [
      { key: "account.edit_profile",  label: "Edit own profile" },
      { key: "account.change_plan",   label: "Change subscription plan" },
      { key: "account.invite_others", label: "Invite other users" },
    ],
  },
]);

// Flat catalog for validation (every legal key).
export const PERMISSION_KEYS = /** @type {PermissionKey[]} */ (
  PERMISSION_GROUPS.flatMap((g) => g.keys.map((k) => k.key))
);

// Role defaults — applied when the per-account override doesn't set a
// key. Heads-up: this is the source of truth for "out of the box"
// permissions per role. The super admin can override on a per-account
// basis through the drawer.
export const ROLE_DEFAULTS = /** @type {Record<Role, PermissionMap>} */ ({
  dev: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])),
  super_admin: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])),
  admin: {
    "studio.lesson_plans":  false,
    "studio.quizzes":       false,
    "studio.homework":      false,
    "studio.presentations": false,
    "studio.activities":    false,
    "studio.ai_studio":     false,
    "reports.dashboard":    true,
    "reports.attendance":   true,
    "reports.grades":       true,
    "reports.schools":      true,
    "reports.export_pdf":   true,
    "data.students":        false,
    "data.schools":         true,
    "data.schedule":        false,
    "data.library":         false,
    "account.edit_profile": true,
    "account.change_plan":  false,
    "account.invite_others": true,
  },
  moe: {
    "studio.lesson_plans":  false,
    "studio.quizzes":       false,
    "studio.homework":      false,
    "studio.presentations": false,
    "studio.activities":    false,
    "studio.ai_studio":     false,
    "reports.dashboard":    true,
    "reports.attendance":   true,
    "reports.grades":       true,
    "reports.schools":      true,
    "reports.export_pdf":   true,
    "data.students":        false,
    "data.schools":         true,
    "data.schedule":        false,
    "data.library":         false,
    "account.edit_profile": true,
    "account.change_plan":  false,
    "account.invite_others": false,
  },
  owner: {
    "studio.lesson_plans":  false,
    "studio.quizzes":       false,
    "studio.homework":      false,
    "studio.presentations": false,
    "studio.activities":    false,
    "studio.ai_studio":     false,
    "reports.dashboard":    true,
    "reports.attendance":   false,
    "reports.grades":       false,
    "reports.schools":      true,
    "reports.export_pdf":   true,
    "data.students":        false,
    "data.schools":         false,
    "data.schedule":        false,
    "data.library":         false,
    "account.edit_profile": true,
    "account.change_plan":  false,
    "account.invite_others": false,
  },
  teacher: {
    "studio.lesson_plans":  true,
    "studio.quizzes":       true,
    "studio.homework":      true,
    "studio.presentations": true,
    "studio.activities":    true,
    "studio.ai_studio":     true,
    "reports.dashboard":    true,
    "reports.attendance":   true,
    "reports.grades":       true,
    "reports.schools":      false,
    "reports.export_pdf":   true,
    "data.students":        true,
    "data.schools":         true,
    "data.schedule":        true,
    "data.library":         true,
    "account.edit_profile": true,
    "account.change_plan":  true,
    "account.invite_others": false,
  },
  // A student is not a manager of anything — they see their own work only.
  // None of the teacher/admin permission keys apply, so every one denies;
  // their surface is gated by role, not by this matrix.
  student: {
    "account.edit_profile": true,
  },
});

// Resolve the effective permissions for an account: per-account
// overrides take precedence over the role defaults. Keys not set in
// either fall back to false (deny by default).
/** @typedef {{ role: Role, permissions?: PermissionMap | null }} PermissionedAccount */

/**
 * Effective permissions for an account: per-account overrides win over role
 * defaults; anything set in neither denies.
 * @param {PermissionedAccount | null | undefined} account
 * @returns {PermissionMap}
 */
export function resolvePermissions(account) {
  if (!account) return {};
  const defaults = ROLE_DEFAULTS[account.role] || {};
  const overrides =
    account.permissions && typeof account.permissions === "object"
      ? account.permissions
      : {};
  const out = /** @type {PermissionMap} */ ({});
  for (const k of PERMISSION_KEYS) {
    out[k] = k in overrides ? !!overrides[k] : !!defaults[k];
  }
  return out;
}

/**
 * @param {PermissionedAccount | null | undefined} account
 * @param {PermissionKey} key
 * @returns {boolean}
 */
export function isPermitted(account, key) {
  return resolvePermissions(account)[key] === true;
}
