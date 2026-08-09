// Lesson plans. "Drafts" is what the studio calls them on screen; the
// stored type is lesson_plan, which is what they are.
//
// Every field below is a key inside ai_studio.content — see lib/artifacts.js
// for why the flat list survives the move to one table.
import { artifactRouter } from "../lib/artifacts.js";

const FIELDS = [
  "name", "note", "warning", "subject", "progress",
  "planned_date", "grade", "section", "duration_minutes",
  "objectives", "materials", "intro", "main_activity", "conclusion",
  "assessment_method", "attachments", "tags",
];

export default artifactRouter({
  type: "lesson_plan",
  fields: FIELDS,
  routeName: "/api/drafts",
});
