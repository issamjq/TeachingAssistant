// Owner API — read-only business view. The owner is the "head" from a
// business perspective: they see how the product is performing across
// revenue, growth, retention, and overall activity, but they cannot
// edit accounts or permissions.
//
// Mounted at /api/owner/* with requireRole("owner", "super_admin", "dev").
// dev / super_admin can also reach these endpoints — handy for testing
// the owner surface from those accounts.
//
// Per-school scope tables don't exist yet, so for now every metric is
// system-wide. When the moe/owner→schools scope tables land, swap the
// SQL to filter by req.account.id's assigned schools.

import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { PLANS, TRIAL_PLAN_ID } from "../../src/lib/plans.js";

const router = Router();

// Effective per-month price for each paid plan (same calc as superadmin).
const MONTHLY_PRICE = Object.fromEntries(
  PLANS.map((p) => [p.id, Number(p.total) / (p.durationDays / 30)])
);
MONTHLY_PRICE[TRIAL_PLAN_ID] = 0;

// GET /api/owner/overview — the business KPIs the owner cares about.
//
// Differs from /api/superadmin/overview in framing: emphasis on revenue,
// active subscribers, and growth. No internal-roles breakdown (the
// owner doesn't manage operators), no audit trail. Just the numbers.
router.get("/overview", async (_req, res) => {
  try {
    const [accountsByRole, subs, activity, content, revenue] = await Promise.all([
      pool.query(`SELECT role, COUNT(*)::int AS n FROM accounts GROUP BY role`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status = 'trial')::int     AS trial,
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int    AS active,
          COUNT(*) FILTER (WHERE subscription_status = 'expired')::int   AS expired,
          COUNT(*) FILTER (WHERE subscription_status = 'suspended')::int AS suspended,
          COUNT(*) FILTER (
            WHERE subscription_status IN ('trial','active')
              AND subscription_ends_at IS NOT NULL
              AND subscription_ends_at <= NOW() + INTERVAL '30 days'
          )::int AS ending_30d
        FROM accounts
        WHERE role = 'teacher'
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE last_login_at::date = CURRENT_DATE)::int       AS logged_in_today,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int AS logged_in_7d,
          COUNT(*) FILTER (WHERE created_at  >= NOW() - INTERVAL '7 days')::int   AS new_signups_7d,
          COUNT(*) FILTER (WHERE created_at  >= NOW() - INTERVAL '30 days')::int  AS new_signups_30d
        FROM accounts
        WHERE role = 'teacher'
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM drafts        WHERE deleted_at IS NULL) AS drafts,
          (SELECT COUNT(*)::int FROM quizzes       WHERE deleted_at IS NULL) AS quizzes,
          (SELECT COUNT(*)::int FROM homework      WHERE deleted_at IS NULL) AS homework,
          (SELECT COUNT(*)::int FROM presentations WHERE deleted_at IS NULL) AS presentations,
          (SELECT COUNT(*)::int FROM activities    WHERE deleted_at IS NULL) AS activities,
          (SELECT COUNT(*)::int FROM students)                                AS students,
          (SELECT COUNT(*)::int FROM schools)                                 AS schools
      `),
      pool.query(`
        SELECT subscription_plan AS plan, COUNT(*)::int AS n
        FROM accounts
        WHERE role = 'teacher'
          AND subscription_status IN ('trial','active')
          AND subscription_plan IS NOT NULL
        GROUP BY subscription_plan
      `),
    ]);

    const byRole = Object.fromEntries(accountsByRole.rows.map((r) => [r.role, r.n]));

    const revenueByPlan = {};
    let mrr = 0;
    for (const r of revenue.rows) {
      const price = MONTHLY_PRICE[r.plan] || 0;
      revenueByPlan[r.plan] = Math.round(r.n * price * 100) / 100;
      mrr += r.n * price;
    }
    mrr = Math.round(mrr * 100) / 100;
    const arr = Math.round(mrr * 12 * 100) / 100;

    res.json({
      teachers: {
        total: byRole.teacher || 0,
        active_subs:    subs.rows[0].active,
        trial:          subs.rows[0].trial,
        expired:        subs.rows[0].expired,
        suspended:      subs.rows[0].suspended,
        ending_30d:     subs.rows[0].ending_30d,
      },
      growth: {
        new_signups_7d:  activity.rows[0].new_signups_7d,
        new_signups_30d: activity.rows[0].new_signups_30d,
        logged_in_today: activity.rows[0].logged_in_today,
        logged_in_7d:    activity.rows[0].logged_in_7d,
      },
      revenue: { mrr, arr, currency: "AED", by_plan: revenueByPlan },
      content: content.rows[0],
    });
  } catch (err) {
    handleErr(res, "GET /api/owner/overview", err);
  }
});

// GET /api/owner/signups?days=N — teacher-only signup timeseries.
// Owners track customer growth, not operator headcount, so the filter
// is `role = 'teacher'` here unlike the superadmin variant.
router.get("/signups", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
    const r = await pool.query(`
      WITH days AS (
        SELECT generate_series(
          (CURRENT_DATE - ($1::int - 1)),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      signups AS (
        SELECT created_at::date AS day, COUNT(*)::int AS n
        FROM accounts
        WHERE role = 'teacher'
          AND created_at >= NOW() - ($1::int || ' days')::interval
        GROUP BY day
      )
      SELECT d.day::text AS day, COALESCE(s.n, 0)::int AS n
      FROM days d LEFT JOIN signups s ON s.day = d.day
      ORDER BY d.day
    `, [days]);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/owner/signups", err);
  }
});

// GET /api/owner/activity?days=N — daily teacher logins (engagement
// signal — shows whether subscribers are actually using the product).
router.get("/activity", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
    const r = await pool.query(`
      WITH days AS (
        SELECT generate_series(
          (CURRENT_DATE - ($1::int - 1)),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      logins AS (
        SELECT created_at::date AS day, COUNT(DISTINCT account_id)::int AS n
        FROM audit_log
        WHERE action IN ('auth.login', 'auth.signup')
          AND created_at >= NOW() - ($1::int || ' days')::interval
        GROUP BY day
      )
      SELECT d.day::text AS day, COALESCE(l.n, 0)::int AS n
      FROM days d LEFT JOIN logins l ON l.day = d.day
      ORDER BY d.day
    `, [days]);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/owner/activity", err);
  }
});

export default router;
