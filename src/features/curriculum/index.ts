// The public face of the curriculum feature. Other features import from
// here, never from a file inside — see the no-restricted-imports rule.
//
// CurriculumPicker is the shared widget: goals embeds it to seed a new
// goal from a unit, and CurriculumView mounts it as the standalone
// /curriculum page, browsing the sequence as reference.
export { default as CurriculumPicker } from "./CurriculumPicker";
export { default as CurriculumView } from "./CurriculumView";
