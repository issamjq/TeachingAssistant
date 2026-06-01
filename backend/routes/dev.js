import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { clientIp, userAgent } from "../lib/auth.js";

// Dev endpoints — read-only data inspector + feature flag toggles.
// Auth + role check applied at the app.js mount; every handler here
// can assume req.teacher.role === "dev".

const FlagSchema = z.object({
  enabled:     z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
}).strip();
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

router.put("/feature-flags/:key", validateBody(FlagSchema), async (req, res) => {
  try {
    // Validate the flag key — only [a-z0-9_] to keep it shell-/log-safe.
    const key = req.params.key;
    if (!/^[a-z0-9_]{1,64}$/.test(key)) {
      return res.status(400).json({ error: "Invalid flag key." });
    }
    const { enabled, description } = req.body;
    const r = await pool.query(
      `INSERT INTO feature_flags (key, enabled, description, updated_at)
       VALUES ($1, COALESCE($2, FALSE), $3, NOW())
       ON CONFLICT (key) DO UPDATE
         SET enabled = COALESCE(EXCLUDED.enabled, feature_flags.enabled),
             description = COALESCE(EXCLUDED.description, feature_flags.description),
             updated_at = NOW()
       RETURNING key, enabled, description, updated_at`,
      [key, enabled ?? null, description ?? null]
    );
    await recordAudit({
      teacherId: req.teacher.id,
      action: "dev.flag.toggle",
      targetTable: "feature_flags",
      ip: clientIp(req), userAgent: userAgent(req),
      detail: { key, enabled: enabled ?? null },
    });
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
