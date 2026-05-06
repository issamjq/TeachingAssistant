import { crudRouter } from "../lib/crud.js";

const FIELDS = ["name", "subject", "duration", "grade", "flow", "tags", "used_count", "starred"];
const SELECT = "id, name, subject, duration, grade, flow, tags, used_count, starred, updated_at";

export default crudRouter({
  table: "templates",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "used_count DESC NULLS LAST, id",
  timestampOnPatch: "updated_at",
  routeName: "/api/templates",
});
