// Single source of truth for "who is the logged-in teacher" in the
// pre-auth code paths that still reference a fixed staff id.
//
// Real auth (Firebase token → accounts row) is live; this constant only
// survives in seed data and dev fixtures. Remove it once nothing imports it.
export const CURRENT_TEACHER_STAFF_ID = "STF-001";
