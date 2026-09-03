// The public face of the subjects feature. Other features import from
// here, never from a file inside — see the no-restricted-imports rule.
//
// §105 lives here: the subjects a teacher named, the divisions that hold
// the roll, and the class-level reads and writes built on both. The
// class settings panel is a separate feature and consumes this surface.
export {
  listSubjects,
  createSubject,
  archiveSubject,
  listDivisions,
  createDivision,
  divisionRoll,
  addToDivision,
  removeFromDivision,
  listClasses,
  teachSubject,
  classRoster,
  setClassException,
  rollYear,
  type Subject,
  type Division,
  type RollEntry,
  type ClassRow,
} from "./api";
export { default as SubjectsView } from "./SubjectsView";
