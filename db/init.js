import "dotenv/config";
import pg from "pg";
import { GRADE_LEVELS, NATIONALITIES } from "../src/lib/enums.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Build a Postgres ARRAY[...]::text[] literal from a JS list, escaping single quotes.
const sqlArr = (vals) =>
  `ARRAY[${vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")}]::text[]`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  duration INT NOT NULL,
  grade TEXT NOT NULL,
  flow TEXT,
  tags TEXT[] DEFAULT '{}',
  used_count INT DEFAULT 0,
  starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT,
  warning TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In progress',
  progress INT DEFAULT 0,
  last_edited TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  staff_id TEXT UNIQUE,
  majors TEXT[] DEFAULT '{}',
  grade_levels TEXT[] DEFAULT '{}',
  nationality TEXT,
  hire_date DATE,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_id TEXT UNIQUE,
  date_of_birth DATE,
  gender TEXT,
  grade TEXT NOT NULL,
  section TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  address TEXT,
  primary_guardian_name TEXT,
  primary_guardian_relationship TEXT,
  primary_guardian_email TEXT,
  primary_guardian_phone TEXT,
  secondary_guardian_name TEXT,
  secondary_guardian_relationship TEXT,
  secondary_guardian_email TEXT,
  secondary_guardian_phone TEXT,
  enrollment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_grade_section_idx ON students (grade, section);
CREATE INDEX IF NOT EXISTS students_section_idx ON students (section);
`;

// Normalize legacy/typo values BEFORE re-applying the CHECK constraints,
// otherwise the ALTER TABLE will fail on existing bad rows.
const NORMALIZE = `
UPDATE teachers SET nationality = 'Saudi Arabia' WHERE nationality = 'Saudi';
UPDATE students SET nationality = 'Saudi Arabia' WHERE nationality = 'Saudi';
`;

// Refresh CHECK constraints from the JS enum lists. Drop-then-add makes this
// safe to re-run when the lists change.
//
// Note: teachers.majors and teachers.grade_levels are intentionally unconstrained.
// They're per-teacher and free-form — a teacher who teaches Robotics or covers
// "Foundation Stage" shouldn't be blocked because the curated lists don't have
// that exact value. The MAJORS / GRADE_LEVELS lists still serve as quick-pick
// suggestions in the UI. The DROPs below remove constraints from older schemas.
//
// students.grade IS still constrained — a student record represents a real
// school-defined grade, not a personal preference.
const CONSTRAINTS = `
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_majors_valid;
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_grade_levels_valid;

ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_nationality_valid;
ALTER TABLE teachers ADD  CONSTRAINT teachers_nationality_valid
  CHECK (nationality IS NULL OR nationality = ANY(${sqlArr(NATIONALITIES)}));

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_grade_valid;
ALTER TABLE students ADD  CONSTRAINT students_grade_valid
  CHECK (grade = ANY(${sqlArr(GRADE_LEVELS)}));

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_nationality_valid;
ALTER TABLE students ADD  CONSTRAINT students_nationality_valid
  CHECK (nationality IS NULL OR nationality = ANY(${sqlArr(NATIONALITIES)}));
