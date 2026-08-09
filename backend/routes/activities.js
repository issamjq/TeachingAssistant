import { artifactRouter } from "../lib/artifacts.js";
import { submissionRoutes } from "../lib/submissions.js";

const FIELDS = [
  "draft_id", "title", "type", "subject", "grade",
  "duration_minutes", "instructions", "materials", "scheduled_for",
];

const router = artifactRouter({
  type: "activity",
  fields: FIELDS,
  routeName: "/api/activities",
});

// A completion is a submission with a shorter vocabulary — done or not.
submissionRoutes(router, {
  type: "activity",
  path: "completions",
  statuses: ["pending", "completed"],
});

export default router;
