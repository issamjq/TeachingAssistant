import "dotenv/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import pg from "pg";
import { CURRENT_TEACHER_STAFF_ID } from "./src/lib/currentUser.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const json = (res, data, status = 200) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

// Build "SET col1=$1, col2=$2" + params from a body object, only including
// fields that are present in `allowed`. Empty strings become NULL so the DB
// stays clean (an empty <input> shouldn't write "" to a TEXT column).
const buildPatch = (body, allowed) => {
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

// Pull the trailing /:id off the URL the middleware sees. Mount path is
// already stripped, so /api/teachers/42?x=1 → "/42?x=1" and we want 42.
const idFromUrl = (url) => {
  const m = url.match(/^\/(\d+)(\?|$)/);
  return m ? Number(m[1]) : null;
};

const handleErr = (res, route, err) => {
  console.error(`[${route}]`, err);
  // CHECK-constraint violations get a friendly 400 so the UI can render the
  // server message instead of "HTTP 500".
  const status = err.code === "23514" || err.code === "23505" ? 400 : 500;
  json(res, { error: err.message }, status);
};

// Cache the current teacher's numeric PK + grade_levels. Resolved once via
// staff_id, then keyed by id forever — that way the user can rename their
// own staff_id from the Profile edit modal without locking themselves out of
// /api/me. The cache is also the source of truth for /api/students?teacher=me,
// so a Profile-edit that changes grade_levels takes effect immediately
// (no server restart needed).
let _currentTeacher = null;
const loadCurrentTeacher = async () => {
  if (_currentTeacher) return _currentTeacher;
  const r = await pool.query(
    "SELECT id, grade_levels FROM teachers WHERE staff_id = $1",
    [CURRENT_TEACHER_STAFF_ID]
  );
  if (r.rows.length === 0) return null;
  _currentTeacher = { id: r.rows[0].id, grade_levels: r.rows[0].grade_levels || [] };
  return _currentTeacher;
};

// --- /api/me ---------------------------------------------------------------
const ME_SELECT = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                   nationality, hire_date, bio, created_at, updated_at`;

const meHandler = async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    if (!cur) return json(res, { error: "Current teacher not found in DB" }, 404);

    if (req.method === "PATCH") {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, [
        "first_name", "last_name", "email", "phone", "staff_id",
        "majors", "grade_levels", "nationality", "hire_date", "bio",
      ]);
      if (sets.length === 0) {
        const r = await pool.query(`SELECT ${ME_SELECT} FROM teachers WHERE id = $1`, [cur.id]);
        return json(res, r.rows[0]);
      }
      params.push(cur.id);
      const upd = await pool.query(
        `UPDATE teachers SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id = $${params.length}
          RETURNING ${ME_SELECT}`,
        params
      );
      // Refresh the cache so subsequent reads + the students filter see the
      // updated grade_levels (and the new staff_id, though we don't use it).
      _currentTeacher = { id: upd.rows[0].id, grade_levels: upd.rows[0].grade_levels || [] };
      return json(res, upd.rows[0]);
    }

    const r = await pool.query(`SELECT ${ME_SELECT} FROM teachers WHERE id = $1`, [cur.id]);
    json(res, r.rows[0]);
  } catch (err) {
    handleErr(res, "/api/me", err);
  }
};

// --- /api/templates --------------------------------------------------------
const TEMPLATE_FIELDS = ["name", "subject", "duration", "grade", "flow", "tags", "used_count", "starred"];
const TEMPLATE_SELECT =
  "id, name, subject, duration, grade, flow, tags, used_count, starred, updated_at";

const templatesHandler = async (req, res) => {
  try {
    const id = idFromUrl(req.url);

    if (req.method === "GET" && id == null) {
      const result = await pool.query(
        `SELECT ${TEMPLATE_SELECT} FROM templates ORDER BY used_count DESC NULLS LAST, id`
      );
      return json(res, result.rows);
    }
    if (req.method === "POST" && id == null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, TEMPLATE_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      const cols = TEMPLATE_FIELDS.filter((k) =>
        Object.prototype.hasOwnProperty.call(body, k)
      );
      const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO templates (${cols.join(", ")}) VALUES (${placeholders})
         RETURNING ${TEMPLATE_SELECT}`,
        params
      );
      return json(res, result.rows[0], 201);
    }
    if (req.method === "PATCH" && id != null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, TEMPLATE_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      params.push(id);
      const result = await pool.query(
        `UPDATE templates SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id = $${params.length}
          RETURNING ${TEMPLATE_SELECT}`,
        params
      );
      if (result.rows.length === 0) return json(res, { error: "Not found" }, 404);
      return json(res, result.rows[0]);
    }
    if (req.method === "DELETE" && id != null) {
      const result = await pool.query("DELETE FROM templates WHERE id = $1", [id]);
      if (result.rowCount === 0) return json(res, { error: "Not found" }, 404);
      return json(res, { ok: true });
    }
    json(res, { error: "Method not allowed" }, 405);
  } catch (err) {
    handleErr(res, "/api/templates", err);
  }
};

