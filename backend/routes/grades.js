import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";

const FIELDS = ["student_id", "subject", "term", "category", "score", "max_score", "notes"];
const SELECT = "id, student_id, subject, term, category, score, max_score, notes, recorded_at";

// /summary must be registered BEFORE the crud helper's /:id route, otherwise
// Express matches /:id with id="summary" and Postgres fails to parse it.
const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const r = await pool.query(
      `WITH entries AS (
         SELECT student_id, score::numeric AS score, max_score::numeric AS max_score
           FROM student_grades
          WHERE account_id = $1 AND score IS NOT NULL AND max_score IS NOT NULL
         UNION ALL
         SELECT qs.student_id, qs.score, qs.max_score
           FROM quiz_scores qs
           JOIN quizzes q ON q.id = qs.quiz_id
          WHERE q.account_id = $1 AND qs.score IS NOT NULL AND qs.max_score IS NOT NULL
         UNION ALL
         SELECT hs.student_id, hs.score, hs.max_score
           FROM homework_submissions hs
           JOIN homework h ON h.id = hs.homework_id
          WHERE h.account_id = $1 AND hs.score IS NOT NULL AND hs.max_score IS NOT NULL
       )
       SELECT s.id AS student_id, s.first_name, s.last_name, s.grade, s.section,
              COUNT(e.*)::int AS entries,
              COALESCE(ROUND(AVG(e.score / NULLIF(e.max_score, 0) * 100)::numeric, 1), 0) AS average_pct
         FROM students s
         LEFT JOIN entries e ON e.student_id = s.id
        WHERE s.account_id = $1
        GROUP BY s.id
        ORDER BY s.grade, s.section, s.last_name`,
      [cur.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/grades/summary", err);
  }
});

// SECURITY: student_grades POST/PATCH accept a student_id from the body.
// The crud helper stamps account_id from the current teacher, but does
// NOT verify the student belongs to that teacher. Without this guard,
// a teacher could attach a grade row to a foreign student. We mount
// the guard BEFORE the crud subrouter so Express runs it first.
const assertOwnsStudentIfPresent = async (req, res, next) => {
  try {
    const studentId = (req.body || {}).student_id;
    if (!studentId) return next();
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(401).json({ error: "Not authenticated" });
    const r = await pool.query(
      "SELECT 1 FROM students WHERE id = $1 AND account_id = $2",
      [studentId, cur.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Student not found" });
    next();
  } catch (err) {
    handleErr(res, "grades.assertOwnsStudentIfPresent", err);
  }
};
router.post("/",     assertOwnsStudentIfPresent);
router.patch("/:id", assertOwnsStudentIfPresent);

router.use("/", crudRouter({
  table: "student_grades",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "recorded_at DESC, id DESC",
  timestampOnPatch: null,
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
