// Quiz scores — per-student score on a given quiz. The table already
// exists in db/init.js (quiz_scores), but had no REST surface until now.
// Used by My Students → Scores to record what each student actually got
// on each quiz the teacher gave.
//
// Scope: only the teacher who owns the quiz can read/write its scores —
// enforced by joining quiz_scores → quizzes and filtering on
// quizzes.teacher_id.
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
    const cur = await loadCurrentTeacher();
    const params = [cur.id];
    let where = "q.teacher_id = $1";
    if (req.query.quiz_id) {
      params.push(req.query.quiz_id);
      where += ` AND qs.quiz_id = $${params.length}`;
    }
    if (req.query.student_id) {
      params.push(req.query.student_id);
      where += ` AND qs.student_id = $${params.length}`;
    }
    const r = await pool.query(
      `SELECT qs.id, qs.quiz_id, qs.student_id, qs.score, qs.max_score,
              qs.feedback, qs.recorded_at
         FROM quiz_scores qs
         JOIN quizzes q ON q.id = qs.quiz_id
        WHERE ${where}
        ORDER BY qs.recorded_at DESC`,
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
    const cur = await loadCurrentTeacher();
    const { quiz_id, student_id, score, max_score, feedback } = req.body || {};
    if (!quiz_id || !student_id) {
      return res.status(400).json({ error: "quiz_id and student_id are required" });
    }
    // Verify the quiz belongs to this teacher before writing — defence
    // against a teacher trying to score a quiz they don't own.
    const own = await pool.query(`SELECT 1 FROM quizzes WHERE id = $1 AND teacher_id = $2`, [quiz_id, cur.id]);
    if (own.rowCount === 0) return res.status(404).json({ error: "Quiz not found" });
    const r = await pool.query(
      `INSERT INTO quiz_scores (quiz_id, student_id, score, max_score, feedback)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (quiz_id, student_id) DO UPDATE
         SET score = EXCLUDED.score,
             max_score = EXCLUDED.max_score,
             feedback = EXCLUDED.feedback,
             recorded_at = NOW()
       RETURNING id, quiz_id, student_id, score, max_score, feedback, recorded_at`,
      [quiz_id, student_id, score, max_score ?? null, feedback ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/quiz-scores", err);
  }
});

// DELETE /api/quiz-scores/:id — un-record a score (e.g. mis-entered row).
router.delete("/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    const r = await pool.query(
      `DELETE FROM quiz_scores qs
        USING quizzes q
        WHERE qs.id = $1
          AND qs.quiz_id = q.id
          AND q.teacher_id = $2
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
