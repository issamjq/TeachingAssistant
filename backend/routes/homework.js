import { artifactRouter } from "../lib/artifacts.js";
import { submissionRoutes } from "../lib/submissions.js";

const FIELDS = [
  "title", "subject", "grade", "section",
  "instructions", "due_date", "attachments",
];

const router = artifactRouter({
  type: "homework",
  fields: FIELDS,
  routeName: "/api/homework",
  // Soonest due first. due_date lives in the jsonb body, so it is cast
  // on the way out — text ordering would put "2026-1-9" after "2026-10-1".
  listOrderBy: "(content->>'due_date')::date NULLS LAST, updated_at DESC",
});

// Per-student grid. Lower-cased vocabulary: these are the values the
// quiz_attempts CHECK allows, and the old title-cased ones ("Pending",
// "Graded") would now be rejected by the database rather than stored.
submissionRoutes(router, {
  type: "homework",
  path: "submissions",
  statuses: ["pending", "submitted", "graded", "returned", "late"],
});

export default router;
