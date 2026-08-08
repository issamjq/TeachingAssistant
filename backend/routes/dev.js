import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { clientIp, userAgent } from "../lib/auth.js";

// Dev endpoints — read-only data inspector + feature flag toggles.
// Auth + role check applied at the app.js mount; every handler here
// can assume req.account.role === "dev".

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
      accountId: req.account.id,
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
    "accounts", "templates", "drafts", "students",
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
    const mem = process.memoryUsage();
    res.json({
      ok: true,
      db_time: r.rows[0].now,
      query_ms: Date.now() - t0,
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      node_version: process.version,
      platform: process.platform,
      pid: process.pid,
      env: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    handleErr(res, "GET /api/dev/health-detail", err);
  }
});

// GET /api/dev/system-stats
//
// Returns per-table row counts and database size — gives dev a one-shot
// "what's the shape of the data right now?" view. Uses pg_stat_user_tables
// for live-tup estimates (fast even on large tables).
router.get("/system-stats", async (_req, res) => {
  try {
    const [tables, totals, dbSize] = await Promise.all([
      pool.query(`
        SELECT
          t.relname AS table_name,
          COALESCE(s.n_live_tup, 0)::int AS row_count,
          pg_total_relation_size(t.relname::regclass) AS bytes
        FROM pg_class t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.relname
        WHERE t.relkind = 'r'
          AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ORDER BY t.relname
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM accounts)             AS total_accounts,
          (SELECT COUNT(*)::int FROM accounts WHERE role = 'teacher') AS teachers,
          (SELECT COUNT(*)::int FROM students)             AS students,
          (SELECT COUNT(*)::int FROM schools)              AS schools,
          (SELECT COUNT(*)::int FROM audit_log)            AS audit_events,
          (
            (SELECT COUNT(*)::int FROM drafts WHERE deleted_at IS NULL) +
            (SELECT COUNT(*)::int FROM quizzes WHERE deleted_at IS NULL) +
            (SELECT COUNT(*)::int FROM homework WHERE deleted_at IS NULL) +
            (SELECT COUNT(*)::int FROM presentations WHERE deleted_at IS NULL) +
            (SELECT COUNT(*)::int FROM activities WHERE deleted_at IS NULL)
          )::int AS content_rows
      `),
      pool.query(`
        SELECT pg_database_size(current_database()) AS bytes,
               pg_size_pretty(pg_database_size(current_database())) AS pretty
      `),
    ]);
    res.json({
      tables: tables.rows.map((r) => ({
        table_name: r.table_name,
        row_count: r.row_count,
        bytes: Number(r.bytes),
      })),
      totals: totals.rows[0],
      database: dbSize.rows[0],
    });
  } catch (err) {
    handleErr(res, "GET /api/dev/system-stats", err);
  }
});

// GET /api/dev/audit?limit=100&action=&account_id=&since_days=N
//
// Audit log feed for the dev console. Supports filtering by action
// prefix, by acting account, and by recency. Joined to accounts so the
// UI doesn't need a separate lookup.
router.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const conds = [];
    const params = [];
    if (req.query.action) {
      params.push(`${req.query.action}%`);
      conds.push(`a.action LIKE $${params.length}`);
    }
    if (req.query.account_id) {
      const accountId = Number(req.query.account_id);
      if (Number.isInteger(accountId)) {
        params.push(accountId);
        conds.push(`a.account_id = $${params.length}`);
      }
    }
    if (req.query.since_days) {
      const days = Math.min(Math.max(Number(req.query.since_days) || 7, 1), 365);
      conds.push(`a.created_at >= NOW() - INTERVAL '${days} days'`);
    }
    params.push(limit);
    const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const r = await pool.query(`
      SELECT a.id, a.account_id, a.action, a.target_table, a.target_id,
             a.ip, a.user_agent, a.detail, a.created_at,
             acc.first_name, acc.last_name, acc.email, acc.role
      FROM audit_log a
      LEFT JOIN accounts acc ON acc.id = a.account_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/dev/audit", err);
  }
});

// GET /api/dev/account/:id — full account row + resolved permissions.
// Dev's debugging counterpart to /api/superadmin/account/:id.
router.get("/account/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid account id." });
    }
    const r = await pool.query(`
      SELECT id, first_name, last_name, email, role, sub_role, status,
             auth_uid, avatar_url, permissions,
             subscription_status, subscription_ends_at, subscription_plan,
             last_login_at, last_login_ip, created_at, updated_at
        FROM accounts WHERE id = $1
    `, [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "GET /api/dev/account/:id", err);
  }
});

// GET /api/dev/search-accounts?q=
// Search by email or name (case-insensitive, prefix). Returns up to 20.
router.get("/search-accounts", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (q.length < 1) return res.json([]);
    const r = await pool.query(`
      SELECT id, first_name, last_name, email, role
      FROM accounts
      WHERE email ILIKE $1
         OR first_name ILIKE $1
         OR last_name ILIKE $1
      ORDER BY id DESC
      LIMIT 20
    `, [`%${q}%`]);
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/dev/search-accounts", err);
  }
});

export default router;
