// Super admin API — KPIs, time series, account detail, permissions edit.
//
// Mounted at /api/superadmin/* with requireRole("super_admin", "dev").
// dev gets in too because dev is the universal tester per the role
// pyramid (see backend/lib/roles.js).
//
// Read endpoints rely on aggregated SQL — no per-row fetching across
// the full accounts table. Revenue uses src/lib/plans.js as the price
// source of truth so the dashboard stays in sync with the marketing site.

import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { clientIp, userAgent } from "../lib/auth.js";
import { PLANS, TRIAL_PLAN_ID } from "../../src/lib/plans.js";
import { PERMISSION_KEYS } from "../../src/lib/permissions.js";

const router = Router();

// Effective per-month price for each paid plan, in AED. Used to
// compute MRR — total / months covered by one billing cycle.
const MONTHLY_PRICE = Object.fromEntries(
  PLANS.map((p) => [p.id, Number(p.total) / (p.durationDays / 30)])
);
MONTHLY_PRICE[TRIAL_PLAN_ID] = 0;

// GET /api/superadmin/overview — the headline KPIs for the dashboard.
//
//   {
//     accounts: { total, by_role: {teacher:N, admin:N, ...}, by_status: {...} },
//     subscriptions: { trial, active, expired, suspended, ending_30d },
//     revenue: { mrr, arr, by_plan: {monthly: aed, ...} },
//     activity: { logged_in_today, logged_in_7d, new_signups_7d },
//     content:  { drafts, quizzes, homework, presentations, activities, students }
//   }
router.get("/overview", async (_req, res) => {
  try {
    const [byRole, byStatus, subs, activity, content, revenue] = await Promise.all([
      pool.query(`SELECT role, COUNT(*)::int AS n FROM accounts GROUP BY role`),
      pool.query(`SELECT status, COUNT(*)::int AS n FROM accounts GROUP BY status`),
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
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE last_login_at::date = CURRENT_DATE)::int                       AS logged_in_today,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int               AS logged_in_7d,
          COUNT(*) FILTER (WHERE created_at  >= NOW() - INTERVAL '7 days')::int                 AS new_signups_7d
        FROM accounts
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM drafts        WHERE deleted_at IS NULL) AS drafts,
          (SELECT COUNT(*)::int FROM quizzes       WHERE deleted_at IS NULL) AS quizzes,
          (SELECT COUNT(*)::int FROM homework      WHERE deleted_at IS NULL) AS homework,
          (SELECT COUNT(*)::int FROM presentations WHERE deleted_at IS NULL) AS presentations,
          (SELECT COUNT(*)::int FROM activities    WHERE deleted_at IS NULL) AS activities,
          (SELECT COUNT(*)::int FROM students)                                AS students
      `),
      pool.query(`
        SELECT subscription_plan AS plan, COUNT(*)::int AS n
        FROM accounts
        WHERE subscription_status IN ('trial','active')
          AND subscription_plan IS NOT NULL
        GROUP BY subscription_plan
      `),
    ]);

    const accountsByRole = Object.fromEntries(byRole.rows.map((r) => [r.role, r.n]));
    const accountsByStatus = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n]));
    const total = byRole.rows.reduce((a, r) => a + r.n, 0);

    // MRR = sum(per-plan-count × per-plan monthly price).
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
      accounts: { total, by_role: accountsByRole, by_status: accountsByStatus },
      subscriptions: subs.rows[0],
      revenue: { mrr, arr, currency: "AED", by_plan: revenueByPlan },
      activity: activity.rows[0],
      content: content.rows[0],
    });
  } catch (err) {
    handleErr(res, "GET /api/superadmin/overview", err);
  }
});

// GET /api/superadmin/signups?days=30
// Daily signup counts for the chart. Pads zero-days so the chart line
// is contiguous instead of skipping empty dates.
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
        WHERE created_at >= NOW() - ($1::int || ' days')::interval
        GROUP BY day
      )
      SELECT d.day::text AS day, COALESCE(s.n, 0)::int AS n
      FROM days d LEFT JOIN signups s ON s.day = d.day
      ORDER BY d.day
    `, [days]);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/superadmin/signups", err);
  }
});

