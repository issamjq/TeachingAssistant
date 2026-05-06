import { pool } from "./db.js";
import { CURRENT_TEACHER_STAFF_ID } from "../../src/lib/currentUser.js";

// Cache the current teacher's numeric PK + grade_levels. Resolved once via
// staff_id, then keyed by id forever — that way the user can rename their
// own staff_id from the Profile edit modal without locking themselves out
// of /api/me. The cache is also the source of truth for /api/students?teacher=me,
// so a Profile-edit that changes grade_levels takes effect immediately
// (no server restart needed).
let _current = null;

export const loadCurrentTeacher = async () => {
  if (_current) return _current;
  const r = await pool.query(
    "SELECT id, grade_levels FROM teachers WHERE staff_id = $1",
    [CURRENT_TEACHER_STAFF_ID]
  );
  if (r.rows.length === 0) return null;
  _current = { id: r.rows[0].id, grade_levels: r.rows[0].grade_levels || [] };
  return _current;
};

export const setCurrentTeacher = (next) => {
  _current = next;
};
