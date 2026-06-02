import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const onlyUnread = req.query.unread === "true";
    const r = await pool.query(
      `SELECT id, kind, message, link, is_read, created_at
         FROM notifications
        WHERE account_id = $1 ${onlyUnread ? "AND is_read = FALSE" : ""}
        ORDER BY created_at DESC
        LIMIT 50`,
      [cur.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/notifications", err);
  }
});

// POST /api/notifications/refresh — auto-emit reminders for upcoming work.
//   - lessons starting today and within the next 60 minutes
//   - homework with due_date in the next 24h that's still Open
//   - quizzes scheduled for tomorrow (or today, if not yet emitted)
// Each (teacher, kind, ref) is unique, so calling this on every page load
// or every minute is safe and cheap.
router.post("/refresh", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);

    const inserts = [
      // Lessons starting in the next 60 min today.
      {
        kind: "lesson_upcoming",
        link: "/schedule",
        sql: `
          SELECT id AS ref_id,
                 'Lesson "' || title || '" starts at ' || start_time::text || '.' AS message
            FROM schedule_entries
           WHERE account_id = $1
             AND date = CURRENT_DATE
             AND start_time BETWEEN CURRENT_TIME AND CURRENT_TIME + INTERVAL '60 minutes'
             AND status = 'planned'
        `,
        ref_table: "schedule_entries",
      },
      // Homework due in next 24h.
      {
        kind: "homework_due",
        link: "/homework",
        sql: `
          SELECT id AS ref_id,
                 'Homework "' || title || '" is due ' ||
                   CASE WHEN due_date = CURRENT_DATE THEN 'today.' ELSE 'tomorrow.' END AS message
            FROM homework
           WHERE account_id = $1
             AND status = 'Open'
             AND due_date IS NOT NULL
             AND due_date >= CURRENT_DATE
             AND due_date <= CURRENT_DATE + INTERVAL '1 day'
        `,
        ref_table: "homework",
      },
      // Quizzes scheduled for today or tomorrow.
      {
        kind: "quiz_scheduled",
        link: "/quizzes",
        sql: `
          SELECT id AS ref_id,
                 'Quiz "' || title || '" is scheduled for ' ||
                   CASE WHEN scheduled_for = CURRENT_DATE THEN 'today.' ELSE 'tomorrow.' END AS message
            FROM quizzes
           WHERE account_id = $1
             AND scheduled_for IS NOT NULL
             AND scheduled_for >= CURRENT_DATE
             AND scheduled_for <= CURRENT_DATE + INTERVAL '1 day'
        `,
        ref_table: "quizzes",
      },
    ];

    let created = 0;
    for (const job of inserts) {
      const candidates = await pool.query(job.sql, [cur.id]);
      for (const row of candidates.rows) {
        // Manual dedup — partial-unique-index ON CONFLICT clauses need the
        // exact predicate, which is brittle. A pre-check is fast enough and
        // makes intent obvious.
        const existing = await pool.query(
          `SELECT id FROM notifications
            WHERE account_id = $1 AND kind = $2 AND ref_table = $3 AND ref_id = $4
            LIMIT 1`,
          [cur.id, job.kind, job.ref_table, row.ref_id]
        );
        if (existing.rowCount > 0) continue;
        const ins = await pool.query(
          `INSERT INTO notifications (account_id, kind, message, link, ref_table, ref_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [cur.id, job.kind, row.message, job.link, job.ref_table, row.ref_id]
        );
        if (ins.rowCount > 0) created++;
      }
    }
    res.json({ ok: true, created });
  } catch (err) {
    handleErr(res, "POST /api/notifications/refresh", err);
  }
});

router.post("/mark-read", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (ids) {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE account_id = $1 AND id = ANY($2::int[])",
        [cur.id, ids]
      );
    } else {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE account_id = $1",
        [cur.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "POST /api/notifications/mark-read", err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const r = await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND account_id = $2",
      [req.params.id, cur.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/notifications/:id", err);
  }
});

export default router;
