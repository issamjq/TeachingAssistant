import { crudRouter } from "../lib/crud.js";

// Drafts ARE the lesson plans. Original "draft" fields (name, note, status,
// progress) coexist with the richer lesson-plan fields (date, objectives,
// materials, intro, main, conclusion, assessment, attachments, tags, grade,
// section, duration_minutes).
const FIELDS = [
  "name", "note", "warning", "subject", "status", "progress",
  "planned_date", "grade", "section", "duration_minutes",
  "objectives", "materials", "intro", "main_activity", "conclusion",
  "assessment_method", "attachments", "tags",
];

const SELECT = `id, name, note, warning, subject, status, progress, last_edited,
                planned_date, grade, section, duration_minutes,
                objectives, materials, intro, main_activity, conclusion,
                assessment_method, attachments, tags`;

export default crudRouter({
  table: "drafts",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "last_edited DESC NULLS LAST, id",
  timestampOnPatch: "last_edited",
  routeName: "/api/drafts",
  teacherScoped: true,
});
