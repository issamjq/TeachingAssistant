import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr, buildPatch } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";

const QUIZ_FIELDS = [
  "title", "subject", "grade", "section", "language", "difficulty",
  "duration_minutes", "total_marks", "status", "scheduled_for", "instructions",
];
const QUIZ_SELECT = `id, title, subject, grade, section, language, difficulty,
                     duration_minutes, total_marks, status, scheduled_for,
                     instructions, created_at, updated_at`;

const router = crudRouter({
  table: "quizzes",
  fields: QUIZ_FIELDS,
  selectCols: QUIZ_SELECT,
  listOrderBy: "scheduled_for DESC NULLS LAST, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/quizzes",
  teacherScoped: true,
  softDelete: true,
});

const QUESTION_FIELDS = ["position", "type", "prompt", "choices", "correct_answer", "marks"];
const QUESTION_SELECT = "id, quiz_id, position, type, prompt, choices, correct_answer, marks";
// `choices` and `correct_answer` are JSONB. The pg driver passes bare
// arrays as PG text[] and bare strings as plain text — JSONB rejects
// both with 22P02. Even a string like "A" needs to be JSON-encoded
// ('"A"') for JSONB to accept it. So always JSON.stringify on the way
// in (matching what the /bulk route already does).
const QUESTION_JSONB = new Set(["choices", "correct_answer"]);
const normalizeQuestionBody = (body) => {
  const out = { ...body };
  for (const k of QUESTION_JSONB) {
    if (Object.prototype.hasOwnProperty.call(out, k) && out[k] != null) {
      out[k] = JSON.stringify(out[k]);
    }
  }
  return out;
};

// POST /api/quizzes/bulk — create a quiz and all its questions in one
// atomic transaction. Used by AI Studio's "Save" action when the structured
// quiz generator returns a complete quiz object. Body shape mirrors what
// the studio /api/studio/quiz endpoint emits:
//   { title, subject, grade, duration_minutes, total_marks, instructions,
//     questions: [{ position, type, prompt, choices, correct_answer, marks }] }
router.post("/bulk", async (req, res) => {
  const client = await pool.connect();
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(401).json({ error: "No current teacher" });
    const {
      title, subject, grade, section, language, difficulty,
      duration_minutes, total_marks, status, scheduled_for, instructions,
      questions,
    } = req.body || {};
    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "title and a non-empty questions array are required" });
    }

    await client.query("BEGIN");
    const quizRes = await client.query(
      `INSERT INTO quizzes (account_id, title, subject, grade, section, language,
                            difficulty, duration_minutes, total_marks, status,
                            scheduled_for, instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'Draft'), $11, $12)
       RETURNING ${QUIZ_SELECT}`,
      [
        cur.id, title, subject || null, grade || null, section || null,
        language || null, difficulty || null,
        duration_minutes || null, total_marks || null, status || null,
        scheduled_for || null, instructions || null,
      ]
    );
    const quiz = quizRes.rows[0];

    const inserted = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const r = await client.query(
        `INSERT INTO quiz_questions (quiz_id, position, type, prompt, choices, correct_answer, marks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${QUESTION_SELECT}`,
        [
          quiz.id,
          q.position ?? i + 1,
          q.type,
          q.prompt,
          q.choices != null ? JSON.stringify(q.choices) : null,
          q.correct_answer != null ? JSON.stringify(q.correct_answer) : null,
          q.marks ?? 1,
        ]
      );
      inserted.push(r.rows[0]);
    }
    await client.query("COMMIT");
    res.status(201).json({ quiz, questions: inserted });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    handleErr(res, "POST /api/quizzes/bulk", err);
  } finally {
    client.release();
  }
});

