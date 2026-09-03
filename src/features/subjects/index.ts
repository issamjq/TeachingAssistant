// The public face of the subjects feature. Other features import from
// here, never from a file inside — see the no-restricted-imports rule.
//
// §105 lives here: the subjects a teacher named, the divisions that hold
// the roll, and the class-level reads and writes built on both. The
// class settings panel is a separate feature and consumes this surface.
export {
  listSubjects,
  createSubject,
  updateSubject,
  archiveSubject,
  listDivisions,
  createDivision,
  updateDivision,
  archiveDivision,
  divisionRoll,
  addToDivision,
  removeFromDivision,
  listClasses,
  teachSubject,
  archiveClass,
  classRoster,
  setClassException,
  rollYear,
  listClassDocuments,
  createClassDocument,
  deleteClassDocument,
  type Subject,
  type Division,
  type RollEntry,
  type ClassRow,
  type ClassDocument,
} from "./api";
export { default as SubjectsView } from "./SubjectsView";
export { default as AddStudentsModal } from "./AddStudentsModal";
export { default as AddSubjectNameModal } from "./AddSubjectNameModal";
export { default as AddSubjectToDivisionsModal } from "./AddSubjectToDivisionsModal";
export { uploadClassDocument } from "./uploadClassDocument";
