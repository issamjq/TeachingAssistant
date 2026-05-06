import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";

// Admin endpoints — manage teacher accounts, never see their content.
//
// Without auth, anyone can call these. The frontend gates them behind a
// role-switcher; production will swap that for a real role check.
const router = Router();

router.get("/teachers", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.first_name, t.last_name, t.email, t.staff_id, t.role, t.status,
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

router.post("/teachers", async (req, res) => {
  try {
    const { first_name, last_name, email, staff_id, role } = req.body || {};
    if (!first_name || !last_name) {
      return res.status(400).json({ error: "first_name and last_name required" });
    }
    const r = await pool.query(
      `INSERT INTO teachers (first_name, last_name, email, staff_id, role)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'teacher'))
       RETURNING id, first_name, last_name, email, staff_id, role, status, created_at`,
      [first_name, last_name, email ?? null, staff_id ?? null, role ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/admin/teachers", err);
  }
});

router.patch("/teachers/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active", "suspended", "deleted"].includes(status)) {
      return res.status(400).json({ error: "status must be active|suspended|deleted" });
    }
    const r = await pool.query(
      `UPDATE teachers SET status = $1, updated_at = NOW()
        WHERE id = $2 RETURNING id, status`,
      [status, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/admin/teachers/:id/status", err);
  }
});

router.delete("/teachers/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM teachers WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
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

export default router;
