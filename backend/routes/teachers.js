import { crudRouter } from "../lib/crud.js";
import { invalidateAccountById } from "../lib/auth.js";

const FIELDS = [
  "first_name", "last_name", "email", "phone", "staff_id",
  "majors", "grade_levels", "nationality", "hire_date", "bio",
];
const SELECT = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                nationality, hire_date, bio, created_at, updated_at`;

// READ-ONLY BY DESIGN (F45).
//
// This router lists and reads `accounts` for the admin surfaces. It must not
// write them. `admin.js` owns the account lifecycle and does three things this
// generic factory cannot: it refuses self-suspension and self-deletion, it
// enforces canGrantRole() so an admin cannot touch a dev or super_admin, and it
// writes an audit_log row for every change.
//
// Mounting the factory with its write verbs published a second, unguarded path
// to the same operations — a hard DELETE /api/teachers/:id left no trace, had no
// self-delete guard, and cascade-deletes 15 tables while setting the account's
// audit_log rows to NULL, destroying the attribution too. Nothing in the
// frontend used it (AdminConsole calls /api/admin/teachers), so this closes a
// latent gap rather than changing behaviour.
//
// Account writes go to: POST/PATCH/DELETE /api/admin/teachers[/:id].
export default crudRouter({
  table: "accounts",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "last_name, first_name",
  timestampOnPatch: "updated_at",
  routeName: "/api/teachers",
  readOnly: true,
  // Kept wired even though no write route is registered: if this router is ever
  // given write verbs again, `accounts` is the one table requireAuth() serves
  // from cache, and a mutation that doesn't evict is invisible to the edited
  // teacher's own session until the TTL lapses.
  afterMutation: (row) => invalidateAccountById(row?.id),
  beforeDelete: (id) => invalidateAccountById(id),
});
