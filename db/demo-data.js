// =====================================================================
// The demo teacher's world — one coherent term, not a bag of rows
//
// Kept apart from seed-demo.js so that file stays about WRITING and this
// one stays about WHAT. Everything here is invented but plausible: a
// real UAE school week (Monday to Friday since 2022), a class list with
// the nationality mix a Dubai secondary school actually has, and marks
// that vary the way a class varies rather than sitting in a neat band.
//
// Dates are all offsets in days from "today", resolved at seed time, so
// re-running next month still produces a term in progress rather than
// an archive.
// =====================================================================

export const TEACHER = {
  full_name: "Layla Al Mansoori",
  first_name: "Layla",
  last_name: "Al Mansoori",
  phone: "+971 50 418 2270",
  locale: "en",
  faculty: {
    staff_id: "EIS-40928",
    organization: "Emirates International School",
    nationality: "Emirati",
    years_experience: 9,
    hire_date: -2860, // joined a little over seven years ago
    bio:
      "Physics and mathematics teacher with nine years across the MoE and IB " +
      "curricula. Inquiry-led practical work, and a stubborn belief that a " +
      "student who can explain a graph understands more than one who can " +
      "recite the formula.",
    qualification: ["BSc Physics, UAE University", "PGCE, University of Nottingham"],
    expertise: ["Physics", "Mathematics"],
    languages: ["Arabic", "English"],
    eligible_grades: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  },
};

/** Three teaching groups. The timetable and the roster both hang off these. */
export const CLASSES = [
  { key: "p9a",  name: "Physics 9A",     subject: "Physics",     grade: "Grade 9",  division: "A", code: "PHY-9A" },
  { key: "p11b", name: "Physics 11B",    subject: "Physics",     grade: "Grade 11", division: "B", code: "PHY-11B" },
  { key: "m10a", name: "Mathematics 10A", subject: "Mathematics", grade: "Grade 10", division: "A", code: "MAT-10A" },
];

/**
 * Twenty-six students.
 *
 * The mix — Emirati, Indian, Egyptian, Pakistani, Jordanian, Filipino,
 * Syrian, British, Lebanese, Sudanese — is roughly what a Dubai private
 * secondary actually enrols, and it matters here because the roster
 * screen is mostly names: a list of twenty Ahmeds would look seeded.
 */
