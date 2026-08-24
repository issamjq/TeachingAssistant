// =====================================================================
// The super-admin surface, answered by the database
//
// The admin / super_admin consoles used to be endpoints on the separate
// backend. Every one of them is now a SECURITY DEFINER function in
// Postgres (db/tune.sql §30), each of which checks is_super_admin() as
// its first act — so a teacher's token calling one is refused by the
// function body, not by hoping the UI hid the control.
//
// This file is the thin translation between the paths the console screens
// already call — /api/admin/stats, /api/superadmin/overview, … — and
// those RPCs. It mirrors entities.ts: return the exact shape the screens
// were written against, throw the raw Supabase error so apiClient can
// turn a 42501 into a clean 403.
//
// The HYBRID boundary lives here as `{ handled: false }`: the two
// operations a definer function genuinely cannot do — creating an
// auth.users row and hard-deleting an account — fall through to the
// backend instead, surfacing as "not connected yet" until it is built.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";
import type { Handled } from "./index";

const yes = (data: unknown): Handled => ({ handled: true, data });
const no: Handled = { handled: false };

async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

const int = (v: string | null, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ── /api/admin/* — stats, the account table, and the status / role /
// delete writes the access console fires. Shared with the admin console,
// which reaches the same subset. ────────────────────────────────────────
export async function resolveAdmin(seg: string[], method: string, body: any): Promise<Handled> {
  const [, a, b, c] = seg; // ["admin", a, b, c]

  if (a === "stats" && method === "GET") return yes(await rpc("sa_stats"));

  if (a === "teachers") {
    // Create is the one write that needs the GoTrue admin key — it has to
    // make an auth.users row. Left to the backend on purpose.
    if (!b && method === "POST") return no;
    if (!b && method === "GET") return yes(await rpc("sa_accounts"));
    if (b && c === "status" && method === "PATCH")
      return yes(await rpc("sa_set_status", { p_faculty: b, p_status: body?.status }));
    if (b && c === "role" && method === "PATCH")
      return yes(await rpc("sa_set_role", { p_faculty: b, p_role: body?.role, p_sub_role: body?.sub_role ?? "" }));
    if (b && !c && method === "DELETE")
      return yes(await rpc("sa_delete_account", { p_faculty: b }));
  }

  return no;
}

// ── /api/superadmin/* — the dashboard's projections plus the drawer's
// per-account reads and privileged writes (permissions, credits,
// subscription), and the platform feature-flag toggles. ─────────────────
export async function resolveSuperadmin(
  seg: string[],
  method: string,
  body: any,
  q: URLSearchParams
): Promise<Handled> {
  const [, a, b, c] = seg; // ["superadmin", a, b, c]

  if (a === "overview" && method === "GET") return yes(await rpc("sa_overview"));

  // AI usage: what our users burned, what we charged for it, and what it
  // cost us upstream. The one place both numbers sit in the same row.
  /**
   * The revenue side. Read-only, and summed from `payments` rather than
   * from the plan price — a plan price says what a teacher SHOULD pay;
   * only a payment row says what arrived.
   */
  if (a === "revenue") {
    const days = int(q.get("days"), 30);
    if (b === "overview" && method === "GET")
      return yes(await rpc("sa_revenue_overview", { p_days: days }));
    if (b === "users" && !c && method === "GET")
      return yes(await rpc("sa_revenue_by_user", { p_limit: int(q.get("limit"), 100) }));
    if (b === "users" && c && method === "GET")
      return yes(await rpc("sa_payments_for", { p_faculty: c, p_limit: int(q.get("limit"), 50) }));
  }

  if (a === "ai") {
    const days = int(q.get("days"), 30);
    if (b === "overview" && method === "GET") return yes(await rpc("sa_ai_overview", { p_days: days }));
    if (b === "features" && method === "GET") return yes(await rpc("sa_ai_by_feature", { p_days: days }));
    if (b === "daily" && method === "GET") return yes(await rpc("sa_ai_daily", { p_days: days }));
    if (b === "users" && !c && method === "GET")
      return yes(await rpc("sa_ai_by_user", { p_days: days, p_limit: int(q.get("limit"), 100) }));
    if (b === "users" && c && method === "GET")
      return yes(await rpc("sa_ai_user", { p_faculty: c, p_days: days }));
  }
  if (a === "signups" && method === "GET")
    return yes(await rpc("sa_signups", { p_days: int(q.get("days"), 30) }));
  if (a === "logins" && method === "GET")
    return yes(await rpc("sa_logins", { p_days: int(q.get("days"), 30) }));
  if (a === "recent-activity" && method === "GET")
    return yes(await rpc("sa_recent_activity", { p_limit: int(q.get("limit"), 15) }));

  if (a === "flags") {
    if (!b && method === "GET") return yes(await rpc("sa_flags"));
    if (b && method === "PATCH")
      return yes(await rpc("sa_set_flag", { p_key: b, p_enabled: !!body?.enabled }));
  }

  // Per-feature AI credit costs — what each generation charges a teacher.
  if (a === "credit-costs") {
    if (!b && method === "GET") return yes(await rpc("sa_credit_costs"));
    if (b && method === "PATCH")
      return yes(await rpc("sa_set_credit_cost", { p_feature: b, p_cost: Number(body?.cost) || 0 }));
  }

  // Students — the people teachers teach, and what they're doing.
  if (a === "students-overview" && method === "GET") return yes(await rpc("sa_students_overview"));
  if (a === "students" && method === "GET")
    return yes(await rpc("sa_students", { p_limit: int(q.get("limit"), 100), p_search: q.get("search") }));
  if (a === "student-activity" && method === "GET")
    return yes(await rpc("sa_student_activity", { p_limit: int(q.get("limit"), 20) }));
  /**
   * The only delete that reaches the person.
   *
   * A teacher's Delete removes her own roster row and nothing else. This
   * one removes the row AND the login behind it, when that row was the
   * last one the student held — otherwise a deleted student leaves an
   * account that can sign in and match nothing.
   */
  if (a === "students" && b && method === "DELETE")
    return yes(await rpc("sa_delete_student", { p_student: b, p_purge_account: true }));

  // Organisations (schools) — where teaching happens, and their output.
  if (a === "orgs-overview" && method === "GET") return yes(await rpc("sa_orgs_overview"));
  if (a === "orgs" && method === "GET")
    return yes(await rpc("sa_orgs", { p_limit: int(q.get("limit"), 100) }));
  if (a === "org-activity" && method === "GET")
    return yes(await rpc("sa_org_activity", { p_limit: int(q.get("limit"), 20) }));

  if (a === "account" && b) {
    if (!c && method === "GET") return yes(await rpc("sa_account", { p_faculty: b }));
    if (c === "content" && method === "GET")
      return yes(await rpc("sa_account_content", { p_faculty: b, p_limit: int(q.get("limit"), 40) }));
    if (c === "permissions" && method === "PATCH")
      return yes(await rpc("sa_set_permissions", { p_faculty: b, p_perms: body?.permissions ?? {} }));
    if (c === "credits" && method === "PATCH")
      return yes(await rpc("sa_adjust_credits", {
        p_faculty: b,
        p_balance: body?.balance ?? null,
        p_allowance: body?.allowance ?? null,
      }));
    // Grant / deduct a delta — "give more tokens" — vs. the absolute set above.
    if (c === "grant-credits" && method === "POST")
      return yes(await rpc("sa_grant_credits", { p_faculty: b, p_delta: Number(body?.delta) || 0 }));
    if (c === "subscription" && method === "PATCH")
      return yes(await rpc("sa_set_subscription", {
        p_faculty: b,
        p_plan: body?.plan ?? null,
        p_status: body?.status ?? null,
        p_ends_at: body?.ends_at ?? null,
      }));
    // Delete the subscription row outright.
    if (c === "subscription" && method === "DELETE")
      return yes(await rpc("sa_remove_subscription", { p_faculty: b }));
    // One-click upgrade to a plan for its natural duration.
    if (c === "activate-plan" && method === "POST")
      return yes(await rpc("sa_activate_plan", { p_faculty: b, p_plan: body?.plan }));
    // Extend the current period by N days.
    if (c === "extend" && method === "POST")
      return yes(await rpc("sa_extend_subscription", { p_faculty: b, p_days: Number(body?.days) || 0 }));
    // Cancel but keep the row (writes stop, reads keep working).
    if (c === "cancel-subscription" && method === "POST")
      return yes(await rpc("sa_cancel_subscription", { p_faculty: b }));
  }

  return no;
}

/**
 * Record the caller's own sign-in / sign-up in the audit trail. Any
 * authenticated user may call it — the actor is always their own uid, so
 * there is nothing to escalate — and it is what gives the dashboard's
 * logins / signups charts real data. Best-effort: a failure here must
 * never block a sign-in, so callers swallow the rejection.
 */
export async function recordAuthEvent(kind: "login" | "signup"): Promise<void> {
  await supabase.rpc("record_auth_event", { p_kind: kind });
}
