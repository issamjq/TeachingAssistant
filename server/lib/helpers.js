// Build "SET col1=$1, col2=$2" + params from a body object, only including
// fields that are present in `allowed`. Empty strings become NULL so the DB
// stays clean (an empty <input> shouldn't write "" to a TEXT column).
export const buildPatch = (body, allowed) => {
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      let v = body[key];
      if (v === "") v = null;
      params.push(v);
      sets.push(`${key} = $${params.length}`);
    }
  }
  return { sets, params };
};

// Friendly status mapping for common Postgres errors.
//   23514 = check_violation     (CHECK constraint failed)
//   23505 = unique_violation    (duplicate UNIQUE)
//   23502 = not_null_violation
//   23503 = foreign_key_violation
//   22P02 = invalid_text_representation (e.g. /api/teachers/abc when id is INT)
// Everything else gets a generic 500.
const CLIENT_ERR_CODES = ["22P02", "23502", "23503", "23505", "23514"];

export const handleErr = (res, route, err) => {
  console.error(`[${route}]`, err);
  const status = CLIENT_ERR_CODES.includes(err.code) ? 400 : 500;
  res.status(status).json({ error: err.message });
};
