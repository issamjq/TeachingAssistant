// Single source of truth for "who is the logged-in teacher" while there's no
// auth layer. Imported by vite.config.js to scope /api/me + /api/students.
//
// When real auth lands, replace this with a session lookup (cookie / JWT /
// whatever) on the server side. Keep the same shape so the views don't change.
export const CURRENT_TEACHER_STAFF_ID = "STF-001";