export const STUDENTS = [
  // ── Physics 9A ────────────────────────────────────────────────────
  { c: "p9a", first: "Mariam",   last: "Al Hosani",    gender: "female", nat: "Emirati",     g: "M. Al Hosani", rel: "Mother" },
  { c: "p9a", first: "Yousef",   last: "Al Marzooqi",  gender: "male",   nat: "Emirati",     g: "K. Al Marzooqi", rel: "Father" },
  { c: "p9a", first: "Ananya",   last: "Krishnan",     gender: "female", nat: "Indian",      g: "Suresh Krishnan", rel: "Father" },
  { c: "p9a", first: "Omar",     last: "Farouk",       gender: "male",   nat: "Egyptian",    g: "Hala Farouk", rel: "Mother" },
  { c: "p9a", first: "Zainab",   last: "Siddiqui",     gender: "female", nat: "Pakistani",   g: "Imran Siddiqui", rel: "Father" },
  { c: "p9a", first: "Daniel",   last: "Whitfield",    gender: "male",   nat: "British",     g: "Claire Whitfield", rel: "Mother" },
  { c: "p9a", first: "Fatima",   last: "Al Blooshi",   gender: "female", nat: "Emirati",     g: "S. Al Blooshi", rel: "Father" },
  { c: "p9a", first: "Rayyan",   last: "Haddad",       gender: "male",   nat: "Jordanian",   g: "Nadia Haddad", rel: "Mother" },
  { c: "p9a", first: "Jasmine",  last: "Reyes",        gender: "female", nat: "Filipino",    g: "Manuel Reyes", rel: "Father" },

  // ── Physics 11B ───────────────────────────────────────────────────
  { c: "p11b", first: "Khalid",   last: "Al Suwaidi",  gender: "male",   nat: "Emirati",     g: "A. Al Suwaidi", rel: "Father" },
  { c: "p11b", first: "Layan",    last: "Nasser",      gender: "female", nat: "Syrian",      g: "Rami Nasser", rel: "Father" },
  { c: "p11b", first: "Arjun",    last: "Menon",       gender: "male",   nat: "Indian",      g: "Priya Menon", rel: "Mother" },
  { c: "p11b", first: "Hessa",    last: "Al Ali",      gender: "female", nat: "Emirati",     g: "M. Al Ali", rel: "Mother" },
  { c: "p11b", first: "Ibrahim",  last: "Adam",        gender: "male",   nat: "Sudanese",    g: "Awatif Adam", rel: "Mother" },
  { c: "p11b", first: "Sophia",   last: "Karam",       gender: "female", nat: "Lebanese",    g: "Georges Karam", rel: "Father" },
  { c: "p11b", first: "Talal",    last: "Al Yammahi",  gender: "male",   nat: "Emirati",     g: "H. Al Yammahi", rel: "Father" },
  { c: "p11b", first: "Meera",    last: "Iyer",        gender: "female", nat: "Indian",      g: "Vinod Iyer", rel: "Father" },
  { c: "p11b", first: "Hamdan",   last: "Al Kaabi",    gender: "male",   nat: "Emirati",     g: "R. Al Kaabi", rel: "Mother" },

  // ── Mathematics 10A ───────────────────────────────────────────────
  { c: "m10a", first: "Noura",    last: "Al Shamsi",   gender: "female", nat: "Emirati",     g: "T. Al Shamsi", rel: "Father" },
  { c: "m10a", first: "Aditya",   last: "Rao",         gender: "male",   nat: "Indian",      g: "Lakshmi Rao", rel: "Mother" },
  { c: "m10a", first: "Salma",    last: "El Sayed",    gender: "female", nat: "Egyptian",    g: "Tarek El Sayed", rel: "Father" },
  { c: "m10a", first: "Bilal",    last: "Rahman",      gender: "male",   nat: "Pakistani",   g: "Ayesha Rahman", rel: "Mother" },
  { c: "m10a", first: "Reem",     last: "Al Dhaheri",  gender: "female", nat: "Emirati",     g: "F. Al Dhaheri", rel: "Father" },
  { c: "m10a", first: "Lucas",    last: "Bernard",     gender: "male",   nat: "French",      g: "Camille Bernard", rel: "Mother" },
  { c: "m10a", first: "Aisha",    last: "Balogun",     gender: "female", nat: "Nigerian",    g: "Tunde Balogun", rel: "Father" },
  { c: "m10a", first: "Saif",     last: "Al Nuaimi",   gender: "male",   nat: "Emirati",     g: "W. Al Nuaimi", rel: "Father" },
];

/**
 * A repeating week. `dow` is 1 = Monday … 5 = Friday — the UAE moved to
 * a Monday–Friday school week in 2022, so a Sunday lesson would be the
 * kind of wrong detail a teacher notices immediately.
 */
export const TIMETABLE = [
  { dow: 1, c: "p9a",  start: "08:00", end: "08:50", room: "Lab 2",   title: "Forces and motion" },
  { dow: 1, c: "m10a", start: "10:20", end: "11:10", room: "Room 214", title: "Quadratic functions" },
  { dow: 2, c: "p11b", start: "09:00", end: "09:50", room: "Lab 1",   title: "Circular motion" },
  { dow: 2, c: "p9a",  start: "11:20", end: "12:10", room: "Lab 2",   title: "Forces and motion" },
  { dow: 3, c: "m10a", start: "08:00", end: "08:50", room: "Room 214", title: "Quadratic functions" },
  { dow: 3, c: "p11b", start: "12:20", end: "13:10", room: "Lab 1",   title: "Circular motion" },
  { dow: 4, c: "p9a",  start: "09:00", end: "09:50", room: "Lab 2",   title: "Practical: friction" },
  { dow: 4, c: "m10a", start: "13:20", end: "14:10", room: "Room 214", title: "Problem clinic" },
  { dow: 5, c: "p11b", start: "08:00", end: "08:50", room: "Lab 1",   title: "Past-paper workshop" },
];

