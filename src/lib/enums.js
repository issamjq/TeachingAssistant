// Single source of truth for reference data.
// Imported by:
//   - backend/db/init.js — to build CHECK constraints + validate seed data
//   - vite.config.js — when mutation endpoints validate request bodies (TODO)
//   - studio views    — to populate dropdowns
// If you need a new value, add it here and re-run `npm run db:init` so the
// CHECK constraint stays in sync.

// Teacher specializations. Superset of lesson SUBJECTS — a Biology specialist
// can still teach "Science" lessons; the major is the more granular label.
export const MAJORS = [
  "English",
  "Arabic",
  "Math",
  "Science",
  "Biology",
  "Physics",
  "Chemistry",
  "History",
  "Geography",
  "Social Studies",
  "Islamic Studies",
  "Art",
  "Music",
  "Drama",
  "Physical Education",
  "Computer Science",
  "Business Studies",
  "Economics",
  "Psychology",
];

// AI Studio — Quiz pre-prompt knobs. These power the dropdowns above the
// quiz prompt textarea so a teacher picks from a finite list instead of
// typing meta into the prose. Empty = AI infers from the prompt.

export const QUIZ_QUESTION_COUNTS = [5, 8, 10, 12, 15, 20, 25, 30];

export const QUIZ_DURATIONS = [10, 15, 20, 30, 45, 60, 90];

export const QUIZ_DIFFICULTIES = ["Easy", "Medium", "Hard"];

// Question-type mix for the AI to honour. Every option is a hard
// constraint on which underlying type codes (mcq / short / tf) the model
// is allowed to use. Three singles, three pairs, and "All three" — empty
// chip value means Murchid picks freely.
// "Identification" is the everyday name for short-answer recall
// questions — kept in the UI; the backend prompt translates it to the
// underlying type code (short).
export const QUIZ_QUESTION_MIXES = [
  "MCQ only",
  "Identification only",
  "True/False only",
  "MCQ + Identification",
  "MCQ + True/False",
  "Identification + True/False",
  "All three (MCQ + Identification + True/False)",
];

// Output language for the generated quiz. The AI returns the full quiz —
// title, prompts, choices, answer key — in this language. English head,
// regional languages first, then other commonly-taught languages. Teachers
// can also type a custom value (e.g. Urdu, Swahili).
export const QUIZ_LANGUAGES = [
  "English",
  "Arabic",
  "French",
  "Spanish",
  "Turkish",
  "Urdu",
  "Mandarin",
  "Hindi",
  "Russian",
  "Portuguese",
  "German",
  "Italian",
];

// Class section labels (Grade 6 "A", Grade 6 "B", etc.). Single letters
// cover most schools; multi-section schools usually type a custom value
// like "Maths Track" or "A & B". "All sections" is the catch-all default.
export const QUIZ_SECTIONS = [
  "All sections",
  "Section A",
  "Section B",
  "Section C",
  "Section D",
  "Section E",
  "Section F",
];

// School year levels. Used for:
//   - teachers.grade_levels (TEXT[])  — which grades a teacher covers
//   - students.grade        (TEXT)    — which grade a student is in
// ── Bulletin board ─────────────────────────────────────────────────────
// What a real classroom board actually holds. Kept short on purpose: a board
// with twenty categories is a filing cabinet, and teachers stop using it.
//
// These compile into CHECK constraints in backend/db/init.js, so adding a
// value here needs `npm run db:init` before a row carrying it will insert.
export const ANNOUNCEMENT_KINDS = [
  "Notice", "Reminder", "Event", "Homework", "Achievement", "Resource",
];

export const ANNOUNCEMENT_PRIORITIES = ["Normal", "Urgent"];

// Who a pinned note is for. A physical board is read by whoever walks past;
// a digital one has to be told. This is the field the student and parent
// portals (roadmap days 15-16) will filter on, which is why it exists now
// rather than being added once those screens are being written.
export const ANNOUNCEMENT_AUDIENCES = ["Students", "Parents", "Everyone"];

export const GRADE_LEVELS = [
  "KG 1",
  "KG 2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

// Nationalities. Country names (not demonyms) so "UAE" not "Emirati".
// Two groups:
//   1. Pinned head — Gulf + wider Arab world, ordered for UAE-school relevance.
//      Kept first so the most-used options are always at the top of the dropdown.
//   2. Rest of the world — alphabetical, comprehensive ISO list.
// Israel is intentionally excluded.
// "Other" is the last-resort bucket.
const PINNED_NATIONALITIES = [
  "UAE",
  "Saudi Arabia",
  "Kuwait",
  "Bahrain",
  "Qatar",
  "Oman",
  "Yemen",
  "Egypt",
  "Lebanon",
  "Jordan",
  "Syria",
  "Iraq",
  "Palestine",
  "Sudan",
  "Somalia",
  "Morocco",
  "Algeria",
  "Tunisia",
  "Libya",
  "Mauritania",
  "Djibouti",
  "Comoros",
];

const REST_NATIONALITIES = [
  "Afghanistan",
  "Albania",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Congo (Brazzaville)",
  "Congo (Kinshasa)",
  "Costa Rica",
  "Côte d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Ireland",
  "Italy",
  "Jamaica",
  "Japan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lesotho",
  "Liberia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "São Tomé and Príncipe",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Türkiye",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Zambia",
  "Zimbabwe",
];

export const NATIONALITIES = [
  ...PINNED_NATIONALITIES,
  ...REST_NATIONALITIES,
  "Other",
];