// --- /api/drafts -----------------------------------------------------------
const DRAFT_FIELDS = ["name", "note", "warning", "subject", "status", "progress"];
const DRAFT_SELECT =
  "id, name, note, warning, subject, status, progress, last_edited";

const draftsHandler = async (req, res) => {
  try {
    const id = idFromUrl(req.url);

    if (req.method === "GET" && id == null) {
      const result = await pool.query(
        `SELECT ${DRAFT_SELECT} FROM drafts ORDER BY last_edited DESC NULLS LAST, id`
      );
      return json(res, result.rows);
    }
    if (req.method === "POST" && id == null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, DRAFT_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      const cols = DRAFT_FIELDS.filter((k) =>
        Object.prototype.hasOwnProperty.call(body, k)
      );
      const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO drafts (${cols.join(", ")}) VALUES (${placeholders})
         RETURNING ${DRAFT_SELECT}`,
        params
      );
      return json(res, result.rows[0], 201);
    }
    if (req.method === "PATCH" && id != null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, DRAFT_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      params.push(id);
      const result = await pool.query(
        `UPDATE drafts SET ${sets.join(", ")}, last_edited = NOW()
          WHERE id = $${params.length}
          RETURNING ${DRAFT_SELECT}`,
        params
      );
      if (result.rows.length === 0) return json(res, { error: "Not found" }, 404);
      return json(res, result.rows[0]);
    }
    if (req.method === "DELETE" && id != null) {
      const result = await pool.query("DELETE FROM drafts WHERE id = $1", [id]);
      if (result.rowCount === 0) return json(res, { error: "Not found" }, 404);
      return json(res, { ok: true });
    }
    json(res, { error: "Method not allowed" }, 405);
  } catch (err) {
    handleErr(res, "/api/drafts", err);
  }
};

// --- /api/teachers ---------------------------------------------------------
const TEACHER_FIELDS = [
  "first_name", "last_name", "email", "phone", "staff_id",
  "majors", "grade_levels", "nationality", "hire_date", "bio",
];
const TEACHER_SELECT =
  `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
   nationality, hire_date, bio, created_at, updated_at`;

const teachersHandler = async (req, res) => {
  try {
    const id = idFromUrl(req.url);

    if (req.method === "GET" && id == null) {
      const result = await pool.query(
        `SELECT ${TEACHER_SELECT} FROM teachers ORDER BY last_name, first_name`
      );
      return json(res, result.rows);
    }
    if (req.method === "POST" && id == null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, TEACHER_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      const cols = TEACHER_FIELDS.filter((k) =>
        Object.prototype.hasOwnProperty.call(body, k)
      );
      const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO teachers (${cols.join(", ")}) VALUES (${placeholders})
         RETURNING ${TEACHER_SELECT}`,
        params
      );
      return json(res, result.rows[0], 201);
    }
    if (req.method === "PATCH" && id != null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, TEACHER_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      params.push(id);
      const result = await pool.query(
        `UPDATE teachers SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id = $${params.length}
          RETURNING ${TEACHER_SELECT}`,
        params
      );
      if (result.rows.length === 0) return json(res, { error: "Not found" }, 404);
      return json(res, result.rows[0]);
    }
    if (req.method === "DELETE" && id != null) {
      const result = await pool.query("DELETE FROM teachers WHERE id = $1", [id]);
      if (result.rowCount === 0) return json(res, { error: "Not found" }, 404);
      return json(res, { ok: true });
    }
    json(res, { error: "Method not allowed" }, 405);
  } catch (err) {
    handleErr(res, "/api/teachers", err);
  }
};

