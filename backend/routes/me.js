import { Router } from "express";
import { pool } from "../lib/db.js";
import { buildPatch, handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher, setCurrentTeacher } from "../lib/currentTeacher.js";
import { ProfilePatchSchema, validateBody } from "../lib/validate.js";
import { invalidateAccountById } from "../lib/auth.js";

const ME_SELECT = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                   languages, sections, class_map, grade_sections,
                   nationality, hire_date, bio, tour_planner_seen_at,
                   created_at, updated_at`;

const ME_FIELDS = [
  "first_name", "last_name", "email", "phone", "staff_id",
  "majors", "grade_levels", "languages", "sections",
  "class_map", "grade_sections",
  "nationality", "hire_date", "bio",
];

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found in DB" });
    const r = await pool.query(`SELECT ${ME_SELECT} FROM accounts WHERE id = $1`, [cur.id]);
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "GET /api/me", err);
  }
});

router.patch("/", validateBody(ProfilePatchSchema), async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found in DB" });

    // class_map + grade_sections are jsonb — node-postgres turns a
    // JS array/object into a Postgres ARRAY literal which jsonb
    // rejects ("invalid input syntax for type json"), so stringify
    // them. majors/grade_levels/languages/sections are TEXT[] and
    // must stay as arrays, so they are left untouched.
    const body = { ...(req.body || {}) };
    for (const k of ["class_map", "grade_sections"]) {
      if (
        Object.prototype.hasOwnProperty.call(body, k) &&
        body[k] !== null &&
        typeof body[k] !== "string"
      ) {
        body[k] = JSON.stringify(body[k]);
      }
    }

    const { sets, params } = buildPatch(body, ME_FIELDS);
    if (sets.length === 0) {
      const r = await pool.query(`SELECT ${ME_SELECT} FROM accounts WHERE id = $1`, [cur.id]);
      return res.json(r.rows[0]);
    }
    params.push(cur.id);
    const upd = await pool.query(
      `UPDATE accounts SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${params.length}
        RETURNING ${ME_SELECT}`,
      params
    );
    // requireAuth() serves this row from cache; a profile edit must be
    // visible on the very next request, not one TTL later.
    await invalidateAccountById(cur.id);
    setCurrentTeacher({ id: upd.rows[0].id, grade_levels: upd.rows[0].grade_levels || [] });
    res.json(upd.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/me", err);
  }
});

// POST /api/me/tour-seen — the teacher finished or skipped the Planner tour.
//
// Its own route, not a field on the profile PATCH. This is an event, not
// something the teacher edits, and COALESCE makes it write-once: the first
// call stamps it and every later call is a no-op, so a replayed request cannot
// move the date and nothing can un-see it.
router.post("/tour-seen", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const r = await pool.query(
      `UPDATE accounts
          SET tour_planner_seen_at = COALESCE(tour_planner_seen_at, NOW()),
              updated_at = NOW()
        WHERE id = $1
        RETURNING tour_planner_seen_at`,
      [cur.id]
    );
    // requireAuth() serves the account row from cache; without this the next
    // request would still report the tour as unseen.
    await invalidateAccountById(cur.id);
    res.json({ tour_planner_seen_at: r.rows[0]?.tour_planner_seen_at || null });
  } catch (err) {
    handleErr(res, "POST /api/me/tour-seen", err);
  }
});

export default router;
