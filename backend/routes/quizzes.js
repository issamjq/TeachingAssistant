// =====================================================================
// /api/quizzes — quizzes and their questions
//
// A quiz is an ai_studio row of type 'quiz'. Its questions live in
// content.questions as an array, not in a table of their own.
//
// That is a real trade and worth naming: a separate quiz_questions table
// gave each question a stable id and let one be updated without
// rewriting the rest. An array does not — so every write here reads the
// array, changes it, and writes it back, and two teachers editing the
// same quiz at once would have the last write win.
//
// It is still the right shape. A quiz is authored, reviewed and marked
// as one document; its questions are never queried across quizzes, never
// referenced from elsewhere, and are always fetched together. Each
// question keeps a `qid` so the routes that address one by id still can.
// =====================================================================
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { artifactRouter, flattenArtifact } from "../lib/artifacts.js";
import { submissionRoutes } from "../lib/submissions.js";

const QUIZ_FIELDS = [
  "title", "subject", "grade", "section", "language", "difficulty",
  "duration_minutes", "total_marks", "scheduled_for", "instructions",
];

const router = artifactRouter({
  type: "quiz",
  fields: QUIZ_FIELDS,
  routeName: "/api/quizzes",
  listOrderBy: "(content->>'scheduled_for') DESC NULLS LAST, updated_at DESC",
});

const QUESTION_FIELDS = ["position", "type", "prompt", "choices", "correct_answer", "marks"];

/** One question, with an id and only the fields we recognise. */
const normalise = (q, i) => {
  const out = { qid: q?.qid || randomUUID(), position: q?.position ?? i + 1 };
  for (const f of QUESTION_FIELDS) if (q?.[f] !== undefined) out[f] = q[f];
  return out;
};

/** The quiz, if it is this teacher's. Returns the row or null. */
async function load(req, id) {
  const r = await pool.query(
    `SELECT id, content FROM ai_studio
      WHERE id = $1::uuid AND faculty_id = $2 AND type = 'quiz' AND deleted_at IS NULL`,
    [id, req.account.id]
  );
  return r.rows[0] || null;
}

/** Replace the questions array wholesale and return the updated quiz. */
async function saveQuestions(req, id, questions) {
  const r = await pool.query(
    `UPDATE ai_studio
        SET content = COALESCE(content, '{}'::jsonb) || jsonb_build_object('questions', $1::jsonb),
            updated_at = now()
      WHERE id = $2::uuid AND faculty_id = $3 AND type = 'quiz'
      RETURNING id, type, status, content, created_at, updated_at, deleted_at`,
    [JSON.stringify(questions), id, req.account.id]
  );
  return r.rows[0];
}

// POST /bulk — a whole quiz and its questions in one write. Used by the
// studio's Save, where the generator hands back a complete quiz.
//
// This was a transaction across two tables; it is now a single INSERT,
// which is the one unambiguous win of the move — the quiz and its
// questions can no longer be half-saved.
router.post("/bulk", async (req, res) => {
  try {
    const { questions, ...rest } = req.body || {};
    if (!rest.title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "title and a non-empty questions array are required" });
    }
    const content = {};
    for (const f of QUIZ_FIELDS) if (rest[f] !== undefined) content[f] = rest[f];
    content.questions = questions.map(normalise);

    const r = await pool.query(
      `INSERT INTO ai_studio (faculty_id, type, status, content)
       VALUES ($1, 'quiz', COALESCE($2, 'complete'), $3::jsonb)
       RETURNING id, type, status, content, created_at, updated_at, deleted_at`,
      [req.account.id, rest.status ?? null, JSON.stringify(content)]
    );
    res.status(201).json(flattenArtifact(r.rows[0], QUIZ_FIELDS));
  } catch (err) { handleErr(res, "POST /api/quizzes/bulk", err); }
});

// POST /:quizId/sync — replace every question in one call.
router.post("/:quizId/sync", async (req, res) => {
  try {
    if (!(await load(req, req.params.quizId))) return res.status(404).json({ error: "Not found" });
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : null;
    if (!questions) return res.status(400).json({ error: "questions array is required" });
    const row = await saveQuestions(req, req.params.quizId, questions.map(normalise));
    res.json(flattenArtifact(row, QUIZ_FIELDS));
  } catch (err) { handleErr(res, "POST /api/quizzes/:quizId/sync", err); }
});

router.get("/:quizId/questions", async (req, res) => {
  try {
    const quiz = await load(req, req.params.quizId);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    const qs = (quiz.content?.questions || []).map(normalise);
    qs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    res.json(qs.map((q) => ({ ...q, id: q.qid, quiz_id: quiz.id })));
  } catch (err) { handleErr(res, "GET /api/quizzes/:quizId/questions", err); }
});

router.post("/:quizId/questions", async (req, res) => {
  try {
    const quiz = await load(req, req.params.quizId);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    const qs = quiz.content?.questions || [];
    const added = normalise(req.body || {}, qs.length);
    await saveQuestions(req, quiz.id, [...qs, added]);
    res.status(201).json({ ...added, id: added.qid, quiz_id: quiz.id });
  } catch (err) { handleErr(res, "POST /api/quizzes/:quizId/questions", err); }
});

router.patch("/:quizId/questions/:qid", async (req, res) => {
  try {
    const quiz = await load(req, req.params.quizId);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    const qs = quiz.content?.questions || [];
    const i = qs.findIndex((q) => q.qid === req.params.qid);
    if (i === -1) return res.status(404).json({ error: "Question not found" });

    const patch = {};
    for (const f of QUESTION_FIELDS) if (req.body?.[f] !== undefined) patch[f] = req.body[f];
    if (!Object.keys(patch).length) return res.status(400).json({ error: "No fields" });

    qs[i] = { ...qs[i], ...patch };
    await saveQuestions(req, quiz.id, qs);
    res.json({ ...qs[i], id: qs[i].qid, quiz_id: quiz.id });
  } catch (err) { handleErr(res, "PATCH /api/quizzes/:quizId/questions/:qid", err); }
});

router.delete("/:quizId/questions/:qid", async (req, res) => {
  try {
    const quiz = await load(req, req.params.quizId);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    const qs = quiz.content?.questions || [];
    const left = qs.filter((q) => q.qid !== req.params.qid);
    if (left.length === qs.length) return res.status(404).json({ error: "Question not found" });
    // Renumber, so positions stay 1..n rather than developing a hole
    // that the next insert would collide with.
    await saveQuestions(req, quiz.id, left.map((q, i) => ({ ...q, position: i + 1 })));
    res.json({ ok: true });
  } catch (err) { handleErr(res, "DELETE /api/quizzes/:quizId/questions/:qid", err); }
});

// Per-student scores — the same grid homework and activities use.
submissionRoutes(router, {
  type: "quiz",
  path: "scores",
  statuses: ["pending", "submitted", "graded", "returned", "late"],
});

export default router;
