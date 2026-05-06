import { crudRouter } from "../lib/crud.js";

const FIELDS = ["draft_id", "title", "subject", "grade", "slides", "status"];
const SELECT = "id, draft_id, title, subject, grade, slides, status, created_at, updated_at";

export default crudRouter({
  table: "presentations",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "updated_at DESC, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/presentations",
  teacherScoped: true,
});
