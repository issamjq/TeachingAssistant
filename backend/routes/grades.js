// =====================================================================
// /api/grades — the gradebook
//
// A mark is either typed in (student_grades) or earned on assigned work
// (quiz_attempts). /summary averages BOTH, because a teacher's sense of
// how a student is doing does not distinguish between a mark they wrote
// down and one the studio scored.
//
// `category` on the old table is `label` here; `recorded_at` is
// `recorded_on`. Translated at the edge rather than renamed in the
// schema, since the column names read better as they are.
// =====================================================================
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { crudRouter } from "../lib/crud.js";

const FIELDS = ["student_id", "class_id", "source_id", "subject", "term", "label", "score", "max_score"];
const SELECT = `id, student_id, class_id, source_id, subject, term,
                label AS category, score, max_score, recorded_on AS recorded_at`;

const router = Router();

// Same visibility rule as the roster and the register.
const VISIBLE = `(
  s.created_by = $1
  OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id
              WHERE cm.student_id = s.id AND c.faculty_id = $1)
)`;

// Registered BEFORE the crud helper's /:id route — otherwise Express
// matches /:id with id="summary" and Postgres fails on the uuid cast.
router.get("/summary", async (req, res) => {
  try {
    const r = await pool.query(
      `WITH entries AS (
         SELECT student_id, score::numeric AS score, max_score::numeric AS max_score
           FROM student_grades
          WHERE faculty_id = $1 AND score IS NOT NULL AND max_score IS NOT NULL
         UNION ALL
         SELECT qa.student_id, qa.score, qa.max_score
           FROM quiz_attempts qa
           JOIN assignments asg ON asg.id = qa.assignment_id
           JOIN ai_studio   a   ON a.id  = asg.generation_id
          WHERE a.faculty_id = $1 AND qa.score IS NOT NULL AND qa.max_score IS NOT NULL
       )
       SELECT s.id AS student_id, s.first_name, s.last_name,
              s.grade, s.division AS section,
              COUNT(e.*)::int AS entries,
              COALESCE(ROUND(AVG(e.score / NULLIF(e.max_score, 0) * 100)::numeric, 1), 0) AS average_pct
         FROM students s
         LEFT JOIN entries e ON e.student_id = s.id
        WHERE ${VISIBLE}
        GROUP BY s.id
        ORDER BY s.grade, s.division, s.last_name`,
      [req.account.id]
    );
    res.json(r.rows);
  } catch (err) { handleErr(res, "GET /api/grades/summary", err); }
});

/**
 * A grade names a student in its body, and the scope column only proves
 * WHO wrote it — not who it is about. Without this a teacher could
 * attach a mark to any student id they can guess.
 */
const assertOwnsStudent = async (req, res, next) => {
  try {
    const studentId = (req.body || {}).student_id;
    if (!studentId) return next();
    const r = await pool.query(
      `SELECT 1 FROM students s WHERE s.id = $2::uuid AND ${VISIBLE}`,
      [req.account.id, studentId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Student not found" });
    next();
  } catch (err) { handleErr(res, "grades.assertOwnsStudent", err); }
};
router.post("/",     assertOwnsStudent);
router.patch("/:id", assertOwnsStudent);

// `category` in, `label` stored.
router.use("/", (req, _res, next) => {
  if (req.body && "category" in req.body) {
    req.body.label = req.body.category;
    delete req.body.category;
  }
  next();
});

router.use("/", crudRouter({
  table: "student_grades",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "recorded_on DESC, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/grades",
  teacherScoped: true,
  listExtra: async (req) => {
    const clauses = [];
    const params = [];
    if (req.query.student_id) { params.push(req.query.student_id); clauses.push(`student_id = $${params.length}`); }
    if (req.query.subject)    { params.push(req.query.subject);    clauses.push(`subject = $${params.length}`); }
    if (req.query.term)       { params.push(req.query.term);       clauses.push(`term = $${params.length}`); }
    if (clauses.length === 0) return null;
    return { where: clauses.join(" AND "), params };
  },
}));

export default router;
