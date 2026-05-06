import { crudRouter } from "../lib/crud.js";

const FIELDS = [
  "draft_id", "title", "subject", "grade", "section",
  "date", "start_time", "end_time", "location", "notes", "status",
];
const SELECT = `id, draft_id, title, subject, grade, section,
                date, start_time, end_time, location, notes, status,
                created_at, updated_at`;

// listExtra accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD to scope to a date window.
// Default order is chronological so calendars render naturally.
export default crudRouter({
  table: "schedule_entries",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "date, start_time",
  timestampOnPatch: "updated_at",
  routeName: "/api/schedule",
  teacherScoped: true,
  listExtra: async (req) => {
    const clauses = [];
    const params = [];
    if (req.query.from) { params.push(req.query.from); clauses.push(`date >= $${params.length}`); }
    if (req.query.to)   { params.push(req.query.to);   clauses.push(`date <= $${params.length}`); }
    if (clauses.length === 0) return null;
    return { where: clauses.join(" AND "), params };
  },
});
