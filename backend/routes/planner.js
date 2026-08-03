import { Router } from "express";
import { withTenant } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

// Aggregated calendar payload — one round-trip for the Planner grid and the
// TeachingRail sidebar (F56).
//
// Both surfaces need the same five lists, and both used to fetch them as five
// separate `apiList()` calls. Each of those is its own `withTenant()`
// transaction, and each transaction costs five round-trips (BEGIN, SET LOCAL
// ROLE, set_config, the query, COMMIT). Five requests × five round-trips = 25
// round-trips to paint the teacher's default landing page — and because Planner
// and TeachingRail render together on the teaching sections, it was ten requests
// in flight at once. The pool holds 10 connections, so one teacher opening one
// page could occupy the entire pool.
//
// This is the same shape as the dashboard fix (F51): every list is a scalar
// sub-select returning json_agg, evaluated in one pass, returned as one row.
// 25 round-trips become 5.
//
// Two things are deliberately done here rather than on the client:
//
//   1. The "has a date" filter. Planner and TeachingRail both drop rows with no
//      scheduled_for / due_date immediately on arrival, so sending them was pure
//      payload. Filtering in SQL also lets the date indexes do the work.
//   2. The `status <> 'done'` filter on schedule entries, for the same reason.
//      NULL-safe via IS DISTINCT FROM, because status is nullable.
//
// Soft-deleted rows are excluded to match what the crudRouter list endpoints
// return — quizzes, homework, presentations and activities all have
// `softDelete: true`, so `deleted_at IS NULL` is what the teacher already sees
// on those screens. schedule_entries has no soft delete.
//
// The schedule projection matches SELECT in routes/schedule.js exactly, because
// Planner keeps the whole row as `raw` and hands it to SchedulePopup for edit
// and delete. Trimming columns here would break editing.
router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);

    const r = await withTenant(cur.id, (db) => db.query(
      `SELECT
         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, draft_id, title, subject, grade, section,
                  date, start_time, end_time, location, notes, status,
                  created_at, updated_at
             FROM schedule_entries
            WHERE account_id = $1
              AND status IS DISTINCT FROM 'done'
            ORDER BY date, start_time) t), '[]'::json) AS schedule,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, scheduled_for
             FROM quizzes
            WHERE account_id = $1
              AND deleted_at IS NULL
              AND scheduled_for IS NOT NULL
            ORDER BY scheduled_for) t), '[]'::json) AS quizzes,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, due_date
             FROM homework
            WHERE account_id = $1
              AND deleted_at IS NULL
              AND due_date IS NOT NULL
            ORDER BY due_date) t), '[]'::json) AS homework,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, scheduled_for
             FROM presentations
            WHERE account_id = $1
              AND deleted_at IS NULL
              AND scheduled_for IS NOT NULL
            ORDER BY scheduled_for) t), '[]'::json) AS presentations,

         COALESCE((SELECT json_agg(t) FROM (
           SELECT id, title, scheduled_for
             FROM activities
            WHERE account_id = $1
              AND deleted_at IS NULL
              AND scheduled_for IS NOT NULL
            ORDER BY scheduled_for) t), '[]'::json) AS activities`,
      [cur.id]
    ));

    // COALESCE above means json_agg's null-on-empty never reaches the client:
    // every key is an array, so the caller never has to guard.
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "GET /api/planner", err);
  }
});

export default router;
