// Quiz scores — per-student score on a given quiz. The table already
// was its own table once; scores are quiz_attempts rows now.
// Used by My Students → Scores to record what each student actually got
// on each quiz the teacher gave.
//
// Scope: only the teacher who owns the quiz can read/write its scores —
// enforced by joining quiz_scores → quizzes and filtering on
// quizzes.account_id.
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

// GET /api/quiz-scores?quiz_id=...
//   Returns one row per (quiz, student) for the current teacher. If
//   quiz_id is omitted, returns every score across every quiz the
//   teacher owns (rarely useful but handy for debugging).
router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const params = [cur.id];
    let where = "q.faculty_id = $1";
    if (req.query.quiz_id) {
      params.push(req.query.quiz_id);
      where += ` AND q.id = $${params.length}`;
    }
    if (req.query.student_id) {
      params.push(req.query.student_id);
      where += ` AND qs.student_id = $${params.length}`;
    }
    const r = await pool.query(
      `SELECT qs.id, q.id AS quiz_id, qs.student_id, qs.score, qs.max_score,
              qs.feedback, qs.submitted_at AS recorded_at
         FROM quiz_attempts qs
         JOIN assignments asg ON asg.id = qs.assignment_id
         JOIN ai_studio q ON q.id = asg.generation_id AND q.type = 'quiz'
        WHERE ${where}
        ORDER BY qs.submitted_at DESC NULLS LAST`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/quiz-scores", err);
  }
});

// POST /api/quiz-scores  { quiz_id, student_id, score, max_score?, feedback? }
//   Upsert by (quiz_id, student_id) so calling Save twice replaces the
//   previous attempt rather than throwing on the UNIQUE constraint.
router.post("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const { quiz_id, student_id, score, max_score, feedback } = req.body || {};
    if (!quiz_id || !student_id) {
      return res.status(400).json({ error: "quiz_id and student_id are required" });
    }
    // Verify BOTH the quiz AND the student belong to this teacher.
    // Without the student check, the score row would attach a foreign
    // student to one of our quizzes. The quiz check alone isn't
    // enough — defence-in-depth requires both endpoints of the join.
    // Both endpoints of the join, as before — but the student check is
    // now "is this student visible to me", because a student is no
    // longer owned by one teacher.
    const own = await pool.query(
      `SELECT
         (SELECT 1 FROM ai_studio
           WHERE id = $1::uuid AND faculty_id = $3 AND type = 'quiz' AND deleted_at IS NULL) AS q,
         (SELECT 1 FROM students s
           WHERE s.id = $2::uuid
             AND (s.created_by = $3
                  OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id
                              WHERE cm.student_id = s.id AND c.faculty_id = $3))) AS s`,
      [quiz_id, student_id, cur.id]
    );
    if (!own.rows[0].q) return res.status(404).json({ error: "Quiz not found" });
    if (!own.rows[0].s) return res.status(404).json({ error: "Student not found" });

    // A score belongs to the ASSIGNMENT, not to the quiz directly — a
    // quiz given to two classes is two assignments, and a mark has to
    // say which sitting it was.
    const asg = await pool.query(
      `SELECT asg.id FROM assignments asg
         JOIN class_members cm ON cm.class_id = asg.class_id
        WHERE asg.generation_id = $1::uuid AND cm.student_id = $2::uuid
        ORDER BY asg.starts_at DESC LIMIT 1`,
      [quiz_id, student_id]
    );
    if (asg.rowCount === 0) {
      return res.status(404).json({ error: "That student isn't assigned this quiz." });
    }

    const r = await pool.query(
      `INSERT INTO quiz_attempts (assignment_id, student_id, score, max_score, feedback, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, 'graded', now())
       ON CONFLICT (assignment_id, student_id) DO UPDATE
         SET score = EXCLUDED.score,
             max_score = EXCLUDED.max_score,
             feedback = EXCLUDED.feedback,
             status = 'graded',
             submitted_at = COALESCE(quiz_attempts.submitted_at, now()),
             updated_at = now()
       RETURNING id, student_id, score, max_score, feedback, submitted_at AS recorded_at`,
      [asg.rows[0].id, student_id, score, max_score ?? null, feedback ?? null]
    );
    res.status(201).json({ ...r.rows[0], quiz_id });
  } catch (err) {
    handleErr(res, "POST /api/quiz-scores", err);
  }
});

// DELETE /api/quiz-scores/:id — un-record a score (e.g. mis-entered row).
router.delete("/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const r = await pool.query(
      `DELETE FROM quiz_attempts qs
        USING assignments asg, ai_studio q
        WHERE qs.id = $1::uuid
          AND asg.id = qs.assignment_id
          AND q.id = asg.generation_id
          AND q.faculty_id = $2
        RETURNING qs.id`,
      [req.params.id, cur.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Score not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/quiz-scores/:id", err);
  }
});

export default router;
