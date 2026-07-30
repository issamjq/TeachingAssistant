import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { clientIp, userAgent, invalidateAccountById } from "../lib/auth.js";
import { canGrantRole, ROLES, isValidSubRole } from "../lib/roles.js";
import { PLANS, TRIAL_PLAN_ID } from "../../src/lib/plans.js";

const MONTHLY_PRICE = Object.fromEntries(
  PLANS.map((p) => [p.id, Number(p.total) / (p.durationDays / 30)])
);
MONTHLY_PRICE[TRIAL_PLAN_ID] = 0;

// Admin endpoints — manage teacher accounts, never see their content.
//
// Auth: requireAuth() + requireRole("admin") are applied at the
// app.js mount, so every handler here can assume req.account.role
// === "admin". The role check leaks no information about the route
// shape because non-admins get a flat 403.

const router = Router();

// Local zod schemas — kept inline because they're admin-only and don't
// share validation rules with teacher-facing forms.
// Schema validates SHAPE; the actor's permission to assign the requested
// role is checked dynamically in the handler via canGrantRole(). dev /
// super_admin can never be assigned through this route — those are env-only.
const AdminCreateTeacherSchema = z.object({
  first_name: z.string().trim().min(1).max(120),
  last_name:  z.string().trim().min(1).max(120),
  email:      z.string().trim().email().max(254).optional().nullable(),
  staff_id:   z.string().trim().max(60).optional().nullable(),
  role:       z.enum(ROLES).optional(),
  sub_role:   z.string().trim().max(40).optional().nullable(),
}).strip();

const AdminStatusSchema = z.object({
  status: z.enum(["active", "suspended", "deleted"]),
}).strip();

const AdminRoleUpdateSchema = z.object({
  role:     z.enum(ROLES),
  sub_role: z.string().trim().max(40).optional().nullable(),
}).strip();

