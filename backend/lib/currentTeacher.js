// Resolves the current teacher for a request.
//
// Before Firebase: this read a hardcoded STF-001 lookup.
// After Firebase: requireAuth() middleware verifies the Bearer token,
// loads the teacher by firebase_uid, and attaches it to req.teacher.
// This helper just normalises the shape the rest of the backend expects
// ({ id, grade_levels }) so call sites don't need to know whether it
// came from the middleware or anywhere else.
//
// Callers: every per-teacher route. Always pass `req`.

export const loadCurrentTeacher = async (req) => {
  if (!req || !req.teacher) return null;
  return {
    id: req.teacher.id,
    grade_levels: req.teacher.grade_levels || [],
  };
};

// Legacy no-op kept so the /api/me PATCH route's "remember the new
// grade_levels so /api/students?teacher=me sees them immediately"
// optimisation still compiles. The middleware now reads from req
// directly, so caching is unnecessary.
export const setCurrentTeacher = (_next) => {};
