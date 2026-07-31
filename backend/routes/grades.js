import { Router } from "express";
import { withTenant } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";
import { validateBody, GradeSchema, GradePatchSchema, GradePublishSchema } from "../lib/validate.js";

// published_at is NOT in FIELDS on purpose. Publishing is what makes a grade
// visible to a student and their parents (roadmap days 15–16), so it is a
// deliberate action through its own endpoint — not a column a client can set,
// back-date, or flip by accident inside an ordinary PATCH.
const FIELDS = ["student_id", "subject", "term", "category", "score", "max_score", "notes"];
const SELECT = `id, student_id, subject, term, category, score, max_score, notes,
                recorded_at, updated_at, published_at`;

// /summary must be registered BEFORE the crud helper's /:id route, otherwise
// Express matches /:id with id="summary" and Postgres fails to parse it.
const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    // This query fans across four tenant tables (student_grades, quiz_scores,
    // homework_submissions, students) and every one of them is scoped by hand
    // below. Running it inside withTenant() puts RLS underneath that: if one
    // of these WHEREs is ever dropped, the aggregate loses rows instead of
    // silently averaging in another teacher's students.
    const r = await withTenant(cur.id, (db) => db.query(
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
    ));
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
    const r = await withTenant(cur.id, (db) => db.query(
      "SELECT 1 FROM students WHERE id = $1 AND account_id = $2",
      [studentId, cur.id]
    ));
    if (r.rowCount === 0) return res.status(404).json({ error: "Student not found" });
    next();
  } catch (err) {
    handleErr(res, "grades.assertOwnsStudentIfPresent", err);
  }
};
router.post("/",     assertOwnsStudentIfPresent);
router.patch("/:id", assertOwnsStudentIfPresent);

// POST /api/grades/publish — { ids: [...], published: true|false }
//
// Registered before the crud subrouter so Express doesn't match "publish" as
// an :id. Bulk because the real flow is "enter thirty marks, then release the
// term" — one request instead of thirty, and one moment the parents see.
//
// Scoping is belt and braces: the UPDATE carries `account_id = $2` AND runs
// inside withTenant(), so RLS is underneath it. A caller passing another
// teacher's grade ids gets zero rows updated, not an error and not a leak —
// and the response says how many actually changed, so the client can tell.
router.post("/publish", validateBody(GradePublishSchema), async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const { ids, published } = req.body;
    const r = await withTenant(cur.id, (db) => db.query(
      `UPDATE student_grades
          SET published_at = ${published ? "NOW()" : "NULL"}, updated_at = NOW()
        WHERE id = ANY($1::int[]) AND account_id = $2
        RETURNING id, published_at`,
      [ids, cur.id]
    ));
    res.json({ updated: r.rowCount, requested: ids.length, rows: r.rows });
  } catch (err) {
    handleErr(res, "POST /api/grades/publish", err);
  }
});

router.use("/", crudRouter({
  table: "student_grades",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "recorded_at DESC, id DESC",
  // A grade that gets corrected must say so. Before this column existed the
  // edit was invisible, which is untenable once a parent can see the mark.
  timestampOnPatch: "updated_at",
  bodySchema: GradeSchema,
  patchSchema: GradePatchSchema,
  routeName: "/api/grades",
  teacherScoped: true,
  listExtra: async (req) => {
    const clauses = [];
    const params = [];
    if (req.query.student_id) { params.push(req.query.student_id); clauses.push(`student_id = $${params.length}`); }
    if (req.query.subject)    { params.push(req.query.subject);    clauses.push(`subject = $${params.length}`); }
    if (req.query.term)       { params.push(req.query.term);       clauses.push(`term = $${params.length}`); }
    // ?published=true|false — lets the teacher see at a glance what has been
    // released and what is still a draft.
    if (req.query.published === "true")  clauses.push("published_at IS NOT NULL");
    if (req.query.published === "false") clauses.push("published_at IS NULL");
    if (clauses.length === 0) return null;
    return { where: clauses.join(" AND "), params };
  },
}));

export default router;
