import { Router } from "express";
import { withTenant } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";

const FIELDS = [
  "title", "subject", "grade", "section",
  "instructions", "due_date", "status", "attachments",
];
const SELECT = `id, title, subject, grade, section,
                instructions, due_date, status, attachments,
                created_at, updated_at`;

const router = crudRouter({
  table: "homework",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "due_date NULLS LAST, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/homework",
  teacherScoped: true,
  softDelete: true,
});

// Returns the teacher when they own the homework, null otherwise — the
// caller needs the id anyway to run its own queries under withTenant().
const assertOwns = async (req, id) => {
  const cur = await loadCurrentTeacher(req);
  if (!cur) return null;
  const r = await withTenant(cur.id, (db) => db.query(
    "SELECT id FROM homework WHERE id = $1 AND account_id = $2",
    [id, cur.id]
  ));
  return r.rows.length > 0 ? cur : null;
};

// Per-student submission grid for one homework.
router.get("/:id/submissions", async (req, res) => {
  try {
    const cur = await assertOwns(req, req.params.id);
    if (!cur) return res.status(404).json({ error: "Not found" });
    const r = await withTenant(cur.id, (db) => db.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
              hs.status, hs.submitted_at, hs.score, hs.max_score, hs.feedback
         FROM students s
         LEFT JOIN homework_submissions hs ON hs.student_id = s.id AND hs.homework_id = $1
        WHERE s.account_id = (SELECT account_id FROM homework WHERE id = $1)
        ORDER BY s.grade, s.section, s.last_name`,
      [req.params.id]
    ));
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/homework/:id/submissions", err);
  }
});

router.put("/:id/submissions/:studentId", async (req, res) => {
  try {
    const cur = await assertOwns(req, req.params.id);
    if (!cur) return res.status(404).json({ error: "Not found" });

    const { status, submitted_at, score, max_score, feedback } = req.body || {};
    if (status && !["Pending", "Submitted", "Graded", "Returned", "Late"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    // Also verify the student belongs to this teacher — without it, an
    // attacker could attach a submission row to a foreign student. Checked in
    // the same transaction as the upsert so ownership can't shift between them.
    const { own, r } = await withTenant(cur.id, async (db) => {
      const own = await db.query(
        "SELECT 1 FROM students WHERE id = $1 AND account_id = $2",
        [req.params.studentId, cur.id]
      );
      if (own.rowCount === 0) return { own, r: null };
      const r = await db.query(
      `INSERT INTO homework_submissions (homework_id, student_id, status, submitted_at, score, max_score, feedback)
       VALUES ($1, $2, COALESCE($3, 'Pending'), $4, $5, $6, $7)
       ON CONFLICT (homework_id, student_id) DO UPDATE
         SET status = EXCLUDED.status,
             submitted_at = EXCLUDED.submitted_at,
             score = EXCLUDED.score,
             max_score = EXCLUDED.max_score,
             feedback = EXCLUDED.feedback
       RETURNING *`,
      [
        req.params.id, req.params.studentId,
        status ?? null,
        submitted_at ?? null,
        score ?? null,
        max_score ?? null,
          feedback ?? null,
        ]
      );
      return { own, r };
    });
    if (own.rowCount === 0) return res.status(404).json({ error: "Student not found" });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/homework/:id/submissions/:sid", err);
  }
});

export default router;
