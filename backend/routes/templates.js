import { artifactRouter } from "../lib/artifacts.js";

const FIELDS = [
  "name", "subject", "duration", "grade", "flow", "tags",
  "used_count", "starred", "objectives", "stages",
];

export default artifactRouter({
  type: "template",
  fields: FIELDS,
  routeName: "/api/templates",
  // Most-used first, and the count lives in the jsonb body — so the sort
  // has to reach into it and cast, since jsonb compares as text and
  // would order 9 after 10.
  listOrderBy: "COALESCE((content->>'used_count')::int, 0) DESC, updated_at DESC",
});