/** Lesson titles rotate week to week so the calendar is not one word repeated. */
export const LESSON_ROTATION = {
  p9a: [
    "Balanced and unbalanced forces",
    "Newton's second law",
    "Practical: measuring friction",
    "Terminal velocity",
    "Momentum and collisions",
    "Forces revision clinic",
  ],
  p11b: [
    "Angular velocity",
    "Centripetal force derivation",
    "Banked tracks and cornering",
    "Practical: conical pendulum",
    "Gravitation and orbits",
    "Circular motion past papers",
  ],
  m10a: [
    "Completing the square",
    "The quadratic formula",
    "Sketching parabolas",
    "Simultaneous equations, one quadratic",
    "Modelling with quadratics",
    "Quadratics assessment review",
  ],
};

/**
 * The library, spread over the last nine weeks.
 *
 * `w` is how many weeks ago it was made — the dashboard's activity chart
 * buckets by week, so a pile all created today would draw a single spike
 * and tell you nothing about whether the shape works.
 */
export const ARTIFACTS = [
  // ── lesson plans ──────────────────────────────────────────────────
  {
    type: "lesson_plan", w: 8, status: "complete",
    content: {
      title: "Balanced and unbalanced forces",
      subject: "Physics", grade: "Grade 9", duration: 50,
      objectives: [
        "Identify the forces acting on a stationary and a moving object",
        "Predict motion from a free-body diagram",
        "Explain why a constant speed does not mean zero force",
      ],
      stages: [
        { name: "Starter", note: "Trolley on the bench — why does it stop? Two minutes, pairs." },
        { name: "Direct instruction", note: "Free-body diagrams on the board, three worked examples." },
        { name: "Practical", note: "Newton meters and the friction ramp, in fours." },
        { name: "Exit ticket", note: "Draw the forces on a parachutist at terminal velocity." },
      ],
      materials: ["Dynamics trolleys", "Newton meters", "Friction ramp", "Exit ticket slips"],
    },
  },
  {
    type: "lesson_plan", w: 6, status: "complete",
    content: {
      title: "Newton's second law", subject: "Physics", grade: "Grade 9", duration: 50,
      objectives: ["State F = ma", "Rearrange for any unknown", "Use consistent SI units"],
      stages: [
        { name: "Recall", note: "Last lesson's exit tickets — the two most common errors." },
        { name: "Derivation", note: "Build F = ma from the trolley data they collected." },
        { name: "Practice", note: "Six graded problems, self-marked from the answer sheet." },
      ],
      materials: ["Trolley data sheet", "Problem set A"],
    },
  },
  {
    type: "lesson_plan", w: 4, status: "complete",
    content: {
      title: "Completing the square", subject: "Mathematics", grade: "Grade 10", duration: 50,
      objectives: ["Complete the square for a monic quadratic", "Read the vertex from completed-square form"],
      stages: [
        { name: "Starter", note: "Expand three brackets — spot the pattern in the constant." },
        { name: "Modelling", note: "Two worked examples, then one with a leading coefficient." },
        { name: "Independent", note: "Textbook 6C, questions 1 to 12." },
      ],
      materials: ["Textbook 6C", "Mini whiteboards"],
    },
  },
  {
    type: "lesson_plan", w: 2, status: "complete",
    content: {
      title: "Centripetal force derivation", subject: "Physics", grade: "Grade 11", duration: 50,
      objectives: ["Derive a = v²/r", "Apply it to a car on a bend", "Distinguish centripetal from centrifugal"],
      stages: [
        { name: "Hook", note: "Bucket of water over the head. Nobody gets wet, hopefully." },
        { name: "Derivation", note: "Vector triangle on the board, step by step." },
        { name: "Application", note: "Corner-speed problem set, IB style." },
      ],
      materials: ["Bucket and rope", "Problem set: circular motion"],
    },
  },
  {
    // Half-written, so "Needs you" has something real to point at.
    type: "lesson_plan", w: 0, status: "complete",
    content: {
      title: "Momentum and collisions", subject: "Physics", grade: "Grade 9",
      duration: 50, progress: 45,
      objectives: ["Calculate momentum", "Apply conservation to a one-dimensional collision"],
      stages: [{ name: "Starter", note: "Two trolleys, one collision, predict before you measure." }],
    },
  },

  // ── reusable templates ────────────────────────────────────────────
  {
    type: "template", w: 9, status: "complete",
    content: {
      name: "Practical lesson — measure, plot, conclude",
      subject: "Physics", grade: "Grade 9", duration: 50, used_count: 11,
      tags: ["practical", "data", "physics"],
      objectives: ["Take repeat readings", "Plot with a line of best fit", "Draw a conclusion the data supports"],
      stages: [
        { name: "Safety and setup", note: "Five minutes. Goggles on before anything is switched on." },
        { name: "Measure", note: "Three repeats per point, tabulated as you go." },
        { name: "Plot", note: "Axes labelled with units, line of best fit by eye." },
        { name: "Conclude", note: "One sentence the graph actually supports." },
      ],
    },
  },
  {
    type: "template", w: 7, status: "complete",
    content: {
      name: "Exam technique clinic",
      subject: "Mathematics", grade: "Grade 10", duration: 50, used_count: 6,
      tags: ["revision", "exam", "maths"],
      objectives: ["Read the command word", "Show method that earns marks", "Check by substitution"],
      stages: [
        { name: "Diagnostic", note: "Last paper's lowest-scoring question, cold." },
        { name: "Mark scheme walk", note: "Where the method marks actually sit." },
        { name: "Redo", note: "Same question again, under time." },
      ],
    },
  },

  // ── quizzes ───────────────────────────────────────────────────────
  {
    type: "quiz", w: 5, status: "complete", key: "quizForces",
    content: {
      title: "Forces and motion — end of unit",
      subject: "Physics", grade: "Grade 9", duration_minutes: 30, scheduled_in: -12,
      questions: [
        { position: 1, type: "mcq", marks: 1, prompt: "A car travels at a constant 60 km/h in a straight line. The resultant force on it is:",
          choices: ["Zero", "Forwards and constant", "Backwards and constant", "Increasing"], correct_answer: "Zero" },
        { position: 2, type: "mcq", marks: 1, prompt: "The SI unit of force is the:",
          choices: ["Joule", "Newton", "Watt", "Pascal"], correct_answer: "Newton" },
        { position: 3, type: "mcq", marks: 2, prompt: "A 4 kg mass accelerates at 3 m/s². The resultant force is:",
          choices: ["0.75 N", "7 N", "12 N", "1.33 N"], correct_answer: "12 N" },
        { position: 4, type: "short", marks: 3,
          prompt: "Explain why a skydiver reaches terminal velocity.",
          correct_answer: "Drag increases with speed until it balances weight; with zero resultant force the acceleration is zero and the speed stays constant." },
        { position: 5, type: "short", marks: 4,
          prompt: "A 1200 kg car brakes from 20 m/s to rest in 5 s. Calculate the braking force and state one assumption.",
          correct_answer: "a = -4 m/s², F = 4800 N opposing motion. Assumes constant deceleration." },
      ],
    },
  },
  {
    type: "quiz", w: 3, status: "complete",
    content: {
      title: "Quadratics — mid-unit check",
      subject: "Mathematics", grade: "Grade 10", duration_minutes: 25, scheduled_in: -9,
      questions: [
        { position: 1, type: "mcq", marks: 1, prompt: "The discriminant of x² − 6x + 9 is:",
          choices: ["0", "36", "−36", "72"], correct_answer: "0" },
        { position: 2, type: "mcq", marks: 2, prompt: "x² − 6x + 11 in completed-square form is:",
          choices: ["(x − 3)² + 2", "(x − 3)² − 2", "(x + 3)² + 2", "(x − 6)² + 11"], correct_answer: "(x − 3)² + 2" },
        { position: 3, type: "short", marks: 3, prompt: "Solve 2x² + 5x − 3 = 0.",
          correct_answer: "x = 1/2 or x = −3" },
        { position: 4, type: "short", marks: 2, prompt: "State the coordinates of the vertex of y = (x + 4)² − 7.",
          correct_answer: "(−4, −7)" },
      ],
    },
  },
  {
    // Deliberately empty: the dashboard raises "add questions to…" for
    // exactly this, and an unexercised branch is an unverified one.
    type: "quiz", w: 0, status: "complete",
    content: { title: "Circular motion — quick check", subject: "Physics", grade: "Grade 11", scheduled_in: 4, questions: [] },
  },

  // ── homework ──────────────────────────────────────────────────────
  {
    type: "homework", w: 4, status: "complete", key: "hwForces",
    content: {
      title: "Free-body diagrams — worksheet 3",
      subject: "Physics", grade: "Grade 9", section: "A", due_in_days: -3,
      instructions:
        "Complete all six diagrams. Label every force with its name and an arrow " +
        "whose length reflects its size. Question 6 is the stretch — attempt it, " +
        "and write one line about what you found hard if you get stuck.",
      tasks: [
        "Book resting on a table",
        "Book being pushed at constant speed",
        "Lift accelerating upwards",
        "Parachutist before the chute opens",
        "Parachutist at terminal velocity",
        "Car on a banked track (stretch)",
      ],
    },
  },
  {
    type: "homework", w: 1, status: "complete",
    content: {
      title: "Quadratics consolidation — Exercise 6C",
      subject: "Mathematics", grade: "Grade 10", section: "A", due_in_days: 2,
      instructions: "Questions 1 to 15. Show the completed-square step; an answer alone earns one mark of three.",
      tasks: ["6C questions 1–8", "6C questions 9–15", "Check answers at the back and flag anything you disagree with"],
    },
  },
  {
    type: "homework", w: 0, status: "generating",
    content: { title: "Circular motion problem set", subject: "Physics", grade: "Grade 11" },
  },

  // ── presentations ─────────────────────────────────────────────────
  {
    type: "presentation", w: 6, status: "complete",
    content: {
      title: "Forces around us", subject: "Physics", grade: "Grade 9", scheduled_in: -11,
      slides: [
        { title: "What is a force?",
          bullets: ["A push or a pull", "Measured in newtons (N)", "Has size and direction"],
          notes: "Ask for three examples from the room before the next slide." },
        { title: "Balanced forces",
          bullets: ["Equal and opposite", "Resultant force is zero", "Object stays still, or keeps a constant velocity"],
          notes: "The constant-velocity case is the one they get wrong." },
        { title: "Unbalanced forces",
          bullets: ["Resultant is not zero", "The object accelerates", "Acceleration is in the direction of the resultant"] },
        { title: "Free-body diagrams",
          bullets: ["One dot for the object", "One arrow per force", "Arrow length shows the size"],
          notes: "Draw the book-on-table together, then set the lift as practice." },
        { title: "Terminal velocity",
          bullets: ["Drag grows with speed", "Eventually drag equals weight", "Zero resultant, constant speed"],
          notes: "Come back to the parachutist from the starter." },
        { title: "Your turn",
          bullets: ["Worksheet 3, questions 1 to 5", "Diagrams labelled with units", "Question 6 is the stretch"] },
      ],
    },
  },
  {
    type: "presentation", w: 2, status: "complete",
    content: {
      title: "Going round in circles", subject: "Physics", grade: "Grade 11", scheduled_in: 2,
      slides: [
        { title: "Circular motion", bullets: ["Constant speed, changing velocity", "Velocity is a vector", "Changing velocity means acceleration"] },
        { title: "Angular velocity", bullets: ["ω = θ / t", "Measured in rad/s", "v = ωr"] },
        { title: "Centripetal acceleration", bullets: ["a = v² / r", "Directed towards the centre", "Not a new force — a resultant"],
          notes: "Kill the word 'centrifugal' here, firmly." },
        { title: "Where the force comes from", bullets: ["Tension for a conical pendulum", "Friction for a car on a flat bend", "Gravity for an orbit"] },
        { title: "Worked example", bullets: ["1200 kg car, 15 m/s, 40 m radius", "a = 5.6 m/s²", "F = 6750 N — can the tyres supply it?"] },
      ],
    },
  },
  {
    type: "presentation", w: 0, status: "generating",
    content: { title: "Momentum in collisions", subject: "Physics", grade: "Grade 9" },
  },

  // ── activities ────────────────────────────────────────────────────
  {
    type: "activity", w: 7, status: "complete",
    content: {
      title: "Friction ramp investigation", subject: "Physics", grade: "Grade 9", duration_minutes: 40, scheduled_in: -14,
      instructions:
        "In fours. Vary the surface, keep the mass and the angle fixed, and find " +
        "the angle at which the block just begins to slide. Three repeats per " +
        "surface. One person records, and the role rotates every surface.",
      items: ["Wooden ramp and protractor", "Blocks: wood, felt, rubber, sandpaper", "Results table (printed)", "Goggles"],
    },
  },
  {
    type: "activity", w: 3, status: "complete",
    content: {
      title: "Parabola card sort", subject: "Mathematics", grade: "Grade 10", duration_minutes: 25, scheduled_in: -9,
      instructions:
        "Match each equation to its sketch and to its vertex. Two of the cards " +
        "have no partner — find them and explain why.",
      items: ["Equation cards ×12", "Sketch cards ×12", "Vertex cards ×12", "Sorting mat"],
    },
  },
  {
    type: "activity", w: 1, status: "complete",
    content: {
      title: "Conical pendulum station", subject: "Physics", grade: "Grade 11", duration_minutes: 45, scheduled_in: 3,
      progress: 70,
      instructions:
        "Time twenty revolutions and divide — a single revolution has too much " +
        "reaction time in it. Compare the measured period against the predicted one " +
        "and account for the difference.",
      items: ["Bung and string", "Glass tube and washers", "Stopwatch", "Metre rule"],
    },
  },
];

