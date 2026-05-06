import { crudRouter } from "../lib/crud.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

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

export default crudRouter({
  table: "students",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "grade, section, last_name, first_name",
  timestampOnPatch: "updated_at",
  routeName: "/api/students",
  // Scope the list to the current teacher's grades when ?teacher=me.
  // `skip: true` short-circuits to an empty array when the teacher has no
  // grades set (the crud helper returns [] without running a query).
  listExtra: async (req) => {
    if (req.query.teacher !== "me") return null;
    const cur = await loadCurrentTeacher();
    const grades = cur?.grade_levels || [];
    if (grades.length === 0) return { skip: true };
    return { where: "WHERE grade = ANY($1)", params: [grades] };
  },
});
