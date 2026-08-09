// =====================================================================
// /api/notifications — the bell
//
// Notices hang off the USER, not the faculty row: they are addressed to
// a person, and a person may later be something other than a teacher.
// The reminders they are generated from hang off faculty, which is why
// both ids appear below.
//
// The wire shape keeps `is_read` and `message`, which is what the studio
// renders. The column is `read_at` because when something was read is
// worth more than whether it was, and a boolean cannot be recovered from
// nothing later.
// =====================================================================
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";

const router = Router();

const SHAPE = `id, kind, title, body AS message, link, ref_table, ref_id,
               (read_at IS NOT NULL) AS is_read, read_at, created_at`;

router.get("/", async (req, res) => {
  try {
    const onlyUnread = req.query.unread === "true";
    const r = await pool.query(
      `SELECT ${SHAPE} FROM notifications
        WHERE user_id = $1 ${onlyUnread ? "AND read_at IS NULL" : ""}
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.account.user_id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/notifications", err);
  }
});

/**
 * POST /refresh — raise reminders for work that is about to matter.
 *
 * Safe to call on every page load: each notice carries a reference to
 * what caused it and a partial unique index on (user, kind, ref) makes
 * the insert idempotent. That is now the database's job rather than a
 * SELECT-then-INSERT, which two concurrent tabs could both pass.
 */
const JOBS = [
  {
    kind: "lesson_upcoming",
    link: "/schedule",
    ref_table: "schedule_entries",
    sql: `
      SELECT id AS ref_id,
             'Lesson "' || title || '" starts at ' ||
               to_char(start_time, 'HH24:MI') || '.' AS message
        FROM schedule_entries
       WHERE faculty_id = $1
         AND date = CURRENT_DATE
         AND start_time IS NOT NULL
         AND start_time BETWEEN CURRENT_TIME AND CURRENT_TIME + INTERVAL '60 minutes'
         AND status = 'planned'`,
  },
  {
    // One job for every kind of assigned work, because they are one
    // table now. The type is in the message rather than in the kind, so
    // a teacher reads "Quiz … closes tomorrow" and not "assignment_due".
    kind: "assignment_due",
    link: "/planner",
    ref_table: "assignments",
    sql: `
      SELECT asg.id AS ref_id,
             initcap(replace(a.type, '_', ' ')) || ' "' ||
               COALESCE(a.content->>'title', a.content->>'name', 'Untitled') ||
               '" closes ' ||
               CASE WHEN asg.ends_at::date = CURRENT_DATE THEN 'today.' ELSE 'tomorrow.' END AS message
        FROM assignments asg
        JOIN ai_studio a ON a.id = asg.generation_id
       WHERE a.faculty_id = $1
         AND asg.ends_at IS NOT NULL
         AND asg.ends_at >= now()
         AND asg.ends_at <= now() + INTERVAL '1 day'`,
  },
];

router.post("/refresh", async (req, res) => {
  try {
    let created = 0;
    for (const job of JOBS) {
      const rows = await pool.query(job.sql, [req.account.id]);
      for (const row of rows.rows) {
        const ins = await pool.query(
          `INSERT INTO notifications (user_id, kind, body, link, ref_table, ref_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, kind, ref_table, ref_id) WHERE ref_id IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [req.account.user_id, job.kind, row.message, job.link, job.ref_table, row.ref_id]
        );
        created += ins.rowCount;
      }
    }
    res.json({ ok: true, created });
  } catch (err) {
    handleErr(res, "POST /api/notifications/refresh", err);
  }
});

router.post("/mark-read", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    // uuid[], not int[] — ids are uuids in this schema, and the old cast
    // would have thrown 22P02 on every call.
    await pool.query(
      `UPDATE notifications SET read_at = now(), updated_at = now()
        WHERE user_id = $1 AND read_at IS NULL
          ${ids ? "AND id = ANY($2::uuid[])" : ""}`,
      ids ? [req.account.user_id, ids] : [req.account.user_id]
    );
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "POST /api/notifications/mark-read", err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM notifications WHERE id = $1::uuid AND user_id = $2`,
      [req.params.id, req.account.user_id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/notifications/:id", err);
  }
});

export default router;
