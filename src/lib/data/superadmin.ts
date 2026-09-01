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

  /**
   * The master billing switch (db/tune.sql §89). Read tells the console
   * which mode the platform is in and how many accounts a flip would
   * rewrite; write flips it AND reconciles credits and subscriptions in
   * the same transaction — the RPC is the only correct way to move it,
   * which is why this does not go through the generic flag setter below.
   */
  if (a === "billing-mode") {
    if (method === "GET") return yes(await rpc("sa_billing_mode"));
    if (method === "PATCH")
      return yes(await rpc("sa_set_billing", { p_enabled: !!body?.enabled }));
  }

  /**
   * Product analytics (db/tune.sql §95). Everything here reads the
   * event ledger the browser writes through lib/telemetry.ts, plus the
   * content tables for the parts that must answer for accounts older
   * than the ledger — the funnel and the retention grid.
   */
  if (a === "product") {
    const days = int(q.get("days"), 30);
    if (b === "overview" && method === "GET")
      return yes(await rpc("sa_product_overview", { p_days: days }));
    if (b === "screens" && method === "GET")
      return yes(await rpc("sa_screen_usage", { p_days: days }));
    if (b === "activity-heatmap" && method === "GET")
      return yes(await rpc("sa_activity_heatmap", {
        p_days: days,
        p_tz: q.get("tz") || "Asia/Dubai",
      }));
    if (b === "click-heatmap" && method === "GET")
      return yes(await rpc("sa_click_heatmap", {
        // No section means every screen at once, which is the right
        // default: the first question is "where does anyone click", and
        // picking a screen before seeing that is guessing.
        p_section: q.get("section") || null,
        p_days: days,
        p_bins: int(q.get("bins"), 24),
      }));
    if (b === "adoption" && method === "GET")
      return yes(await rpc("sa_feature_adoption", { p_days: days }));
    if (b === "journey" && method === "GET")
      return yes(await rpc("sa_journey", { p_days: int(q.get("days"), 90) }));
    if (b === "retention" && method === "GET")
      return yes(await rpc("sa_retention", { p_weeks: int(q.get("weeks"), 10) }));
  }

  // Friction is its own capability, not a slice of analytics: these two
  // have people's names on them.
  if (a === "friction" && !b && method === "GET")
    return yes(await rpc("sa_friction", {
      p_days: int(q.get("days"), 30),
      p_limit: int(q.get("limit"), 40),
    }));
  if (a === "stuck-users" && method === "GET")
    return yes(await rpc("sa_stuck_users", {
      p_days: int(q.get("days"), 30),
      p_limit: int(q.get("limit"), 25),
    }));

  /**
   * Roles and capabilities. The matrix read is gated on admin.roles so a
   * trusted admin can be given the access screen; every WRITE below is
   * sa_require() in the database — a super admin, no delegation — because
   * the capability that grants capabilities is the one nobody should be
   * able to grant themselves.
   */
  if (a === "roles") {
    if (!b && method === "GET") return yes(await rpc("sa_role_matrix"));
    if (b === "cap" && method === "PATCH")
      return yes(await rpc("sa_set_role_cap", {
        p_role: body?.role,
        p_cap: body?.cap,
        p_allowed: !!body?.allowed,
      }));
  }

  // Housekeeping: the event ledger keeps 180 days, and this is what
  // trims it. Deliberately manual — see sa_prune_events.
  if (a === "prune-events" && method === "POST")
    return yes(await rpc("sa_prune_events", { p_days: Number(body?.days) || 180 }));

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
    // Remove one key so the account falls back to its role's default.
    // The matrix can only set true or false; without this there is no
    // way back to "whatever the role says", and an account silently
    // pinned to an old default is the bug that outlives the decision.
    if (c === "permissions" && method === "DELETE")
      return yes(await rpc("sa_clear_account_cap", { p_faculty: b, p_cap: body?.cap }));
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
