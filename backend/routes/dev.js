import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";

// Dev endpoints — read-only data inspector + feature flag toggles.
const router = Router();

router.get("/feature-flags", async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT key, enabled, description, updated_at FROM feature_flags ORDER BY key"
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/dev/feature-flags", err);
  }
});

router.put("/feature-flags/:key", async (req, res) => {
  try {
    const { enabled, description } = req.body || {};
    const r = await pool.query(
      `INSERT INTO feature_flags (key, enabled, description, updated_at)
       VALUES ($1, COALESCE($2, FALSE), $3, NOW())
       ON CONFLICT (key) DO UPDATE
         SET enabled = COALESCE(EXCLUDED.enabled, feature_flags.enabled),
             description = COALESCE(EXCLUDED.description, feature_flags.description),
             updated_at = NOW()
       RETURNING key, enabled, description, updated_at`,
      [req.params.key, enabled ?? null, description ?? null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/dev/feature-flags/:key", err);
  }
});

router.get("/inspect/:table", async (req, res) => {
  // Whitelist of tables the dev inspector can read.
  const ALLOWED = new Set([
    "teachers", "templates", "drafts", "students",
    "schedule_entries", "quizzes", "quiz_questions", "quiz_scores",
    "homework", "homework_submissions", "attendance", "student_grades",
    "presentations", "activities", "notifications", "library_resources",
    "feature_flags",
  ]);
  const t = req.params.table;
  if (!ALLOWED.has(t)) return res.status(404).json({ error: "Unknown table" });
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const r = await pool.query(`SELECT * FROM ${t} ORDER BY 1 DESC LIMIT $1`, [limit]);
    res.json({ table: t, rows: r.rows, count: r.rowCount });
  } catch (err) {
    handleErr(res, `GET /api/dev/inspect/${t}`, err);
  }
});

router.get("/health-detail", async (_req, res) => {
  try {
    const t0 = Date.now();
    const r = await pool.query("SELECT NOW()::text AS now");
    res.json({
      ok: true,
      db_time: r.rows[0].now,
      query_ms: Date.now() - t0,
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      node_version: process.version,
    });
  } catch (err) {
    handleErr(res, "GET /api/dev/health-detail", err);
  }
});

export default router;
