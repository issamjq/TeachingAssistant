// =====================================================================
// The per-student grid, for any kind of assigned work
//
// Homework submissions, activity completions and quiz scores were three
// tables and three route pairs. They are one question — "who has done
// this, and how did they do" — and the schema now answers it once:
//
//   ai_studio     the thing that was set
//   assignments   who it was set to, and when it is open
//   quiz_attempts what each student did with it
//
// Two things this must get right, because both are the kind of bug that
// tests pass over:
//
//   1. An artifact can be assigned to more than one class. The grid is
//      the union of the rosters, deduplicated — not the first class.
//   2. A teacher may only read and write their own. Ownership is checked
//      against ai_studio.faculty_id on every call, and writes verify the
//      student is actually on the assignment. Without that second check
//      a teacher could post a mark against any student id they can name.
// =====================================================================
import { Router } from "express";
import { pool } from "./db.js";
import { handleErr } from "./helpers.js";

/** Does this artifact belong to the caller, and is it the right kind? */
async function owns(req, id, type) {
  const r = await pool.query(
    `SELECT id FROM ai_studio WHERE id = $1::uuid AND faculty_id = $2 AND type = $3`,
    [id, req.account.id, type]
  );
  return r.rowCount > 0;
}

/**
 * @param type      the ai_studio type this grid belongs to
 * @param path      "submissions" | "completions" | "scores"
 * @param statuses  the vocabulary this screen uses, or null to accept
 *                  whatever the column's CHECK allows
 */
export function submissionRoutes(router = Router(), { type, path, statuses = null } = {}) {
  // GET — every student the work was assigned to, with their attempt if
  // they have one. LEFT JOIN, because a grid that only lists students
  // who have already submitted is not a grid, it is a list.
  router.get(`/:id/${path}`, async (req, res) => {
    try {
      if (!(await owns(req, req.params.id, type))) {
        return res.status(404).json({ error: "Not found" });
      }
      const r = await pool.query(
        `SELECT DISTINCT ON (st.id)
                st.id           AS student_id,
                st.student_code AS code,
                u.first_name, u.last_name,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.full_name) AS name,
                st.grade, st.division AS section,
                c.id AS class_id, c.name AS class_name,
                qa.status, qa.submitted_at, qa.started_at,
                qa.score, qa.max_score, qa.feedback, qa.answers
           FROM assignments asg
           JOIN classes       c  ON c.id  = asg.class_id
           JOIN class_members cm ON cm.class_id = c.id
           JOIN students      st ON st.id = cm.student_id
           JOIN users         u  ON u.id  = st.user_id
           LEFT JOIN quiz_attempts qa
                  ON qa.assignment_id = asg.id AND qa.student_id = st.id
          WHERE asg.generation_id = $1::uuid
          ORDER BY st.id, qa.submitted_at DESC NULLS LAST`,
        [req.params.id]
      );
      // DISTINCT ON needs its own sort; the screen wants a register order.
      const rows = r.rows.sort((a, b) =>
        (a.grade || "").localeCompare(b.grade || "") ||
        (a.section || "").localeCompare(b.section || "") ||
        (a.last_name || "").localeCompare(b.last_name || "")
      );
      res.json(rows);
    } catch (err) {
      handleErr(res, `GET /:id/${path}`, err);
    }
  });

  // PUT — record or correct one student's attempt.
  router.put(`/:id/${path}/:studentId`, async (req, res) => {
    try {
      if (!(await owns(req, req.params.id, type))) {
        return res.status(404).json({ error: "Not found" });
      }
      const { status, submitted_at, score, max_score, feedback, answers } = req.body || {};
      if (status && statuses && !statuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }

      // The assignment this student is actually on. This is the
      // authorisation check as well as the lookup: a student not on any
      // of this artifact's assignments produces no row, and the write
      // stops here rather than creating an orphan attempt.
      const asg = await pool.query(
        `SELECT asg.id
           FROM assignments asg
           JOIN class_members cm ON cm.class_id = asg.class_id
          WHERE asg.generation_id = $1::uuid AND cm.student_id = $2::uuid
          ORDER BY asg.starts_at DESC
          LIMIT 1`,
        [req.params.id, req.params.studentId]
      );
      if (asg.rowCount === 0) {
        return res.status(404).json({ error: "That student isn't assigned this work." });
      }

      const r = await pool.query(
        `INSERT INTO quiz_attempts
           (assignment_id, student_id, status, submitted_at, score, max_score, feedback, answers)
         VALUES ($1, $2, COALESCE($3, 'pending'), $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET
           status       = COALESCE(EXCLUDED.status, quiz_attempts.status),
           submitted_at = COALESCE(EXCLUDED.submitted_at, quiz_attempts.submitted_at),
           score        = COALESCE(EXCLUDED.score, quiz_attempts.score),
           max_score    = COALESCE(EXCLUDED.max_score, quiz_attempts.max_score),
           feedback     = COALESCE(EXCLUDED.feedback, quiz_attempts.feedback),
           answers      = COALESCE(EXCLUDED.answers, quiz_attempts.answers),
           updated_at   = now()
         RETURNING *`,
        [
          asg.rows[0].id, req.params.studentId,
          status ?? null, submitted_at ?? null,
          score ?? null, max_score ?? null, feedback ?? null,
          answers === undefined ? null : JSON.stringify(answers),
        ]
      );
      res.json(r.rows[0]);
    } catch (err) {
      handleErr(res, `PUT /:id/${path}/:studentId`, err);
    }
  });

  return router;
}