// --- /api/students ---------------------------------------------------------
const STUDENT_FIELDS = [
  "first_name", "last_name", "student_id", "date_of_birth", "gender",
  "grade", "section", "email", "phone", "nationality", "address",
  "primary_guardian_name", "primary_guardian_relationship",
  "primary_guardian_email", "primary_guardian_phone",
  "secondary_guardian_name", "secondary_guardian_relationship",
  "secondary_guardian_email", "secondary_guardian_phone",
  "enrollment_date", "notes",
];
const STUDENT_SELECT = `id, first_name, last_name, student_id, date_of_birth, gender,
  grade, section, email, phone, nationality, address,
  primary_guardian_name, primary_guardian_relationship,
  primary_guardian_email, primary_guardian_phone,
  secondary_guardian_name, secondary_guardian_relationship,
  secondary_guardian_email, secondary_guardian_phone,
  enrollment_date, notes, created_at, updated_at`;

// Reads the cached current teacher (resolved + refreshed in meHandler) so
// /api/students?teacher=me always reflects the latest grade_levels.
const teacherGrades = async () => {
  const cur = await loadCurrentTeacher();
  return cur?.grade_levels || [];
};

const studentsHandler = async (req, res) => {
  try {
    const id = idFromUrl(req.url);
    const url = new URL(req.url, "http://x");

    if (req.method === "GET" && id == null) {
      const teacher = url.searchParams.get("teacher");
      let where = "";
      const params = [];
      if (teacher === "me") {
        const grades = await teacherGrades();
        if (grades.length === 0) {
          return json(res, []);
        }
        params.push(grades);
        where = `WHERE grade = ANY($1)`;
      }
      const result = await pool.query(
        `SELECT ${STUDENT_SELECT} FROM students ${where}
          ORDER BY grade, section, last_name, first_name`,
        params
      );
      return json(res, result.rows);
    }
    if (req.method === "POST" && id == null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, STUDENT_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      const cols = STUDENT_FIELDS.filter((k) =>
        Object.prototype.hasOwnProperty.call(body, k)
      );
      const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO students (${cols.join(", ")}) VALUES (${placeholders})
         RETURNING ${STUDENT_SELECT}`,
        params
      );
      return json(res, result.rows[0], 201);
    }
    if (req.method === "PATCH" && id != null) {
      const body = await readBody(req);
      const { sets, params } = buildPatch(body, STUDENT_FIELDS);
      if (sets.length === 0) return json(res, { error: "No fields" }, 400);
      params.push(id);
      const result = await pool.query(
        `UPDATE students SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id = $${params.length}
          RETURNING ${STUDENT_SELECT}`,
        params
      );
      if (result.rows.length === 0) return json(res, { error: "Not found" }, 404);
      return json(res, result.rows[0]);
    }
    if (req.method === "DELETE" && id != null) {
      const result = await pool.query("DELETE FROM students WHERE id = $1", [id]);
      if (result.rowCount === 0) return json(res, { error: "Not found" }, 404);
      return json(res, { ok: true });
    }
    json(res, { error: "Method not allowed" }, 405);
  } catch (err) {
    handleErr(res, "/api/students", err);
  }
};

const apiPlugin = {
  name: "mudir-api",
  configureServer(server) {
    server.middlewares.use("/api/me", meHandler);
    server.middlewares.use("/api/templates", templatesHandler);
    server.middlewares.use("/api/drafts", draftsHandler);
    server.middlewares.use("/api/teachers", teachersHandler);
    server.middlewares.use("/api/students", studentsHandler);
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
