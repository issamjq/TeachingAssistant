import { crudRouter } from "../lib/crud.js";

const FIELDS = ["name", "note", "warning", "subject", "status", "progress"];
const SELECT = "id, name, note, warning, subject, status, progress, last_edited";

export default crudRouter({
  table: "drafts",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "last_edited DESC NULLS LAST, id",
  timestampOnPatch: "last_edited",
  routeName: "/api/drafts",
});
