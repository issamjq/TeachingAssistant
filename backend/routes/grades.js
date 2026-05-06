import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";

const FIELDS = ["student_id", "subject", "term", "category", "score", "max_score", "notes"];
const SELECT = "id, student_id, subject, term, category, score, max_score, notes, recorded_at";

const router = crudRouter({
  table: "student_grades",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "recorded_at DESC, id DESC",
  timestampOnPatch: null, // recorded_at stays at insert time
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
});

// GET /api/grades/summary — per-student average across all subjects.
router.get("/summary", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    const r = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.grade, s.section,
              COUNT(g.id)::int AS entries,
              COALESCE(ROUND(AVG(g.score / NULLIF(g.max_score, 0) * 100)::numeric, 1), 0) AS average_pct
         FROM students s
         LEFT JOIN student_grades g ON g.student_id = s.id AND g.teacher_id = $1
        WHERE s.teacher_id = $1
        GROUP BY s.id
        ORDER BY s.grade, s.section, s.last_name`,
      [cur.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/grades/summary", err);
  }
});

export default router;