// GET /api/superadmin/logins?days=30
// Daily login counts derived from audit_log (auth.login + auth.signup).
router.get("/logins", async (req, res) => {
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
        SELECT created_at::date AS day, COUNT(*)::int AS n
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
    handleErr(res, "GET /api/superadmin/logins", err);
  }
});

// GET /api/superadmin/recent-activity?limit=20
// Recent audit-log events, joined to accounts for display.
router.get("/recent-activity", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const r = await pool.query(`
      SELECT a.id, a.action, a.target_table, a.target_id, a.detail, a.created_at,
             acc.first_name, acc.last_name, acc.email, acc.role
      FROM audit_log a
      LEFT JOIN accounts acc ON acc.id = a.account_id
      ORDER BY a.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/superadmin/recent-activity", err);
  }
});

// GET /api/superadmin/account/:id — full detail for the drawer.
//
// Returns the account row + content counts + assigned schools.
router.get("/account/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    const [acc, content, schools] = await Promise.all([
      pool.query(`
        SELECT id, first_name, last_name, email, phone, staff_id, role, sub_role, status,
               auth_uid, avatar_url, nationality, hire_date, bio,
               majors, grade_levels, languages, sections, class_map, grade_sections,
               subscription_status, subscription_ends_at, subscription_plan,
               last_login_at, last_login_ip, permissions,
               created_at, updated_at
          FROM accounts WHERE id = $1
      `, [id]),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM drafts        WHERE account_id = $1 AND deleted_at IS NULL) AS drafts,
          (SELECT COUNT(*)::int FROM quizzes       WHERE account_id = $1 AND deleted_at IS NULL) AS quizzes,
          (SELECT COUNT(*)::int FROM homework      WHERE account_id = $1 AND deleted_at IS NULL) AS homework,
          (SELECT COUNT(*)::int FROM presentations WHERE account_id = $1 AND deleted_at IS NULL) AS presentations,
          (SELECT COUNT(*)::int FROM activities    WHERE account_id = $1 AND deleted_at IS NULL) AS activities,
          (SELECT COUNT(*)::int FROM students      WHERE account_id = $1) AS students,
          (SELECT COUNT(*)::int FROM templates     WHERE account_id = $1 AND deleted_at IS NULL) AS templates
      `, [id]),
      pool.query(`
        SELECT s.id, s.name, s.emirate, asn.is_primary
        FROM account_schools asn
        JOIN schools s ON s.id = asn.school_id
        WHERE asn.account_id = $1
        ORDER BY asn.is_primary DESC, s.name
      `, [id]),
    ]);
    if (acc.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({
      ...acc.rows[0],
      content: content.rows[0],
      schools: schools.rows,
    });
  } catch (err) {
    handleErr(res, "GET /api/superadmin/account/:id", err);
  }
});

// PATCH /api/superadmin/account/:id/permissions
//
// Body: { permissions: { "studio.lesson_plans": true, ... } } — object
// whose keys are validated against PERMISSION_KEYS. Unknown keys are
// stripped before write. Empty object resets to role defaults.
const PermissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
}).strip();

router.patch("/account/:id/permissions", validateBody(PermissionsSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    // Strip any key not in the catalog — defends against a payload that
    // tries to inject arbitrary permission strings into the JSONB.
    const filtered = {};
    for (const [k, v] of Object.entries(req.body.permissions || {})) {
      if (PERMISSION_KEYS.includes(k)) filtered[k] = !!v;
    }
    const r = await pool.query(
      `UPDATE users u SET permissions = $1::jsonb, updated_at = now()
         FROM faculty f
        WHERE f.id = $2::uuid AND u.id = f.user_id
        RETURNING f.id, u.permissions`,
      [JSON.stringify(filtered), id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    await recordAudit({
      accountId: req.account.user_id,
      action: "superadmin.permissions.update",
      targetTable: "faculty",
      targetId: id,
      ip: clientIp(req), userAgent: userAgent(req),
      detail: { keys: Object.keys(filtered) },
    });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/superadmin/account/:id/permissions", err);
  }
});

export default router;
