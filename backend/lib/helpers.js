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

// Sanitised client-facing messages for each known Postgres error class.
// We deliberately do NOT pass Postgres's raw message to the client in
// production — its text often quotes table/column names or violated
// constraint identifiers, which are useful to an attacker mapping the
// schema. Dev mode still returns the verbose message so the planner
// surfaces real problems.
const PG_PUBLIC_MSG = {
  "22P02": "Invalid value for one of the fields.",
  "23502": "A required field is missing.",
  "23503": "Referenced record does not exist.",
  "23505": "That record already exists.",
  "23514": "One of the values is not allowed.",
};

const isProd = () => process.env.NODE_ENV === "production";

// Generate a short correlation id so a 500 response can be traced back
// to the exact server-side log line without leaking the real error.
const cid = () => Math.random().toString(36).slice(2, 10);

export const handleErr = (res, route, err) => {
  const id = cid();
  // Server log always carries the full error (stack + message). Use a
  // structured prefix so log scrapers can extract route + error id.
  console.error(`[${route}] [errId=${id}]`, err);

  const isClient = CLIENT_ERR_CODES.includes(err.code);
  const status = isClient ? 400 : 500;

  // Client payload: generic message in prod, verbose in dev.
  const message = isProd()
    ? (isClient ? (PG_PUBLIC_MSG[err.code] || "Invalid request.") : "Something went wrong on our side.")
    : (err.message || "unknown");

  res.status(status).json({ error: message, errorId: id });
};
