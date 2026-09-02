// Curriculum catalog (seed data).
//
// Imported by:
//   - db/seed.js — seeded into `curricula` and `curriculum_units` by
//                  `npm run db:seed`
//   - frontend   — only via /api/curriculum (not imported directly)
//
// ── What this is, and what it deliberately is not ────────────────────
//
// STRUCTURE, never content. A unit here is a title, an order and a set
// of learning outcomes — the shape a curriculum document publishes.
// Textbook text is copyrighted and is never seeded: a teacher's own book
// is uploaded to her own private bucket and used for her own class
// (see the materials shelf).
//
// ⚠️ THE UNITS BELOW ARE A STARTER SEQUENCE, NOT AN AUTHORITY.
//
// They are the near-universal topics of lower-secondary science and
// maths — the ones that appear in that order under almost every board —
// and they carry `source: 'starter'` so the UI can say so. They exist to
// prove the mechanism and to give the first teachers something better
// than a blank page.
//
// They have NOT been checked against a ministry or exam-board document.
// Before this is offered to real teachers as "the MoE Grade 7 sequence",
// someone who reads those documents has to verify and extend it, and
// flip `source` to the board they took it from. A sequence presented
// with more confidence than it has earned is worse than no sequence:
// a veteran teacher then has to audit every week before she can trust
// any of it, which costs her more than building it herself.
//
// Schema (mirrors curriculum_units):
//   curriculum_code  → curricula.code
//   grade            — matches GRADE_LEVELS in src/lib/enums.js
//   subject          — matches MAJORS in src/lib/enums.js
//   seq              — teaching order within (curriculum, grade, subject)
//   title            — what a teacher would call the unit
//   outcomes         — what a student should be able to do
//   typical_weeks    — a hint for pacing, not a rule
//   source           — where the sequence came from. 'starter' means us.

export const CURRICULA = [
  { code: "moe",      name: "UAE Ministry of Education", name_ar: "وزارة التربية والتعليم", region: "UAE" },
  { code: "british",  name: "British (National Curriculum / IGCSE)", name_ar: "المنهج البريطاني", region: "International" },
  { code: "ib",       name: "International Baccalaureate", name_ar: "البكالوريا الدولية", region: "International" },
  { code: "cbse",     name: "CBSE (India)", name_ar: "المنهج الهندي", region: "International" },
  { code: "american", name: "American (Common Core / NGSS)", name_ar: "المنهج الأمريكي", region: "International" },
];

/** The label a school's `curriculum` column uses → our code. */
export const CURRICULUM_BY_SCHOOL_LABEL = {
  MOE: "moe",
  British: "british",
  IB: "ib",
  Indian: "cbse",
  American: "american",
};

const S = "starter";

export const CURRICULUM_UNITS = [
  // ── Grade 7 Science ────────────────────────────────────────────────
  { curriculum_code: "moe", grade: "Grade 7", subject: "Science", seq: 1,
    title: "Cells and living things", typical_weeks: 3, source: S,
    outcomes: [
      "Name the main parts of animal and plant cells and say what each does",
      "Use a microscope to observe prepared slides safely",
      "Explain how cells are organised into tissues, organs and systems",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Science", seq: 2,
    title: "Particles and states of matter", typical_weeks: 3, source: S,
    outcomes: [
      "Describe solids, liquids and gases using the particle model",
      "Explain melting, boiling and evaporation in terms of particles",
      "Interpret a heating or cooling curve",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Science", seq: 3,
    title: "Mixtures and separation", typical_weeks: 3, source: S,
    outcomes: [
      "Tell a mixture from a pure substance",
      "Choose a separation method and justify the choice",
      "Carry out filtration, evaporation and simple chromatography",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Science", seq: 4,
    title: "Forces and motion", typical_weeks: 4, source: S,
    outcomes: [
      "Identify the forces acting on an object and draw them",
      "Describe the effect of balanced and unbalanced forces",
      "Calculate speed from distance and time, and read a distance–time graph",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Science", seq: 5,
    title: "Energy and its transfers", typical_weeks: 3, source: S,
    outcomes: [
      "Name the main energy stores and describe transfers between them",
      "Explain conduction, convection and radiation",
      "Argue for a way of reducing energy waste, with a reason",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Science", seq: 6,
    title: "Earth and space", typical_weeks: 3, source: S,
    outcomes: [
      "Explain day, night and the seasons using the Earth's motion",
      "Describe the structure of the solar system",
      "Relate the phases of the Moon to its orbit",
    ] },

  // ── Grade 7 Mathematics ────────────────────────────────────────────
  { curriculum_code: "moe", grade: "Grade 7", subject: "Mathematics", seq: 1,
    title: "Integers and operations", typical_weeks: 3, source: S,
    outcomes: [
      "Order and compare positive and negative numbers",
      "Add, subtract, multiply and divide integers",
      "Apply the order of operations to multi-step calculations",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Mathematics", seq: 2,
    title: "Fractions, decimals and percentages", typical_weeks: 4, source: S,
    outcomes: [
      "Convert freely between fractions, decimals and percentages",
      "Calculate a percentage of an amount, and a percentage change",
      "Solve word problems involving all three forms",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Mathematics", seq: 3,
    title: "Ratio and proportion", typical_weeks: 3, source: S,
    outcomes: [
      "Write and simplify a ratio",
      "Divide a quantity in a given ratio",
      "Use direct proportion to solve scaling problems",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Mathematics", seq: 4,
    title: "Introduction to algebra", typical_weeks: 4, source: S,
    outcomes: [
      "Use letters for unknowns and write simple expressions",
      "Collect like terms and expand a single bracket",
      "Solve one- and two-step linear equations",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Mathematics", seq: 5,
    title: "Angles and shape", typical_weeks: 3, source: S,
    outcomes: [
      "Use angle facts on a line, at a point and in a triangle",
      "Classify triangles and quadrilaterals by their properties",
      "Find the area and perimeter of compound shapes",
    ] },
  { curriculum_code: "moe", grade: "Grade 7", subject: "Mathematics", seq: 6,
    title: "Handling data", typical_weeks: 3, source: S,
    outcomes: [
      "Calculate the mean, median, mode and range",
      "Choose and draw a suitable chart for a data set",
      "Read a chart critically and say what it does not show",
    ] },
];
