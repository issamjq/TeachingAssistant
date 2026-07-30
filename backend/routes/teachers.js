import { crudRouter } from "../lib/crud.js";
import { invalidateAccountById } from "../lib/auth.js";

const FIELDS = [
  "first_name", "last_name", "email", "phone", "staff_id",
  "majors", "grade_levels", "nationality", "hire_date", "bio",
];
const SELECT = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                nationality, hire_date, bio, created_at, updated_at`;

export default crudRouter({
  table: "accounts",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "last_name, first_name",
  timestampOnPatch: "updated_at",
  routeName: "/api/teachers",
  // This router writes to `accounts`, the one table requireAuth() serves from
  // cache. Every mutation here has to evict, or an admin's edit is invisible
  // to the edited teacher's own session until the TTL lapses.
  afterMutation: (row) => invalidateAccountById(row?.id),
  beforeDelete: (id) => invalidateAccountById(id),
});
