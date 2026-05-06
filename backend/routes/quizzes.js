import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr, buildPatch } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";

const QUIZ_FIELDS = [
  "title", "subject", "grade", "section", "duration_minutes",
  "total_marks", "status", "scheduled_for", "instructions",
];
const QUIZ_SELECT = `id, title, subject, grade, section, duration_minutes,
                     total_marks, status, scheduled_for, instructions,
                     created_at, updated_at`;

const router = crudRouter({
  table: "quizzes",
  fields: QUIZ_FIELDS,
  selectCols: QUIZ_SELECT,
  listOrderBy: "scheduled_for DESC NULLS LAST, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/quizzes",
  teacherScoped: true,
});

const QUESTION_FIELDS = ["position", "type", "prompt", "choices", "correct_answer", "marks"];
const QUESTION_SELECT = "id, quiz_id, position, type, prompt, choices, correct_answer, marks";

// Helper: ensure the quiz being touched belongs to the current teacher.
const assertOwnsQuiz = async (quizId) => {
  const cur = await loadCurrentTeacher();
  const r = await pool.query(
    "SELECT id FROM quizzes WHERE id = $1 AND teacher_id = $2",
    [quizId, cur.id]
  );
  return r.rows.length > 0;
};

// Sub-resource: questions under a quiz.
router.get("/:quizId/questions", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const r = await pool.query(
      `SELECT ${QUESTION_SELECT} FROM quiz_questions WHERE quiz_id = $1 ORDER BY position`,
      [req.params.quizId]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/quizzes/:id/questions", err);
  }
});

router.post("/:quizId/questions", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const body = { ...req.body };
    const { sets, params } = buildPatch(body, QUESTION_FIELDS);
    if (sets.length === 0) return res.status(400).json({ error: "No fields" });
    const cols = QUESTION_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
    cols.unshift("quiz_id");
    params.unshift(req.params.quizId);
    const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
    const r = await pool.query(
      `INSERT INTO quiz_questions (${cols.join(", ")}) VALUES (${placeholders}) RETURNING ${QUESTION_SELECT}`,
      params
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/quizzes/:id/questions", err);
  }
});

router.patch("/:quizId/questions/:qid", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const { sets, params } = buildPatch(req.body || {}, QUESTION_FIELDS);
    if (sets.length === 0) return res.status(400).json({ error: "No fields" });
    params.push(req.params.qid, req.params.quizId);
    const r = await pool.query(
      `UPDATE quiz_questions SET ${sets.join(", ")}
        WHERE id = $${params.length - 1} AND quiz_id = $${params.length}
        RETURNING ${QUESTION_SELECT}`,
      params
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/quizzes/:id/questions/:qid", err);
  }
});

router.delete("/:quizId/questions/:qid", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const r = await pool.query(
      "DELETE FROM quiz_questions WHERE id = $1 AND quiz_id = $2",
      [req.params.qid, req.params.quizId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/quizzes/:id/questions/:qid", err);
  }
});

// Sub-resource: per-student scores.
router.get("/:quizId/scores", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const r = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
              qs.score, qs.max_score, qs.feedback, qs.recorded_at
         FROM students s
         LEFT JOIN quiz_scores qs ON qs.student_id = s.id AND qs.quiz_id = $1
        WHERE s.teacher_id = (SELECT teacher_id FROM quizzes WHERE id = $1)
        ORDER BY s.grade, s.section, s.last_name`,
      [req.params.quizId]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/quizzes/:id/scores", err);
  }
});

router.put("/:quizId/scores/:studentId", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const { score, max_score, feedback } = req.body || {};
    const r = await pool.query(
      `INSERT INTO quiz_scores (quiz_id, student_id, score, max_score, feedback)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (quiz_id, student_id) DO UPDATE
         SET score = EXCLUDED.score,
             max_score = EXCLUDED.max_score,
             feedback = EXCLUDED.feedback,
             recorded_at = NOW()
       RETURNING quiz_id, student_id, score, max_score, feedback, recorded_at`,
      [req.params.quizId, req.params.studentId, score ?? null, max_score ?? null, feedback ?? null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/quizzes/:id/scores/:sid", err);
  }
});

export default router;
