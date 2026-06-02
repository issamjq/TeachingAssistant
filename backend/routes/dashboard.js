import { Router } from "express";
import { pool } from "../lib/db.js";
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
router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);

    const [
      todayLessons,
      upcomingLessons,
      pendingHomework,
      pendingQuizzes,
      recentDrafts,
      counts,
      recentNotifications,
    ] = await Promise.all([
      pool.query(
        `SELECT id, title, subject, grade, section, start_time, end_time, location, status
           FROM schedule_entries
          WHERE account_id = $1 AND date = CURRENT_DATE
          ORDER BY start_time`,
        [cur.id]
      ),
      pool.query(
        `SELECT id, title, subject, grade, section, date, start_time, status
           FROM schedule_entries
          WHERE account_id = $1
            AND date > CURRENT_DATE
            AND date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY date, start_time
          LIMIT 8`,
        [cur.id]
      ),
      pool.query(
        `SELECT id, title, subject, grade, section, due_date, status
           FROM homework
          WHERE account_id = $1 AND status = 'Open'
            AND (due_date IS NULL OR due_date <= CURRENT_DATE + INTERVAL '7 days')
          ORDER BY due_date NULLS LAST
          LIMIT 8`,
        [cur.id]
      ),
      pool.query(
        `SELECT id, title, subject, grade, section, scheduled_for, total_marks, status
           FROM quizzes
          WHERE account_id = $1
            AND scheduled_for IS NOT NULL
            AND scheduled_for >= CURRENT_DATE
            AND scheduled_for <= CURRENT_DATE + INTERVAL '14 days'
          ORDER BY scheduled_for
          LIMIT 8`,
        [cur.id]
      ),
      pool.query(
        `SELECT id, name, subject, status, progress, last_edited
           FROM drafts
          WHERE account_id = $1
          ORDER BY last_edited DESC NULLS LAST
          LIMIT 5`,
        [cur.id]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM students      WHERE account_id = $1) AS students,
           (SELECT COUNT(*)::int FROM drafts        WHERE account_id = $1) AS drafts,
           (SELECT COUNT(*)::int FROM templates     WHERE account_id = $1) AS templates,
           (SELECT COUNT(*)::int FROM quizzes       WHERE account_id = $1) AS quizzes,
           (SELECT COUNT(*)::int FROM homework      WHERE account_id = $1) AS homework,
           (SELECT COUNT(*)::int FROM presentations WHERE account_id = $1) AS presentations,
           (SELECT COUNT(*)::int FROM activities    WHERE account_id = $1) AS activities`,
        [cur.id]
      ),
      pool.query(
        `SELECT id, kind, message, link, is_read, created_at
           FROM notifications
          WHERE account_id = $1 AND is_read = FALSE
          ORDER BY created_at DESC
          LIMIT 5`,
        [cur.id]
      ),
    ]);

    res.json({
      today_lessons: todayLessons.rows,
      upcoming_lessons: upcomingLessons.rows,
      pending_homework: pendingHomework.rows,
      pending_quizzes: pendingQuizzes.rows,
      recent_drafts: recentDrafts.rows,
      counts: counts.rows[0],
      recent_notifications: recentNotifications.rows,
    });
  } catch (err) {
    handleErr(res, "GET /api/dashboard", err);
  }
});

export default router;
