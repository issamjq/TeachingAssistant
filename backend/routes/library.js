// The library is uploaded source material, not generated output, so it
// maps to `materials` rather than into ai_studio — a PDF a teacher
// uploaded and a lesson plan the studio wrote are not the same kind of
// thing, even though both end up on a shelf in the UI.
import { crudRouter } from "../lib/crud.js";

const FIELDS = ["file_name", "file_path", "mime_type", "extracted_text", "status"];
const SELECT = `id, file_name, file_path, mime_type, status,
                extracted_text, created_at, updated_at`;

export default crudRouter({
  table: "materials",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "updated_at DESC, id DESC",
  routeName: "/api/library",
  teacherScoped: true,
  softDelete: true,
});