/** Uploaded source material, the input side of the studio. */
export const MATERIALS = [
  { name: "Physics G9 — Unit 3 Forces (MoE).pdf", mime: "application/pdf", w: 8,
    text: "Unit 3: Forces and Motion. Learning outcomes, suggested practicals and the end-of-unit assessment grid." },
  { name: "IB Physics — Topic 6 Circular Motion.pdf", mime: "application/pdf", w: 5,
    text: "Topic 6.1 Circular motion, 6.2 Newton's law of gravitation. Guidance, syllabus statements and command terms." },
  { name: "Maths G10 — Chapter 6 Quadratics.pdf", mime: "application/pdf", w: 4,
    text: "Chapter 6: Quadratic functions. Exercises 6A to 6F with answers." },
  { name: "Term 1 scheme of work.docx", w: 9,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    text: "Weekly coverage for Physics 9, Physics 11 and Mathematics 10 across Term 1." },
];

/** Two goals — one the planner has finished with, one still thinking. */
export const GOALS = [
  {
    title: "Teach the whole of Grade 9 Forces in six weeks",
    timeline_days: 42, status: "active", w: 5,
    ai_verdict:
      "Achievable in six weeks at four lessons a week, but the practical work is " +
      "the constraint rather than the content. Two double periods are needed for " +
      "the friction investigation and the momentum trolleys; without them the " +
      "practicals compress into demonstrations and the assessment's skills " +
      "criteria cannot be met.",
    plan: {
      weeks: [
        { week: 1, focus: "Forces as vectors", lessons: ["Balanced and unbalanced forces", "Free-body diagrams"], assessment: "Exit tickets" },
        { week: 2, focus: "Newton's laws", lessons: ["Newton's second law", "Problem practice"], assessment: "Problem set A" },
        { week: 3, focus: "Friction", lessons: ["Practical: measuring friction", "Analysis and write-up"], assessment: "Practical write-up" },
        { week: 4, focus: "Falling", lessons: ["Terminal velocity", "Graph interpretation"], assessment: "Graph task" },
        { week: 5, focus: "Momentum", lessons: ["Momentum and collisions", "Conservation problems"], assessment: "Problem set B" },
        { week: 6, focus: "Consolidation", lessons: ["Revision clinic", "End-of-unit test"], assessment: "End of unit test" },
      ],
      risks: [
        "Lab 2 is shared with Chemistry on Thursdays — book the double period early",
        "Six students joined after the baseline test and have no prior data",
      ],
    },
  },
  {
    title: "Get 11B ready for the January IB mock",
    timeline_days: 70, status: "processing", w: 0,
    plan: null, ai_verdict: null,
  },
];