router.get("/teachers", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.first_name, t.last_name, t.email, t.staff_id, t.role, t.sub_role, t.status,
              t.subscription_status, t.subscription_ends_at, t.subscription_plan,
              t.last_login_at, t.last_login_ip,
              t.hire_date, t.created_at,
              (SELECT COUNT(*)::int FROM students  WHERE account_id = t.id) AS students,
              (SELECT COUNT(*)::int FROM drafts    WHERE account_id = t.id) AS drafts,
              (SELECT COUNT(*)::int FROM templates WHERE account_id = t.id) AS templates
         FROM accounts t
        ORDER BY t.role DESC, t.last_name, t.first_name`
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/admin/teachers", err);
  }
});

router.post("/teachers", validateBody(AdminCreateTeacherSchema), async (req, res) => {
  try {
    const { first_name, last_name, email, staff_id, role, sub_role } = req.body;
    const targetRole = role || "teacher";

    // Permission check — only actors whose role+sub_role pyramid allows
    // them to grant `targetRole` may proceed. dev/super_admin grant
    // anything (except dev/super_admin themselves, which are env-only);
    // admin(operations) can only grant teacher.
    if (!canGrantRole(req.account, targetRole)) {
      return res.status(403).json({
        error: "You don't have permission to create an account with this role.",
        code: "role_grant_denied",
      });
    }
    if (!isValidSubRole(targetRole, sub_role)) {
      return res.status(400).json({
        error: `'${sub_role}' is not a valid sub-role for '${targetRole}'.`,
        code: "invalid_sub_role",
      });
    }

    const r = await pool.query(
      `INSERT INTO accounts (first_name, last_name, email, staff_id, role, sub_role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, email, staff_id, role, sub_role, status, created_at`,
      [first_name, last_name, email ?? null, staff_id ?? null, targetRole, sub_role || null]
    );
    await recordAudit({
      accountId: req.account.id,
      action: "admin.teacher.create",
      targetTable: "accounts",
      targetId: r.rows[0].id,
      ip: clientIp(req), userAgent: userAgent(req),
      detail: { role: targetRole, sub_role: sub_role || null },
    });
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/admin/teachers", err);
  }
});

router.patch("/teachers/:id/status", validateBody(AdminStatusSchema), async (req, res) => {
  try {
    const { status } = req.body;
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId < 1) {
      return res.status(400).json({ error: "Invalid teacher id." });
    }
    // Guardrail: an admin cannot suspend or delete themselves — that's
    // either a mistake or an attempted self-lockout, both of which
    // are better blocked at the API.
    if (targetId === req.account.id && status !== "active") {
      return res.status(400).json({ error: "Admins can't change their own account status." });
    }
    const r = await pool.query(
      `UPDATE accounts SET status = $1, updated_at = NOW()
        WHERE id = $2 RETURNING id, status`,
      [status, targetId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    // Status gates requireAuth(); a suspended teacher must lose access now,
    // not when the cached row happens to expire.
    await invalidateAccountById(targetId);
    await recordAudit({
      accountId: req.account.id,
      action: `admin.teacher.${status}`,
      targetTable: "accounts",
      targetId,
      ip: clientIp(req), userAgent: userAgent(req),
    });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/admin/teachers/:id/status", err);
  }
});

// PATCH /api/admin/teachers/:id/role — change role + sub_role of an
// existing account. Same permission rules as create: actor must be
// allowed to grant the NEW role, and (defensively) must be allowed to
// grant the OLD role too — so an admin(operations) can't strip a moe
// row of its privileges. dev / super_admin bypass both checks.
router.patch("/teachers/:id/role", validateBody(AdminRoleUpdateSchema), async (req, res) => {
  try {
    const { role, sub_role } = req.body;
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId < 1) {
      return res.status(400).json({ error: "Invalid teacher id." });
    }
    if (targetId === req.account.id) {
      return res.status(400).json({ error: "You can't change your own role." });
    }
    if (!canGrantRole(req.account, role)) {
      return res.status(403).json({ error: "Forbidden", code: "role_grant_denied" });
    }
    if (!isValidSubRole(role, sub_role)) {
      return res.status(400).json({
        error: `'${sub_role}' is not a valid sub-role for '${role}'.`,
        code: "invalid_sub_role",
      });
    }
    // Look up the current role so we can refuse demotion attempts from
    // an actor not allowed to touch the existing role either.
    const cur = await pool.query("SELECT role FROM accounts WHERE id = $1", [targetId]);
    if (cur.rows.length === 0) return res.status(404).json({ error: "Not found" });
    if (!canGrantRole(req.account, cur.rows[0].role)) {
      return res.status(403).json({ error: "Forbidden", code: "role_grant_denied" });
    }
    const r = await pool.query(
      `UPDATE accounts SET role = $1, sub_role = $2, updated_at = NOW()
        WHERE id = $3 RETURNING id, role, sub_role`,
      [role, sub_role || null, targetId]
    );
    // requireRole() reads this row — a demotion has to bite immediately.
    await invalidateAccountById(targetId);
    await recordAudit({
      accountId: req.account.id,
      action: "admin.teacher.role_update",
      targetTable: "accounts",
      targetId,
      ip: clientIp(req), userAgent: userAgent(req),
      detail: { from: cur.rows[0].role, to: role, sub_role: sub_role || null },
    });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/admin/teachers/:id/role", err);
  }
});

router.delete("/teachers/:id", async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId < 1) {
      return res.status(400).json({ error: "Invalid teacher id." });
    }
    if (targetId === req.account.id) {
      return res.status(400).json({ error: "Admins can't delete their own account." });
    }
    // Resolve the uid BEFORE the row goes: invalidateAccountById() can only
    // follow the id→uid pointer while the account still exists.
    await invalidateAccountById(targetId);
    const r = await pool.query("DELETE FROM accounts WHERE id = $1", [targetId]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await recordAudit({
      accountId: req.account.id,
      action: "admin.teacher.delete",
      targetTable: "accounts",
      targetId,
      ip: clientIp(req), userAgent: userAgent(req),
    });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/admin/teachers/:id", err);
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM accounts WHERE role = 'teacher' AND status = 'active') AS active_teachers,
         (SELECT COUNT(*)::int FROM accounts WHERE role = 'teacher' AND status = 'suspended') AS suspended_teachers,
         (SELECT COUNT(*)::int FROM accounts WHERE role = 'teacher') AS total_teachers,
         (SELECT COUNT(*)::int FROM accounts WHERE subscription_status = 'trial') AS trialing,
         (SELECT COUNT(*)::int FROM accounts WHERE subscription_status = 'active') AS subscribed,
         (SELECT COUNT(*)::int FROM accounts WHERE subscription_status = 'expired') AS lapsed,
         (SELECT COUNT(*)::int FROM students) AS total_students,
         (SELECT COUNT(*)::int FROM drafts) AS total_lessons,
         (SELECT COUNT(*)::int FROM quizzes) AS total_quizzes,
         (SELECT COUNT(*)::int FROM homework) AS total_homework`
    );
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "GET /api/admin/stats", err);
  }
});

