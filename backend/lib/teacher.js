// =====================================================================
// The teacher, assembled from the three tables that now hold them
//
// What used to be one `accounts` row is now spread across three:
//
//   users          identity, mirrored from auth.users by a trigger
//   faculty        the teaching profile — subjects, grades, staff id
//   subscriptions  the commercial state
//
// That split is right: a student and a teacher are both users, and only
// one of them has expertise. But 26 route files were written against a
// single flat row, and rewriting all of them to join three tables by
// hand would mean 26 chances to get the join wrong.
//
// So the join lives here, once, and hands back the flat shape the rest
// of the backend already speaks. `id` is the FACULTY id, because that is
// what every teacher-owned table references; `user_id` is the identity.
// Getting those two the wrong way round is the mistake this module
// exists to make impossible.
// =====================================================================
import { pool } from "./db.js";

/**
 * The legacy `accounts` shape, selected out of users + faculty +
 * subscriptions. Column aliases are the mapping — read this as the
 * translation table it is.
 */
const TEACHER_SELECT = `
  f.id                       AS id,
  u.id                       AS user_id,
  u.id                       AS auth_uid,
  u.first_name,
  u.last_name,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
    u.full_name
  )                          AS full_name,
  u.email,
  u.phone,
  u.avatar_url,
  u.locale,
  u.role,
  u.sub_role,
  u.account_status           AS status,
  u.onboarding_status,
  u.signup_provider,
  u.last_login_at,
  u.last_login_ip,
  u.active_session_id,
  f.faculty_code,
  f.staff_id,
  f.expertise                AS majors,
  f.eligible_grades          AS grade_levels,
  f.languages,
  f.qualification,
  f.nationality,
  f.bio,
  f.years_experience,
  f.hire_date,
  f.organization,
  f.school_id,
  f.approved_at,
  s.plan                     AS subscription_plan,
  s.status                   AS subscription_status,
  COALESCE(s.current_period_end, s.trial_ends_at) AS subscription_ends_at,
  f.created_at,
  f.updated_at
`;

const FROM_TEACHER = `
  FROM faculty f
  JOIN users u ON u.id = f.user_id
  LEFT JOIN subscriptions s ON s.faculty_id = f.id
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The teacher behind a Supabase user id, or null. */
export async function findTeacherByUid(uid) {
  if (!uid || !UUID_RE.test(uid)) return null;
  const r = await pool.query(
    `SELECT ${TEACHER_SELECT} ${FROM_TEACHER} WHERE u.id = $1 LIMIT 1`,
    [uid]
  );
  return r.rows[0] || null;
}

/** The teacher behind a faculty id, or null. */
export async function findTeacherById(facultyId) {
  if (!facultyId || !UUID_RE.test(facultyId)) return null;
  const r = await pool.query(
    `SELECT ${TEACHER_SELECT} ${FROM_TEACHER} WHERE f.id = $1 LIMIT 1`,
    [facultyId]
  );
  return r.rows[0] || null;
}

/**
 * Make sure a signed-in user has the rows a teacher needs, and return
 * them assembled.
 *
 * Three things can be missing independently, so each is created on its
 * own rather than as one all-or-nothing block:
 *
 *   users         normally the auth trigger's job, but that trigger
 *                 swallows its own errors by design, so this cannot
 *                 assume it ran
 *   faculty       created the first time a teacher signs in
 *   subscriptions the trial, started when the faculty row is
 *
 * All three are ON CONFLICT DO NOTHING, so two tabs racing the first
 * sign-in produce one teacher rather than a duplicate-key error shown
 * to whoever lost.
 */
export async function ensureTeacher(authUser, { trialDays = 14 } = {}) {
  const uid = authUser?.uid;
  if (!uid || !UUID_RE.test(uid)) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, email, full_name, first_name, last_name, avatar_url, signup_provider, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'teacher')
       ON CONFLICT (id) DO NOTHING`,
      [
        uid,
        authUser.email || null,
        authUser.name || null,
        authUser.firstName || null,
        authUser.lastName || null,
        authUser.picture || null,
        authUser.provider || null,
      ]
    );

    // A user who signed up before this ran may have no role. Only fill a
    // NULL — never overwrite, or signing in would demote an admin to a
    // teacher on every request.
    await client.query(
      `UPDATE users SET role = 'teacher' WHERE id = $1 AND role IS NULL`,
      [uid]
    );

    const fac = await client.query(
      `INSERT INTO faculty (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING id`,
      [uid]
    );
    const facultyId = fac.rows[0].id;

    await client.query(
      `INSERT INTO subscriptions (faculty_id, plan, status, trial_ends_at)
       SELECT $1, 'trial', 'trialing', now() + ($2 || ' days')::interval
       WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE faculty_id = $1)`,
      [facultyId, String(trialDays)]
    );

    await client.query("COMMIT");
    return findTeacherById(facultyId);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Apply a flat patch by sending each field to the table that owns it.
 *
 * Callers keep speaking the flat shape; this decides where each column
 * lives. A field named here that the caller did not send is left alone —
 * `undefined` means "not mentioned", which is not the same as null.
 */
const USER_FIELDS = {
  first_name: "first_name", last_name: "last_name", email: "email",
  phone: "phone", avatar_url: "avatar_url", locale: "locale",
};
const FACULTY_FIELDS = {
  staff_id: "staff_id", nationality: "nationality", bio: "bio",
  hire_date: "hire_date", organization: "organization", school_id: "school_id",
  years_experience: "years_experience", qualification: "qualification",
  languages: "languages",
  // The renames. These are why a caller must not write to faculty directly.
  majors: "expertise", grade_levels: "eligible_grades",
};

export async function updateTeacher(teacher, patch = {}) {
  const run = async (table, map, key, id) => {
    const sets = [];
    const params = [];
    for (const [from, to] of Object.entries(map)) {
      if (patch[from] === undefined) continue;
      params.push(patch[from]);
      sets.push(`${to} = $${params.length}`);
    }
    if (!sets.length) return;
    params.push(id);
    await pool.query(
      `UPDATE ${table} SET ${sets.join(", ")}, updated_at = now() WHERE ${key} = $${params.length}`,
      params
    );
  };
  await run("users", USER_FIELDS, "id", teacher.user_id);
  await run("faculty", FACULTY_FIELDS, "id", teacher.id);
  return findTeacherById(teacher.id);
}

export { TEACHER_SELECT, FROM_TEACHER };
