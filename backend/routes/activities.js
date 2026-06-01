import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";

const FIELDS = [
  "draft_id", "title", "type", "subject", "grade",
  "duration_minutes", "instructions", "materials", "scheduled_for",
];
const SELECT = `id, draft_id, title, type, subject, grade,
                duration_minutes, instructions, materials, scheduled_for,
                created_at, updated_at`;

const router = crudRouter({
  table: "activities",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "updated_at DESC, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/activities",
  teacherScoped: true,
  softDelete: true,
  jsonFields: ["materials"],
});

const assertOwns = async (req, id) => {
  const cur = await loadCurrentTeacher(req);
  if (!cur) return false;
  const r = await pool.query(
    "SELECT id FROM activities WHERE id = $1 AND teacher_id = $2",
    [id, cur.id]
  );
  return r.rows.length > 0;
};

// Per-student completion tracker for one activity.
router.get("/:id/completions", async (req, res) => {
  try {
    if (!(await assertOwns(req, req.params.id))) {
      return res.status(404).json({ error: "Not found" });
    }
    const r = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
              ac.status, ac.notes, ac.recorded_at
         FROM students s
         LEFT JOIN activity_completions ac
                ON ac.student_id = s.id AND ac.activity_id = $1
        WHERE s.teacher_id = (SELECT teacher_id FROM activities WHERE id = $1)
        ORDER BY s.grade, s.section, s.last_name`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/activities/:id/completions", err);
  }
});

router.put("/:id/completions/:studentId", async (req, res) => {
  try {
    if (!(await assertOwns(req, req.params.id))) {
      return res.status(404).json({ error: "Not found" });
    }
    const cur = await loadCurrentTeacher(req);
    const own = await pool.query(
      "SELECT 1 FROM students WHERE id = $1 AND teacher_id = $2",
      [req.params.studentId, cur.id]
    );
    if (own.rowCount === 0) return res.status(404).json({ error: "Student not found" });

    const { status, notes } = req.body || {};
    const r = await pool.query(
      `INSERT INTO activity_completions (activity_id, student_id, status, notes)
       VALUES ($1, $2, COALESCE($3, 'Pending'), $4)
       ON CONFLICT (activity_id, student_id) DO UPDATE
         SET status = EXCLUDED.status,
             notes = EXCLUDED.notes,
             recorded_at = NOW()
       RETURNING *`,
      [req.params.id, req.params.studentId, status ?? null, notes ?? null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/activities/:id/completions/:sid", err);
  }
});

export default router;
