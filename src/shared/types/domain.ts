// Canonical domain types for the frontend.
//
// These mirror backend/lib/roles.js and the accounts table. Before the
// TypeScript migration, the role catalog was duplicated as plain arrays in
// both src/lib/role.js and backend/lib/roles.js with a "keep the two in
// sync" comment and nothing enforcing it. Naming the union here means a
// typo like "superadmin" (vs "super_admin") is now a compile error at every
// call site instead of a silently-failing permission check.
//
// Not imported from the backend directly: backend/lib/roles.js reads
// process.env at module scope and pulls in server-only concerns, so it
// can't be bundled for the browser.

// ── Roles ────────────────────────────────────────────────────────────
//
// The pyramid: dev > super_admin > admin > moe > owner > teacher.
export type Role =
  | "dev"
  | "super_admin"
  | "admin"
  | "moe"
  | "owner"
  | "teacher";

// Sub-roles exist only for admin and moe. Every other role must have
// sub_role === null (enforced by a DB CHECK generated from the backend map).
export type AdminSubRole = "operations" | "accountant" | "support";
export type MoeSubRole = "head" | "inspector" | "staff";
export type SubRole = AdminSubRole | MoeSubRole;

// Anything that can act on the system — what grant checks take.
export interface Actor {
  role: Role;
  sub_role?: SubRole | null;
}

// ── Permissions ──────────────────────────────────────────────────────
//
// `<surface>.<feature>`, lowercase and dot-separated. Stored as
// accounts.permissions JSONB; an empty object means "use role defaults".
export type PermissionKey =
  | "studio.lesson_plans"
  | "studio.quizzes"
  | "studio.homework"
  | "studio.presentations"
  | "studio.activities"
  | "studio.ai_studio"
  | "reports.dashboard"
  | "reports.attendance"
  | "reports.grades"
  | "reports.schools"
  | "reports.export_pdf"
  | "data.students"
  | "data.schools"
  | "data.schedule"
  | "data.library"
  | "account.edit_profile"
  | "account.change_plan"
  | "account.invite_others";

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

// ── Subscription ─────────────────────────────────────────────────────

export type PlanId = "monthly" | "quarterly" | "annual" | "trial";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

export interface Plan {
  id: PlanId;
  /** Effective AED per month — the big number on the pricing card. */
  perMonth: string;
  /** AED actually charged per billing cycle. */
  total: string;
  /** Discount vs paying monthly; 0 means none. */
  savePct: number;
  /** i18n suffix key part. */
  cycle: "mo" | "q" | "yr";
  /** Days a single paid cycle lasts — feeds subscription_ends_at. */
  durationDays: number;
  /** Flags the highlighted "best value" card. */
  best?: boolean;
}

// ── Account ──────────────────────────────────────────────────────────

export type AuthProvider = "google" | "outlook" | "email" | "microsoft";

export interface AccountProfile {
  firstName?: string;
  lastName?: string;
  staffId?: string;
  email?: string;
  bio?: string;
  gender?: "man" | "woman";
  avatarId?: string;
  avatarUrl?: string;
  majors?: string[];
  languages?: string[];
  grades?: string[];
  sections?: string[];
}

/**
 * The locally-cached account mirror (localStorage), not the server row.
 *
 * The server (`/api/auth/me`) is authoritative for `role`, `sub_role` and the
 * subscription fields — they're mirrored here only so the sidebar chip and
 * role-based nav can render synchronously on first paint without waiting for
 * a fetch. Never make an authorisation decision from these: every API route
 * re-checks server-side against the token.
 */
export interface Account {
  provider: AuthProvider;
  plan: PlanId;
  profile?: AccountProfile;
  email?: string;
  createdAt: number;
  role?: Role;
  sub_role?: SubRole | null;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionEndsAt?: string | null;
}

/** Shape queued during onboarding before the account row exists. */
export interface PendingSchool {
  school_id: number;
  is_primary: boolean;
}

// ── Language ─────────────────────────────────────────────────────────

export type Lang = "en" | "ar";
