// =====================================================================
// /api/dashboard — one round-trip for the home screen
//
// The wire shape is unchanged; where it comes from is not. Lesson plans,
// quizzes, homework and presentations used to be four tables and are now
// one — ai_studio, discriminated by `type` — so the counts that were
// four scans of four tables are a single grouped scan of one.
//
// Anything a teacher has *given out* comes through assignments, which is
// what joins a generated artifact to a class and a date window.
// =====================================================================
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";

const router = Router();

// ai_studio.content is jsonb whose shape depends on `type`, so a title
// may be under any of these. COALESCE rather than a per-type branch:
// the dashboard only needs something to print.
const TITLE = `COALESCE(a.content->>'title', a.content->>'name', a.content->>'topic', initcap(replace(a.type,'_',' ')))`;

router.get("/", async (req, res) => {
  try {
    const fid = req.account.id;

    const [today, upcoming, dueSoon, recent, counts, notes] = await Promise.all([
      // Today's timetable.
      pool.query(
        `SELECT id, title, subject, grade, section, start_time, end_time, location, status
           FROM schedule_entries
          WHERE faculty_id = $1 AND date = CURRENT_DATE
          ORDER BY start_time NULLS LAST`,
        [fid]
      ),
      pool.query(
        `SELECT id, title, subject, grade, section, date, start_time, status
           FROM schedule_entries
          WHERE faculty_id = $1
            AND date > CURRENT_DATE AND date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY date, start_time NULLS LAST
          LIMIT 8`,
        [fid]
      ),
      // Work that is out with a class and still open. One query for what
      // used to be "pending homework" and "pending quizzes" both, split
      // by type on the way out.
      pool.query(
        `SELECT asg.id, asg.starts_at, asg.ends_at, asg.class_id,
                c.name AS class_name, c.grade, c.subject,
                a.type, ${TITLE} AS title
           FROM assignments asg
           JOIN ai_studio a ON a.id = asg.generation_id
           LEFT JOIN classes c ON c.id = asg.class_id
          WHERE a.faculty_id = $1
            AND (asg.ends_at IS NULL OR asg.ends_at >= now())
            AND asg.starts_at <= now() + INTERVAL '14 days'
          ORDER BY asg.ends_at NULLS LAST, asg.starts_at
          LIMIT 16`,
        [fid]
      ),
      pool.query(
        `SELECT a.id, ${TITLE} AS name, a.type, a.status,
                a.content->>'subject' AS subject, a.updated_at AS last_edited
           FROM ai_studio a
          WHERE a.faculty_id = $1
          ORDER BY a.updated_at DESC
          LIMIT 5`,
        [fid]
      ),
      // Counts. The generated ones come from a single grouped scan; the
      // rest are genuinely different tables.
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM class_members cm
              JOIN classes c ON c.id = cm.class_id
             WHERE c.faculty_id = $1)                              AS students,
           (SELECT COUNT(*)::int FROM classes   WHERE faculty_id = $1 AND NOT is_archived) AS classes,
           (SELECT COUNT(*)::int FROM materials WHERE faculty_id = $1) AS materials,
           (SELECT COALESCE(jsonb_object_agg(type, n), '{}'::jsonb)
              FROM (SELECT type, COUNT(*)::int n FROM ai_studio
                     WHERE faculty_id = $1 GROUP BY type) g)        AS by_type`,
        [fid]
      ),
      pool.query(
        `SELECT id, kind, title, body AS message, link,
                (read_at IS NOT NULL) AS is_read, created_at
           FROM notifications
          WHERE user_id = $1 AND read_at IS NULL
          ORDER BY created_at DESC
          LIMIT 5`,
        [req.account.user_id]
      ),
    ]);

    const byType = counts.rows[0].by_type || {};
    const ofType = (t) => dueSoon.rows.filter((r) => r.type === t);

    res.json({
      today_lessons: today.rows,
      upcoming_lessons: upcoming.rows,
      pending_homework: ofType("homework"),
      pending_quizzes: ofType("quiz"),
      recent_drafts: recent.rows,
      assignments_open: dueSoon.rows,
      counts: {
        students: counts.rows[0].students,
        classes: counts.rows[0].classes,
        materials: counts.rows[0].materials,
        drafts: byType.lesson_plan || 0,
        quizzes: byType.quiz || 0,
        homework: byType.homework || 0,
        presentations: byType.presentation || 0,
        activities: byType.activity || 0,
        // Kept so the tile that reads it renders a 0 rather than a blank.
        templates: byType.template || 0,
      },
      recent_notifications: notes.rows,
    });
  } catch (err) {
    handleErr(res, "GET /api/dashboard", err);
  }
});

export default router;
