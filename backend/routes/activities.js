import { withTenant } from "../lib/db.js";
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

// Returns the teacher when they own the activity, null otherwise — the caller
// needs the id anyway to run its own queries under withTenant().
const assertOwns = async (req, id) => {
  const cur = await loadCurrentTeacher(req);
  if (!cur) return null;
  const r = await withTenant(cur.id, (db) => db.query(
    "SELECT id FROM activities WHERE id = $1 AND account_id = $2",
    [id, cur.id]
  ));
  return r.rows.length > 0 ? cur : null;
};

// Per-student completion tracker for one activity.
router.get("/:id/completions", async (req, res) => {
  try {
    const cur = await assertOwns(req, req.params.id);
    if (!cur) return res.status(404).json({ error: "Not found" });
    const r = await withTenant(cur.id, (db) => db.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
              ac.status, ac.notes, ac.recorded_at
         FROM students s
         LEFT JOIN activity_completions ac
                ON ac.student_id = s.id AND ac.activity_id = $1
        WHERE s.account_id = (SELECT account_id FROM activities WHERE id = $1)
        ORDER BY s.grade, s.section, s.last_name`,
      [req.params.id]
    ));
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/activities/:id/completions", err);
  }
});

router.put("/:id/completions/:studentId", async (req, res) => {
  try {
    const cur = await assertOwns(req, req.params.id);
    if (!cur) return res.status(404).json({ error: "Not found" });

    const { status, notes } = req.body || {};
    // Student ownership and the upsert share one transaction, so the student
    // can't change hands between the check and the write.
    const { own, r } = await withTenant(cur.id, async (db) => {
      const own = await db.query(
        "SELECT 1 FROM students WHERE id = $1 AND account_id = $2",
        [req.params.studentId, cur.id]
      );
      if (own.rowCount === 0) return { own, r: null };
      const r = await db.query(
        `INSERT INTO activity_completions (activity_id, student_id, status, notes)
         VALUES ($1, $2, COALESCE($3, 'Pending'), $4)
         ON CONFLICT (activity_id, student_id) DO UPDATE
           SET status = EXCLUDED.status,
               notes = EXCLUDED.notes,
               recorded_at = NOW()
         RETURNING *`,
        [req.params.id, req.params.studentId, status ?? null, notes ?? null]
      );
      return { own, r };
    });
    if (own.rowCount === 0) return res.status(404).json({ error: "Student not found" });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/activities/:id/completions/:sid", err);
  }
});

export default router;
