import { crudRouter } from "../lib/crud.js";

const FIELDS = [
  "first_name", "last_name", "student_id", "date_of_birth", "gender",
  "grade", "section", "email", "phone", "nationality", "address",
  "primary_guardian_name", "primary_guardian_relationship",
  "primary_guardian_email", "primary_guardian_phone",
  "secondary_guardian_name", "secondary_guardian_relationship",
  "secondary_guardian_email", "secondary_guardian_phone",
  "enrollment_date", "notes",
];

const SELECT = `id, first_name, last_name, student_id, date_of_birth, gender,
  grade, section, email, phone, nationality, address,
  primary_guardian_name, primary_guardian_relationship,
  primary_guardian_email, primary_guardian_phone,
  secondary_guardian_name, secondary_guardian_relationship,
  secondary_guardian_email, secondary_guardian_phone,
  enrollment_date, notes, created_at, updated_at`;

// Students belong to the teacher who created them. teacherScoped takes care
// of all four endpoints (list / get / create / update / delete). The legacy
// `?teacher=me` query parameter is now a no-op and intentionally ignored —
// every list call already returns only the current teacher's students.
export default crudRouter({
  table: "students",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "grade, section, last_name, first_name",
  timestampOnPatch: "updated_at",
  routeName: "/api/students",
  teacherScoped: true,
});
