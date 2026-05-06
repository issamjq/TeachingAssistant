import { crudRouter } from "../lib/crud.js";

const FIELDS = ["title", "type", "subject", "grade", "url", "notes", "tags"];
const SELECT = "id, title, type, subject, grade, url, notes, tags, created_at, updated_at";

export default crudRouter({
  table: "library_resources",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "updated_at DESC, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/library",
  teacherScoped: true,
});