// GET /api/admin/dashboard
//
// Richer KPI bundle for the new AdminDashboard view. Returns teacher
// status counts, sub status counts, ending-in-30d count, revenue
// (MRR/ARR/by-plan), and activity snapshots (signups/logins). Used by
// every admin sub-role; the frontend chooses which sections to render.
router.get("/dashboard", async (_req, res) => {
  try {
    const [statusCounts, subCounts, ending, content, revenue, activity] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int    AS active,
          COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
          COUNT(*) FILTER (WHERE status = 'deleted')::int   AS deleted,
          COUNT(*)::int AS total
        FROM accounts WHERE role = 'teacher'
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status = 'trial')::int     AS trial,
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int    AS active,
          COUNT(*) FILTER (WHERE subscription_status = 'expired')::int   AS expired,
          COUNT(*) FILTER (WHERE subscription_status = 'suspended')::int AS suspended
        FROM accounts WHERE role = 'teacher'
      `),
      pool.query(`
        SELECT COUNT(*)::int AS n FROM accounts
        WHERE role = 'teacher'
          AND subscription_status IN ('trial','active')
          AND subscription_ends_at IS NOT NULL
          AND subscription_ends_at <= NOW() + INTERVAL '30 days'
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM drafts        WHERE deleted_at IS NULL) AS lesson_plans,
          (SELECT COUNT(*)::int FROM quizzes       WHERE deleted_at IS NULL) AS quizzes,
          (SELECT COUNT(*)::int FROM homework      WHERE deleted_at IS NULL) AS homework,
          (SELECT COUNT(*)::int FROM presentations WHERE deleted_at IS NULL) AS presentations,
          (SELECT COUNT(*)::int FROM activities    WHERE deleted_at IS NULL) AS activities,
          (SELECT COUNT(*)::int FROM students)                                AS students
      `),
      pool.query(`
        SELECT subscription_plan AS plan, COUNT(*)::int AS n
        FROM accounts
        WHERE role = 'teacher'
          AND subscription_status IN ('trial','active')
          AND subscription_plan IS NOT NULL
        GROUP BY subscription_plan
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at  >= NOW() - INTERVAL '7 days')::int   AS new_7d,
          COUNT(*) FILTER (WHERE created_at  >= NOW() - INTERVAL '30 days')::int  AS new_30d,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int  AS active_7d,
          COUNT(*) FILTER (WHERE last_login_at::date = CURRENT_DATE)::int          AS active_today
        FROM accounts WHERE role = 'teacher'
      `),
    ]);

    let mrr = 0;
    const revenueByPlan = {};
    for (const r of revenue.rows) {
      const price = MONTHLY_PRICE[r.plan] || 0;
      revenueByPlan[r.plan] = Math.round(r.n * price * 100) / 100;
      mrr += r.n * price;
    }
    mrr = Math.round(mrr * 100) / 100;

    res.json({
      teachers: { ...statusCounts.rows[0] },
      subscriptions: {
        ...subCounts.rows[0],
        ending_30d: ending.rows[0].n,
      },
      revenue: { mrr, arr: Math.round(mrr * 12 * 100) / 100, currency: "AED", by_plan: revenueByPlan },
      activity: activity.rows[0],
      content: content.rows[0],
    });
  } catch (err) {
    handleErr(res, "GET /api/admin/dashboard", err);
  }
});

// GET /api/admin/signups?days=N — daily teacher signups for the chart.
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
    handleErr(res, "GET /api/admin/signups", err);
  }
});

// GET /api/admin/audit — recent audit-log rows. Lets a security
// reviewer (or me, when something looks weird) see the last N actions
// across the system. Default limit kept small (100) — paginate later
// if needed. Filters: ?account_id, ?action prefix.
router.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const conds = [];
    const params = [];
    if (req.query.account_id) {
      params.push(Number(req.query.account_id));
      conds.push(`account_id = $${params.length}`);
    }
    if (req.query.action) {
      params.push(String(req.query.action).slice(0, 80) + "%");
      conds.push(`action LIKE $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(limit);
    const r = await pool.query(
      `SELECT id, account_id, action, target_table, target_id, ip,
              user_agent, detail, created_at
         FROM audit_log
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/admin/audit", err);
  }
});

export default router;
