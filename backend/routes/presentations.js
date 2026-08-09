import { artifactRouter } from "../lib/artifacts.js";

const FIELDS = ["draft_id", "title", "subject", "grade", "section", "slides", "scheduled_for"];

export default artifactRouter({
  type: "presentation",
  fields: FIELDS,
  routeName: "/api/presentations",
});