/** What the teacher's own practice looks like to the planner. */
export const SKILLS = [
  {
    name: "Inquiry-led practical physics", source_type: "cv", status: "ready", w: 6,
    skill_profile:
      "Strongest in practical design and in turning data into an argument. Plans " +
      "consistently open with a phenomenon rather than a definition, and " +
      "assessment leans on explanation over recall. Works best with a double " +
      "period; single periods tend to lose the analysis stage.",
  },
  {
    name: "Exam-technique coaching (IB and MoE)", source_type: "upload", status: "ready", w: 3,
    skill_profile:
      "Detailed knowledge of both mark schemes and of where method marks sit. " +
      "Tends to teach command words explicitly. Less time spent on content " +
      "recovery, which suits a class already near the grade boundary.",
  },
];

/** Unread bell items — recent, and each one about something that exists. */
export const NOTIFICATIONS = [
  { kind: "reminder", hours: 3,  title: "Physics 9A homework was due yesterday",
    body: "Nineteen of twenty-six have submitted Free-body diagrams — worksheet 3.", link: "/homework" },
  { kind: "system",   hours: 20, title: "Your trial has 12 days left",
    body: "Plans start at AED 49 a month. Nothing you have made will be locked.", link: "/account" },
  { kind: "activity", hours: 30, title: "Quadratics — mid-unit check has been marked",
    body: "Class mean 71%. Question 3 was the weakest, at 44%.", link: "/quizzes" },
  { kind: "reminder", hours: 54, title: "Lab 2 is double-booked on Thursday",
    body: "Chemistry has the 09:00 slot. Practical: friction may need moving.", link: "/schedule" },
];

