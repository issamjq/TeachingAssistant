import { crudRouter } from "../lib/crud.js";

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
});