`;

const TEMPLATES = [
  ["Reading comprehension", "English", 45, "6–8", "Warm-up → guided reading → 5 questions → exit ticket.", ["Comprehension", "Quiz attached"], 42, true],
  ["Problem-solving session", "Math", 60, "7", "Concept recap → worked example → pair practice → reflection.", ["Problem solving", "Pair work"], 38, true],
  ["Lab experiment", "Science", 90, "8", "Hypothesis → procedure → observation → conclusion writeup.", ["Hands-on", "Worksheet"], 27, false],
  ["Creative writing workshop", "Art", 45, "6–9", "Prompt → free write → peer share → revise → publish.", ["Group work", "Activity"], 19, false],
  ["Source analysis", "History", 50, "8–10", "Read source → identify bias → compare → discuss.", ["Critical thinking", "Discussion"], 14, false],
  ["Map reading basics", "Geography", 45, "6", "Intro → key & legend → guided exercise → quiz.", ["Foundations", "Quiz attached"], 11, false],
  ["Vocabulary review", "English", 30, "7", "Recap list → games → mini test → flashcards.", ["Review", "Games"], 9, false],
  ["Geometry intro", "Math", 60, "6", "Shapes → angles → guided practice → exit ticket.", ["Foundations", "Worksheet"], 7, false],
];

// [first_name, last_name, email, phone, staff_id, majors, grade_levels, nationality, hire_date, bio]
const TEACHERS = [
  ["Sara", "Al-Mansoori", "sara.almansoori@mudir.school", "+971 50 123 4567", "STF-001", ["Science", "Biology"], ["Grade 6", "Grade 7", "Grade 8", "Grade 9"], "UAE", "2019-08-15", "Lead science teacher for the middle school. Passionate about hands-on labs and inquiry-based learning."],
  ["Ahmed", "Khalifa", "ahmed.khalifa@mudir.school", "+971 50 234 5678", "STF-002", ["Math", "Physics"], ["Grade 9", "Grade 10", "Grade 11", "Grade 12"], "UAE", "2017-09-01", "Senior maths teacher and IB DP coordinator."],
  ["Layla", "Hassan", "layla.hassan@mudir.school", "+971 55 345 6789", "STF-003", ["English", "Drama"], ["Grade 6", "Grade 7", "Grade 8"], "Lebanon", "2021-08-20", "English language teacher with a focus on creative writing and reading comprehension."],
  ["Mohammed", "Al-Suwaidi", "mohammed.alsuwaidi@mudir.school", "+971 50 456 7890", "STF-004", ["Arabic", "Islamic Studies"], ["KG 1", "KG 2", "Grade 1", "Grade 2", "Grade 3"], "UAE", "2015-09-15", "Early years Arabic and Islamic studies specialist."],
  ["Priya", "Menon", "priya.menon@mudir.school", "+971 56 567 8901", "STF-005", ["Art", "History"], ["Grade 4", "Grade 5", "Grade 6", "Grade 7"], "India", "2020-09-01", "Art teacher and humanities cross-curricular collaborator."],
];

// [first_name, last_name, student_id, dob, gender, grade, section, email, phone, nationality, address,
//  pg_name, pg_rel, pg_email, pg_phone, sg_name, sg_rel, sg_email, sg_phone, enrollment_date, notes]
const STUDENTS = [
  // Grade 6 — section 6A
  ["Ahmed",   "Al-Hashimi",  "STU-6A-001", "2013-03-12", "Male",   "Grade 6", "6A", null, null, "UAE",     "Al Wasl, Dubai",       "Khalid Al-Hashimi",  "Father", "khalid.alhashimi@mail.ae",  "+971 50 111 2233", "Mariam Al-Hashimi", "Mother", "mariam.alh@mail.ae", "+971 50 111 4455", "2022-09-05", null],
  ["Fatima",  "Al-Marri",    "STU-6A-002", "2013-05-04", "Female", "Grade 6", "6A", null, null, "UAE",     "Mirdif, Dubai",        "Nora Al-Marri",      "Mother", "nora.almarri@mail.ae",      "+971 50 222 3344", null, null, null, null, "2022-09-05", "Top of class in science."],
  ["Omar",    "Bin Saleh",   "STU-6A-003", "2013-01-20", "Male",   "Grade 6", "6A", null, null, "Saudi Arabia",   "Jumeirah, Dubai",      "Saleh Bin Saleh",    "Father", "saleh.bs@mail.com",         "+966 50 333 4455", null, null, null, null, "2022-09-05", null],
  ["Layla",   "Mahmoud",     "STU-6A-004", "2013-07-14", "Female", "Grade 6", "6A", null, null, "Egypt",   "Al Barsha, Dubai",     "Hassan Mahmoud",     "Father", "hassan.m@mail.com",         "+971 50 444 5566", "Aisha Mahmoud", "Mother", "aisha.m@mail.com", "+971 50 444 7788", "2022-09-05", null],
  ["Yousef",  "Khoury",      "STU-6A-005", "2013-09-30", "Male",   "Grade 6", "6A", null, null, "Lebanon", "Dubai Marina, Dubai",  "Rania Khoury",       "Mother", "rania.khoury@mail.com",     "+971 55 555 6677", null, null, null, null, "2023-01-10", "Joined mid-year from Beirut."],
  ["Aisha",   "Patel",       "STU-6A-006", "2013-04-22", "Female", "Grade 6", "6A", null, null, "India",   "Bur Dubai, Dubai",     "Vikram Patel",       "Father", "vikram.patel@mail.com",     "+971 50 666 7788", "Sunita Patel", "Mother", "sunita.p@mail.com", "+971 50 666 9900", "2022-09-05", null],

  // Grade 6 — section 6B
  ["Hamdan",  "Al-Falasi",   "STU-6B-001", "2013-02-18", "Male",   "Grade 6", "6B", null, null, "UAE",     "Al Khawaneej, Dubai",  "Mariam Al-Falasi",   "Mother", "mariam.alf@mail.ae",        "+971 50 777 8899", null, null, null, null, "2022-09-05", null],
  ["Maryam",  "Saeed",       "STU-6B-002", "2013-06-08", "Female", "Grade 6", "6B", null, null, "UAE",     "Deira, Dubai",         "Saeed Al-Suwaidi",   "Father", "saeed.als@mail.ae",         "+971 50 888 9900", null, null, null, null, "2022-09-05", "Needs extra scaffolding for written tasks."],
  ["Khaled",  "Mansour",     "STU-6B-003", "2013-08-25", "Male",   "Grade 6", "6B", null, null, "Jordan",  "Al Quoz, Dubai",       "Tariq Mansour",      "Father", "tariq.m@mail.com",          "+971 56 999 0011", "Lina Mansour", "Mother", "lina.m@mail.com", "+971 56 999 2233", "2022-09-05", null],
  ["Noor",    "Abdullah",    "STU-6B-004", "2013-11-02", "Female", "Grade 6", "6B", null, null, "UAE",     "JLT, Dubai",           "Abdullah Al-Nuaimi", "Father", "abdullah.aln@mail.ae",      "+971 50 100 2233", null, null, null, null, "2022-09-05", null],

  // Grade 7 — section 7A
  ["Rashid",  "Al-Maktoum",  "STU-7A-001", "2012-04-11", "Male",   "Grade 7", "7A", "rashid.alm@students.mudir.school", null, "UAE", "Umm Suqeim, Dubai", "Hind Al-Maktoum", "Mother", "hind.alm@mail.ae", "+971 50 200 3344", null, null, null, null, "2021-09-01", null],
  ["Salma",   "Tarek",       "STU-7A-002", "2012-09-18", "Female", "Grade 7", "7A", "salma.t@students.mudir.school",    null, "Egypt", "Al Garhoud, Dubai", "Tarek Mahmoud", "Father", "tarek.m@mail.com", "+971 50 300 4455", null, null, null, null, "2021-09-01", "Class representative."],
  ["Zayed",   "Al-Nuaimi",   "STU-7A-003", "2012-12-05", "Male",   "Grade 7", "7A", "zayed.aln@students.mudir.school",  null, "UAE", "Sharjah", "Mohammed Al-Nuaimi", "Father", "mohammed.aln@mail.ae", "+971 50 400 5566", null, null, null, null, "2021-09-01", null],
  ["Hessa",   "Al-Qassimi",  "STU-7A-004", "2012-06-23", "Female", "Grade 7", "7A", "hessa.alq@students.mudir.school",  null, "UAE", "Sharjah", "Sheikha Al-Qassimi", "Mother", "sheikha.alq@mail.ae", "+971 50 500 6677", null, null, null, null, "2021-09-01", null],

  // Grade 7 — section 7B
  ["Ibrahim", "Awad",        "STU-7B-001", "2012-03-09", "Male",   "Grade 7", "7B", "ibrahim.a@students.mudir.school", null, "Sudan", "Al Nahda, Dubai", "Yasmin Awad", "Mother", "yasmin.a@mail.com", "+971 56 600 7788", null, null, null, null, "2021-09-01", null],
  ["Amina",   "Al-Habsi",    "STU-7B-002", "2012-10-14", "Female", "Grade 7", "7B", "amina.alh@students.mudir.school", null, "Oman", "Discovery Gardens, Dubai", "Salim Al-Habsi", "Father", "salim.alh@mail.com", "+968 90 700 8899", "Mariam Al-Habsi", "Mother", "mariam.alh.om@mail.com", "+968 90 700 1010", "2021-09-01", null],
  ["Saif",    "Khan",        "STU-7B-003", "2012-07-27", "Male",   "Grade 7", "7B", "saif.k@students.mudir.school",    null, "Pakistan", "International City, Dubai", "Bilal Khan", "Father", "bilal.k@mail.com", "+971 56 800 9900", null, null, null, null, "2022-09-05", null],
  ["Reem",    "Al-Otaiba",   "STU-7B-004", "2012-11-19", "Female", "Grade 7", "7B", "reem.alo@students.mudir.school",  null, "UAE", "Abu Dhabi", "Saeed Al-Otaiba", "Father", "saeed.alo@mail.ae", "+971 50 900 0011", null, null, null, null, "2021-09-01", "Boards from Abu Dhabi during the week."],

  // Grade 8 — section 8A
  ["Tariq",   "Al-Suwaidi",  "STU-8A-001", "2011-05-30", "Male",   "Grade 8", "8A", "tariq.als@students.mudir.school", "+971 55 110 2233", "UAE", "Al Warqa, Dubai", "Latifa Al-Suwaidi", "Mother", "latifa.als@mail.ae", "+971 50 110 3344", null, null, null, null, "2020-09-01", null],
  ["Mariam",  "Bin Hammad",  "STU-8A-002", "2011-08-12", "Female", "Grade 8", "8A", "mariam.bh@students.mudir.school", "+971 56 220 3344", "UAE", "Al Twar, Dubai", "Khalid Bin Hammad", "Father", "khalid.bh@mail.ae", "+971 50 220 4455", "Hessa Bin Hammad", "Mother", "hessa.bh@mail.ae", "+971 50 220 5566", "2020-09-01", null],
  ["Ali",     "Hussein",     "STU-8A-003", "2011-02-04", "Male",   "Grade 8", "8A", "ali.h@students.mudir.school",     "+971 56 330 4455", "Iraq", "Al Mizhar, Dubai", "Zaynab Hussein", "Mother", "zaynab.h@mail.com", "+971 56 330 5566", null, null, null, null, "2020-09-01", null],

  // KG 2 — section KG2-A
  ["Hamad",   "Al-Shamsi",   "STU-K2-001", "2018-05-15", "Male",   "KG 2", "KG2-A", null, null, "UAE", "Al Mizhar, Dubai", "Aisha Al-Shamsi", "Mother", "aisha.als@mail.ae", "+971 50 010 1122", null, null, null, null, "2024-09-01", null],
  ["Shaikha", "Al-Mehairi",  "STU-K2-002", "2018-08-22", "Female", "KG 2", "KG2-A", null, null, "UAE", "Al Barsha, Dubai", "Khalifa Al-Mehairi", "Father", "khalifa.alm@mail.ae", "+971 50 020 2233", null, null, null, null, "2024-09-01", null],
];

// [name, note, warning, subject, status, progress, interval]
const DRAFTS = [
  ["Poetry — figurative language", "For grade 7B · Friday lesson", "missing slides", "English", "In progress", 65, "2 minutes"],
  ["Algebra recap before unit test", "Grade 8A · review session", null, "Math", "Ready to use", 100, "1 hour"],
  ["States of matter — lab prep", "Needs lab booking confirmation", "needs lab time", "Science", "Blocked", 80, "1 day"],
  ["Vocabulary review — week 12", "Grade 7A · paused", null, "English", "Paused", 40, "2 days"],
  ["Industrial revolution intro", "First lesson of new unit", "missing handout", "History", "In progress", 50, "3 days"],
  ["Word problems Friday set", "Grade 7 · 5 problems drafted", null, "Math", "In progress", 30, "7 days"],
  ["Short story workshop pt. 2", "Continuation from Monday", null, "Art", "Ready to use", 100, "8 days"],
];

async function main() {
  console.log("Creating schema...");
  await pool.query(SCHEMA);

  console.log("Normalizing legacy values...");
  await pool.query(NORMALIZE);

  console.log("Refreshing CHECK constraints...");
  await pool.query(CONSTRAINTS);

  const t = await pool.query("SELECT COUNT(*)::int AS n FROM templates");
  if (t.rows[0].n === 0) {
    console.log(`Seeding ${TEMPLATES.length} templates...`);
    for (const row of TEMPLATES) {
      await pool.query(
        `INSERT INTO templates (name, subject, duration, grade, flow, tags, used_count, starred)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        row
      );
    }
  } else {
    console.log(`Templates already populated (${t.rows[0].n} rows). Skipping seed.`);
  }

  const d = await pool.query("SELECT COUNT(*)::int AS n FROM drafts");
  if (d.rows[0].n === 0) {
    console.log(`Seeding ${DRAFTS.length} drafts...`);
    for (const [name, note, warning, subject, status, progress, interval] of DRAFTS) {
      await pool.query(
        `INSERT INTO drafts (name, note, warning, subject, status, progress, last_edited)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - $7::interval)`,
        [name, note, warning, subject, status, progress, interval]
      );
    }
  } else {
    console.log(`Drafts already populated (${d.rows[0].n} rows). Skipping seed.`);
  }

  const tch = await pool.query("SELECT COUNT(*)::int AS n FROM teachers");
  if (tch.rows[0].n === 0) {
    console.log(`Seeding ${TEACHERS.length} teachers...`);
    for (const row of TEACHERS) {
      await pool.query(
        `INSERT INTO teachers (first_name, last_name, email, phone, staff_id, majors, grade_levels, nationality, hire_date, bio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        row
      );
    }
  } else {
    console.log(`Teachers already populated (${tch.rows[0].n} rows). Skipping seed.`);
  }

  const stu = await pool.query("SELECT COUNT(*)::int AS n FROM students");
  if (stu.rows[0].n === 0) {
    console.log(`Seeding ${STUDENTS.length} students...`);
    for (const row of STUDENTS) {
      await pool.query(
        `INSERT INTO students (
           first_name, last_name, student_id, date_of_birth, gender, grade, section,
           email, phone, nationality, address,
           primary_guardian_name, primary_guardian_relationship, primary_guardian_email, primary_guardian_phone,
           secondary_guardian_name, secondary_guardian_relationship, secondary_guardian_email, secondary_guardian_phone,
           enrollment_date, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        row
      );
    }
  } else {
    console.log(`Students already populated (${stu.rows[0].n} rows). Skipping seed.`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Init failed:", err);
  pool.end();
  process.exit(1);
});