/** Studio threads, so the Recent rail has a history worth scrolling. */
export const THREADS = [
  {
    days: 0, title: "A 45-minute Grade 9 lesson on momentum with a trolley practical",
    turns: [
      { role: "user", content: "A 45-minute Grade 9 lesson on momentum with a trolley practical. They have done forces already." },
      { role: "assistant", kind: "lesson_plan",
        content: "Here is a 45-minute plan that opens with the collision rather than the formula — they predict, then measure, then reconcile the two." },
    ],
  },
  {
    days: 1, title: "Ten questions on quadratics for Grade 10 — word problems, not plug-and-chug",
    turns: [
      { role: "user", content: "Ten questions on quadratics for Grade 10 — word problems, not plug-and-chug." },
      { role: "assistant", kind: "quiz",
        content: "Ten questions, each set in a context that has to be modelled first. Answers and method marks included." },
    ],
  },
  {
    days: 3, title: "An 8-slide deck introducing circular motion for Grade 11 IB",
    turns: [
      { role: "user", content: "An 8-slide deck introducing circular motion for Grade 11 IB." },
      { role: "assistant", kind: "presentation",
        content: "Eight slides, ending on the corner-speed worked example so the maths lands on something physical." },
    ],
  },
  {
    days: 6, title: "Rewrite the friction practical for a single period",
    turns: [
      { role: "user", content: "Rewrite the friction practical so it fits a single period instead of a double." },
      { role: "assistant", kind: "activity",
        content: "Cut to two surfaces with the results table pre-printed. The analysis moves to homework, which is where it survives the squeeze best." },
    ],
  },
];
