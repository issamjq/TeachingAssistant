import { Router } from "express";
import { withTenant } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

// Aggregated dashboard payload — one round-trip for the home screen.
//
// Returns:
//   today_lessons          : schedule_entries for today
//   upcoming_lessons       : schedule_entries within the next 7 days
//   pending_homework       : homework with due dates in the next 7 days, status=Open
//   pending_quizzes        : quizzes scheduled within the next 14 days
//   recent_drafts          : 5 most-recently-edited lesson plans
//   counts                 : { students, drafts, templates, quizzes, homework, presentations, activities }
//   recent_notifications   : last 5 unread notifications
// The dashboard is the first screen a teacher sees and the most-requested
// endpoint in the app, so its cost is the app's perceived speed.
//
// It used to issue seven queries wrapped in Promise.all, with a comment saying
// they ran in parallel. They did not: node-postgres cannot run concurrent
// queries on a single client, so it serialised them — and it warned about it,
// since pg@9 removes the behaviour entirely. Measured dev-machine-to-Neon that
// was 1,058 ms for a screen with no data on it, against 479 ms for the grades
// summary beside it. On the Reports page the two race, and the slower one lost
// visibly: the counts at the top appeared after the table below them.
//
// Now it is ONE round-trip. Each block became a scalar sub-select returning
// json_agg, which Postgres evaluates in a single pass and hands back as one
// row. The shape of the response is unchanged.
//
// Why not run them on separate clients instead: every tenant-scoped query has
// to go through withTenant(), and that costs four round-trips of its own
// (BEGIN, SET LOCAL ROLE, set_config, COMMIT). Seven parallel clients would be
// seven transactions — 28 round-trips to save six. One transaction, one query.
router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);

    // Every sub-select carries its own `account_id = $1`, and the whole thing
    // runs inside withTenant() so RLS applies underneath each one. Collapsing
    // seven statements into one does not weaken the boundary: it is the same
    // predicate, repeated the same number of times, in the same transaction.
    const r = await withTenant(cur.id, (db) => db.query(
      `SELECT
         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, subject, grade, section, start_time, end_time, location, status
             FROM schedule_entries
            WHERE account_id = $1 AND date = CURRENT_DATE
            ORDER BY start_time) t), '[]'::json) AS today_lessons,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, subject, grade, section, date, start_time, status
             FROM schedule_entries
            WHERE account_id = $1
              AND date > CURRENT_DATE
              AND date <= CURRENT_DATE + INTERVAL '7 days'
            ORDER BY date, start_time
            LIMIT 8) t), '[]'::json) AS upcoming_lessons,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, subject, grade, section, due_date, status
             FROM homework
            WHERE account_id = $1 AND status = 'Open'
              AND (due_date IS NULL OR due_date <= CURRENT_DATE + INTERVAL '7 days')
            ORDER BY due_date NULLS LAST
            LIMIT 8) t), '[]'::json) AS pending_homework,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, subject, grade, section, scheduled_for, total_marks, status
             FROM quizzes
            WHERE account_id = $1
              AND scheduled_for IS NOT NULL
              AND scheduled_for >= CURRENT_DATE
              AND scheduled_for <= CURRENT_DATE + INTERVAL '14 days'
            ORDER BY scheduled_for
            LIMIT 8) t), '[]'::json) AS pending_quizzes,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, name, subject, status, progress, last_edited
             FROM drafts
            WHERE account_id = $1
            ORDER BY last_edited DESC NULLS LAST
            LIMIT 5) t), '[]'::json) AS recent_drafts,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, kind, message, link, is_read, created_at
             FROM notifications
            WHERE account_id = $1 AND is_read = FALSE
            ORDER BY created_at DESC
            LIMIT 5) t), '[]'::json) AS recent_notifications,

         (SELECT row_to_json(c) FROM (
           SELECT
             (SELECT COUNT(*)::int FROM students      WHERE account_id = $1) AS students,
             (SELECT COUNT(*)::int FROM drafts        WHERE account_id = $1) AS drafts,
             (SELECT COUNT(*)::int FROM templates     WHERE account_id = $1) AS templates,
             (SELECT COUNT(*)::int FROM quizzes       WHERE account_id = $1) AS quizzes,
             (SELECT COUNT(*)::int FROM homework      WHERE account_id = $1) AS homework,
             (SELECT COUNT(*)::int FROM presentations WHERE account_id = $1) AS presentations,
             (SELECT COUNT(*)::int FROM activities    WHERE account_id = $1) AS activities
         ) c) AS counts`,
      [cur.id]
    ));

    // json_agg returns null for an empty set, which COALESCE already turns into
    // [] above — so every list is an array and the client never has to guard.
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "GET /api/dashboard", err);
  }
});

export default router;
