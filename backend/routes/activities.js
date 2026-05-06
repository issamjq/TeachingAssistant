import { crudRouter } from "../lib/crud.js";

const FIELDS = [
  "draft_id", "title", "type", "subject", "grade",
  "duration_minutes", "instructions", "materials",
];
const SELECT = `id, draft_id, title, type, subject, grade,
                duration_minutes, instructions, materials,
                created_at, updated_at`;

export default crudRouter({
  table: "activities",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "updated_at DESC, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/activities",
  teacherScoped: true,
});
