import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { clientIp, userAgent } from "../lib/auth.js";

// Admin endpoints — manage teacher accounts, never see their content.
//
// Auth: requireAuth() + requireRole("admin") are applied at the
// app.js mount, so every handler here can assume req.teacher.role
// === "admin". The role check leaks no information about the route
// shape because non-admins get a flat 403.

const router = Router();

// Local zod schemas — kept inline because they're admin-only and don't
// share validation rules with teacher-facing forms.
const AdminCreateTeacherSchema = z.object({
  first_name: z.string().trim().min(1).max(120),
  last_name:  z.string().trim().min(1).max(120),
  email:      z.string().trim().email().max(254).optional().nullable(),
  staff_id:   z.string().trim().max(60).optional().nullable(),
  role:       z.enum(["teacher", "admin", "dev"]).optional(),
}).strip();

const AdminStatusSchema = z.object({
  status: z.enum(["active", "suspended", "deleted"]),
}).strip();

router.get("/teachers", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.first_name, t.last_name, t.email, t.staff_id, t.role, t.status,
              t.subscription_status, t.subscription_ends_at, t.subscription_plan,
              t.last_login_at, t.last_login_ip,
              t.hire_date, t.created_at,
              (SELECT COUNT(*)::int FROM students  WHERE teacher_id = t.id) AS students,
              (SELECT COUNT(*)::int FROM drafts    WHERE teacher_id = t.id) AS drafts,
              (SELECT COUNT(*)::int FROM templates WHERE teacher_id = t.id) AS templates
         FROM teachers t
        ORDER BY t.role DESC, t.last_name, t.first_name`
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/admin/teachers", err);
  }
});

router.post("/teachers", validateBody(AdminCreateTeacherSchema), async (req, res) => {
  try {
    const { first_name, last_name, email, staff_id, role } = req.body;
    const r = await pool.query(
      `INSERT INTO teachers (first_name, last_name, email, staff_id, role)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'teacher'))
       RETURNING id, first_name, last_name, email, staff_id, role, status, created_at`,
      [first_name, last_name, email ?? null, staff_id ?? null, role ?? null]
    );
    await recordAudit({
      teacherId: req.teacher.id,
      action: "admin.teacher.create",
      targetTable: "teachers",
      targetId: r.rows[0].id,
      ip: clientIp(req), userAgent: userAgent(req),
      detail: { role: role || "teacher" },
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
    if (targetId === req.teacher.id && status !== "active") {
      return res.status(400).json({ error: "Admins can't change their own account status." });
    }
    const r = await pool.query(
      `UPDATE teachers SET status = $1, updated_at = NOW()
        WHERE id = $2 RETURNING id, status`,
      [status, targetId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    await recordAudit({
      teacherId: req.teacher.id,
      action: `admin.teacher.${status}`,
      targetTable: "teachers",
      targetId,
      ip: clientIp(req), userAgent: userAgent(req),
    });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/admin/teachers/:id/status", err);
  }
});

router.delete("/teachers/:id", async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId < 1) {
      return res.status(400).json({ error: "Invalid teacher id." });
    }
    if (targetId === req.teacher.id) {
      return res.status(400).json({ error: "Admins can't delete their own account." });
    }
    const r = await pool.query("DELETE FROM teachers WHERE id = $1", [targetId]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await recordAudit({
      teacherId: req.teacher.id,
      action: "admin.teacher.delete",
      targetTable: "teachers",
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
         (SELECT COUNT(*)::int FROM teachers WHERE role = 'teacher' AND status = 'active') AS active_teachers,
         (SELECT COUNT(*)::int FROM teachers WHERE role = 'teacher' AND status = 'suspended') AS suspended_teachers,
         (SELECT COUNT(*)::int FROM teachers WHERE role = 'teacher') AS total_teachers,
         (SELECT COUNT(*)::int FROM teachers WHERE subscription_status = 'trial') AS trialing,
         (SELECT COUNT(*)::int FROM teachers WHERE subscription_status = 'active') AS subscribed,
         (SELECT COUNT(*)::int FROM teachers WHERE subscription_status = 'expired') AS lapsed,
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

// GET /api/admin/audit — recent audit-log rows. Lets a security
// reviewer (or me, when something looks weird) see the last N actions
// across the system. Default limit kept small (100) — paginate later
// if needed. Filters: ?teacher_id, ?action prefix.
router.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const conds = [];
    const params = [];
    if (req.query.teacher_id) {
      params.push(Number(req.query.teacher_id));
      conds.push(`teacher_id = $${params.length}`);
    }
    if (req.query.action) {
      params.push(String(req.query.action).slice(0, 80) + "%");
      conds.push(`action LIKE $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(limit);
    const r = await pool.query(
      `SELECT id, teacher_id, action, target_table, target_id, ip,
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