// POST /api/quizzes/:id/sync — atomic re-save of a previously-created
// quiz. Used by the AI Studio when the teacher edits a quiz after
// saving and wants the changes to persist. Updates the quiz row and
// REPLACES every quiz_questions row in a single transaction (cleaner
// than per-field diffs; the studio is the only writer here so we
// don't need to preserve question IDs).
router.post("/:quizId/sync", async (req, res) => {
  const client = await pool.connect();
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(401).json({ error: "No current teacher" });
    const own = await pool.query(
      "SELECT id FROM quizzes WHERE id = $1 AND account_id = $2",
      [req.params.quizId, cur.id]
    );
    if (own.rows.length === 0) return res.status(404).json({ error: "Quiz not found" });

    const {
      title, subject, grade, section, language, difficulty,
      duration_minutes, total_marks, status, scheduled_for, instructions,
      questions,
    } = req.body || {};
    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "title and a non-empty questions array are required" });
    }

    await client.query("BEGIN");
    const quizRes = await client.query(
      `UPDATE quizzes
          SET title = $2, subject = $3, grade = $4, section = $5,
              language = $6, difficulty = $7, duration_minutes = $8,
              total_marks = $9, status = COALESCE($10, status),
              scheduled_for = $11, instructions = $12,
              updated_at = NOW()
        WHERE id = $1 AND account_id = $13
        RETURNING ${QUIZ_SELECT}`,
      [
        req.params.quizId, title, subject || null, grade || null,
        section || null, language || null, difficulty || null,
        duration_minutes || null, total_marks || null, status || null,
        scheduled_for || null, instructions || null, cur.id,
      ]
    );
    if (quizRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Quiz not found" });
    }

    await client.query(
      "DELETE FROM quiz_questions WHERE quiz_id = $1",
      [req.params.quizId]
    );

    const inserted = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const r = await client.query(
        `INSERT INTO quiz_questions (quiz_id, position, type, prompt, choices, correct_answer, marks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${QUESTION_SELECT}`,
        [
          req.params.quizId,
          q.position ?? i + 1,
          q.type,
          q.prompt,
          q.choices != null ? JSON.stringify(q.choices) : null,
          q.correct_answer != null ? JSON.stringify(q.correct_answer) : null,
          q.marks ?? 1,
        ]
      );
      inserted.push(r.rows[0]);
    }
    await client.query("COMMIT");
    res.json({ quiz: quizRes.rows[0], questions: inserted });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    handleErr(res, "POST /api/quizzes/:id/sync", err);
  } finally {
    client.release();
  }
});

// Helper: ensure the quiz being touched belongs to the current teacher.
// Takes req so it can resolve the current teacher from the auth
// middleware. Returns false if there's no teacher or no matching quiz.
const assertOwnsQuiz = async (req, quizId) => {
  const cur = await loadCurrentTeacher(req);
  if (!cur) return false;
  const r = await pool.query(
    "SELECT id FROM quizzes WHERE id = $1 AND account_id = $2",
    [quizId, cur.id]
  );
  return r.rows.length > 0;
};

// Sub-resource: questions under a quiz.
router.get("/:quizId/questions", async (req, res) => {
  try {
    if (!(await assertOwnsQuiz(req, req.params.quizId))) {
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
    if (!(await assertOwnsQuiz(req, req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const body = normalizeQuestionBody(req.body || {});
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
    if (!(await assertOwnsQuiz(req, req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const { sets, params } = buildPatch(normalizeQuestionBody(req.body || {}), QUESTION_FIELDS);
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
    if (!(await assertOwnsQuiz(req, req.params.quizId))) {
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
    if (!(await assertOwnsQuiz(req, req.params.quizId))) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const r = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
              qs.score, qs.max_score, qs.feedback, qs.recorded_at
         FROM students s
         LEFT JOIN quiz_scores qs ON qs.student_id = s.id AND qs.quiz_id = $1
        WHERE s.account_id = (SELECT account_id FROM quizzes WHERE id = $1)
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
    if (!(await assertOwnsQuiz(req, req.params.quizId))) {
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
