// =====================================================================
// /api/me — the signed-in teacher's own profile
//
// Reads and writes span three tables now (users, faculty, subscriptions)
// but the wire shape is unchanged, because the studio's profile form and
// the onboarding flow are both written against it. lib/teacher.js owns
// the mapping; this file owns what a teacher is allowed to change.
// =====================================================================
import { Router } from "express";
import { handleErr } from "../lib/helpers.js";
import { findTeacherById, updateTeacher } from "../lib/teacher.js";
import { ProfilePatchSchema, validateBody } from "../lib/validate.js";

const router = Router();

// What goes over the wire. Deliberately not the whole row: the session
// id, the login IP and the Stripe ids are all on the assembled teacher
// and none of them are the profile.
const publicShape = (t) => ({
  id: t.id,
  user_id: t.user_id,
  faculty_code: t.faculty_code,
  first_name: t.first_name,
  last_name: t.last_name,
  full_name: t.full_name,
  email: t.email,
  phone: t.phone,
  avatar_url: t.avatar_url,
  staff_id: t.staff_id,
  majors: t.majors || [],
  grade_levels: t.grade_levels || [],
  languages: t.languages || [],
  qualification: t.qualification || [],
  nationality: t.nationality,
  bio: t.bio,
  years_experience: t.years_experience,
  hire_date: t.hire_date,
  organization: t.organization,
  school_id: t.school_id,
  role: t.role,
  onboarding_status: t.onboarding_status,
  subscription_plan: t.subscription_plan,
  subscription_status: t.subscription_status,
  subscription_ends_at: t.subscription_ends_at,
  created_at: t.created_at,
  updated_at: t.updated_at,
});

router.get("/", async (req, res) => {
  try {
    if (!req.account) return res.status(404).json({ error: "Current teacher not found in DB" });
    res.json(publicShape(req.account));
  } catch (err) {
    handleErr(res, "GET /api/me", err);
  }
});

router.patch("/", validateBody(ProfilePatchSchema), async (req, res) => {
  try {
    if (!req.account) return res.status(404).json({ error: "Current teacher not found in DB" });

    const body = { ...(req.body || {}) };
    // Not a teacher's to set about themselves, whatever the client sends.
    for (const k of ["role", "sub_role", "status", "subscription_plan", "subscription_status", "id", "user_id"]) {
      delete body[k];
    }

    // class_map / grade_sections were jsonb blobs on the old accounts
    // row. Classes are their own table now, so the blobs have no column
    // to go to — dropped here rather than silently 500ing on an UPDATE
    // naming a field that does not exist.
    delete body.class_map;
    delete body.grade_sections;
    delete body.sections;

    const updated = await updateTeacher(req.account, body);
    res.json(publicShape(updated || req.account));
  } catch (err) {
    handleErr(res, "PATCH /api/me", err);
  }
});

// The teacher marks their own onboarding finished. Separate from PATCH
// because it is a state transition, not a field edit, and the client
// should not be able to set it back to 'pending' by sending a form.
router.post("/onboarding-complete", async (req, res) => {
  try {
    if (!req.account) return res.status(404).json({ error: "Current teacher not found in DB" });
    const { pool } = await import("../lib/db.js");
    await pool.query(
      `UPDATE users SET onboarding_status = 'complete', updated_at = now() WHERE id = $1`,
      [req.account.user_id]
    );
    res.json(publicShape(await findTeacherById(req.account.id)));
  } catch (err) {
    handleErr(res, "POST /api/me/onboarding-complete", err);
  }
});

export default router;
