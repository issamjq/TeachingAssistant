// MoE (Ministry of Education) API — oversight + curriculum view.
//
// Mounted at /api/moe/* with requireRole("moe", "super_admin", "dev").
// Read-only — the ministry observes, it doesn't author content.
//
// Sub-role flavors (handled client-side by which sections render):
//   head      — pyramid top of the MoE side. Sees inspector activity
//                and broader oversight stats.
//   inspector — school inspector. Sees per-school summaries.
//   staff     — general ministry staff. Read-only directory.
//
// Per-school scope tables (moe → schools) don't exist yet, so for now
// every metric is system-wide.

import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";

const router = Router();

// GET /api/moe/overview
//
// Ministry-flavored KPIs: school counts by emirate/curriculum, teacher
// distribution, content production (lessons / quizzes / homework), and
// engagement (recent logins).
router.get("/overview", async (_req, res) => {
  try {
    const [schools, byEmirate, byCurriculum, teachers, content, activity] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE type = 'Public')::int AS public_schools,
          COUNT(*) FILTER (WHERE type = 'Private')::int AS private_schools
        FROM schools
      `),
      pool.query(`SELECT emirate, COUNT(*)::int AS n FROM schools GROUP BY emirate ORDER BY n DESC`),
      pool.query(`SELECT COALESCE(curriculum, 'Unspecified') AS curriculum, COUNT(*)::int AS n FROM schools GROUP BY curriculum ORDER BY n DESC`),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int AS active_subs,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int AS engaged_7d
        FROM accounts WHERE role = 'teacher'
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM drafts        WHERE deleted_at IS NULL) AS lesson_plans,
          (SELECT COUNT(*)::int FROM quizzes       WHERE deleted_at IS NULL) AS quizzes,
          (SELECT COUNT(*)::int FROM homework      WHERE deleted_at IS NULL) AS homework,
          (SELECT COUNT(*)::int FROM presentations WHERE deleted_at IS NULL) AS presentations,
          (SELECT COUNT(*)::int FROM activities    WHERE deleted_at IS NULL) AS activities,
          (SELECT COUNT(*)::int FROM students) AS students
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE last_login_at::date = CURRENT_DATE)::int           AS active_today,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '30 days')::int  AS active_30d,
          COUNT(*) FILTER (WHERE created_at  >= NOW() - INTERVAL '30 days')::int    AS new_30d
        FROM accounts WHERE role = 'teacher'
      `),
    ]);

    res.json({
      schools: {
        total: schools.rows[0].total,
        public: schools.rows[0].public_schools,
        private: schools.rows[0].private_schools,
        by_emirate: byEmirate.rows,
        by_curriculum: byCurriculum.rows,
      },
      teachers: teachers.rows[0],
      content: content.rows[0],
      activity: activity.rows[0],
    });
  } catch (err) {
    handleErr(res, "GET /api/moe/overview", err);
  }
});

// GET /api/moe/schools?emirate=&curriculum=&limit=
// Filterable directory used by the MoE dashboard's schools table.
router.get("/schools", async (req, res) => {
  try {
    const conds = [];
    const params = [];
    if (req.query.emirate) {
      params.push(req.query.emirate);
      conds.push(`emirate = $${params.length}`);
    }
    if (req.query.curriculum) {
      params.push(req.query.curriculum);
      conds.push(`curriculum = $${params.length}`);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
    params.push(limit);
    const r = await pool.query(`
      SELECT s.id, s.name, s.name_ar, s.emirate, s.city, s.type, s.curriculum,
             (SELECT COUNT(*)::int FROM students st WHERE st.school_id = s.id) AS student_count,
             (SELECT COUNT(*)::int FROM account_schools asn WHERE asn.school_id = s.id) AS teacher_count
      FROM schools s
      ${conds.length ? `WHERE ${conds.join(" AND ")}` : ""}
      ORDER BY s.name
      LIMIT $${params.length}
    `, params);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/moe/schools", err);
  }
});

// GET /api/moe/content-trend?days=N
// Daily content creation activity across the platform (drafts +
// quizzes + homework + presentations + activities).
router.get("/content-trend", async (req, res) => {
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
      content AS (
        SELECT day, SUM(n)::int AS n FROM (
          SELECT created_at::date AS day, COUNT(*)::int AS n FROM drafts        WHERE created_at >= NOW() - ($1::int || ' days')::interval GROUP BY day
          UNION ALL
          SELECT created_at::date AS day, COUNT(*)::int AS n FROM quizzes       WHERE created_at >= NOW() - ($1::int || ' days')::interval GROUP BY day
          UNION ALL
          SELECT created_at::date AS day, COUNT(*)::int AS n FROM homework      WHERE created_at >= NOW() - ($1::int || ' days')::interval GROUP BY day
          UNION ALL
          SELECT created_at::date AS day, COUNT(*)::int AS n FROM presentations WHERE created_at >= NOW() - ($1::int || ' days')::interval GROUP BY day
          UNION ALL
          SELECT created_at::date AS day, COUNT(*)::int AS n FROM activities    WHERE created_at >= NOW() - ($1::int || ' days')::interval GROUP BY day
        ) sub
        GROUP BY day
      )
      SELECT d.day::text AS day, COALESCE(c.n, 0)::int AS n
      FROM days d LEFT JOIN content c ON c.day = d.day
      ORDER BY d.day
    `, [days]);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/moe/content-trend", err);
  }
});

export default router;
