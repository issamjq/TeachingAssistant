// =====================================================================
// The fixed data every studio design variant renders
//
// Ten designs are only comparable if they are showing the SAME thing. So
// none of them fetch, none of them generate, and none of them hold state
// that changes what is on screen — they all read this file and lay it
// out differently. What differs between /preview1 and /preview10 is the
// design, and nothing else.
//
// It carries the WHOLE screen, not just the answer: the teacher's
// sidebar exactly as src/config/nav.ts defines it, the conversation
// history, the usage data around the edges — and TWO complete sessions,
// so every design has to show what switching to an older conversation
// actually looks like rather than pretending the studio only ever holds
// one.
// =====================================================================

export type Kind = "lesson_plan" | "quiz" | "homework" | "presentation" | "activity";

export const KIND_LABEL: Record<Kind, string> = {
  lesson_plan: "Lesson plan",
  quiz: "Quiz",
  homework: "Homework",
  presentation: "Presentation",
  activity: "Activity",
};

/* ── the sidebar ──────────────────────────────────────────────────── */
// Mirrors TEACHER_NAV in src/config/nav.ts — same groups, same order,
// same labels. A preview of the studio that invents its own navigation
// is a preview of a different product.

export type NavItem = { key: string; label: string; icon: string; badge?: number };
export type NavGroup = { section: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    section: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "studio", label: "AI Studio", icon: "studio" },
    ],
  },
  {
    section: "Planners",
    items: [
      { key: "planner", label: "Scheduler", icon: "scheduler" },
      { key: "goals", label: "Goal planner", icon: "goals" },
      { key: "lesson-plans", label: "Lessons", icon: "lessons", badge: 34 },
      { key: "quizzes", label: "Quizzes & exams", icon: "quizzes", badge: 28 },
      { key: "homework", label: "Homework", icon: "homework", badge: 17 },
      { key: "presentations", label: "Presentations", icon: "presentations", badge: 21 },
      { key: "activities", label: "Activities", icon: "activities", badge: 12 },
      { key: "bulletin-board", label: "Bulletin board", icon: "bulletin" },
    ],
  },
  {
    section: "Teacher",
    items: [
      { key: "database", label: "My students", icon: "students" },
      { key: "teaching-skills", label: "Teaching skills", icon: "skills" },
      { key: "reports", label: "Reports", icon: "reports" },
    ],
  },
];

/** The section the previews are standing in. */
export const ACTIVE_NAV = "studio";

/* ── who is looking at the screen ─────────────────────────────────── */

export const teacher = {
  name: "Layla Haddad",
  initials: "LH",
  role: "Grade 7 Science",
  school: "Al Noor International School",
  city: "Dubai",
  plan: "Studio · Annual",
  creditsUsed: 412,
  creditsTotal: 1000,
};

/* ── the shapes a session is made of ──────────────────────────────── */

export type Phase = { n: string; name: string; minutes: number; body: string; teacher: string };

export type Slide = {
  n: number;
  title: string;
  bullets: string[];
  notes: string;
  /** Seed for the generated artwork — same seed, same picture, every variant. */
  art: string;
  layout: "cover" | "split" | "full" | "list" | "quote";
};

export type Question = {
  q: string;
  options: string[];
  answer: number;
  why: string;
  difficulty: string;
};

export type Session = {
  id: string;
  /** What the history rail shows. */
  title: string;
  when: string;
  turns: number;
  live: boolean;
  grade: string;
  subject: string;
  /** Which kinds this session produced — drives the rail's little markers. */
  made: Kind[];
  prompt: {
    text: string;
    at: string;
    attachments: { name: string; pages: number; size: string }[];
    skills: string[];
  };
  run: {
    model: string;
    stages: { label: string; detail: string; ms: number }[];
    totalSeconds: number;
    credits: number;
    grounding: string[];
    /** Wall-clock stamps, so a design that shows a log can show a real one. */
    clock: string[];
  };
  /** The prose outcome — a lesson plan in one session, an activity in the other. */
  plan: {
    kind: Kind;
    title: string;
    subject: string;
    grade: string;
    duration: string;
    outcomes: string[];
    materials: string[];
    phases: Phase[];
    differentiation: { support: string; stretch: string; ell: string };
  };
  deck: { kind: Kind; title: string; subtitle: string; slides: Slide[] };
  /** The question outcome — a quiz in one session, homework in the other. */
  check: {
    kind: Kind;
    title: string;
    grade: string;
    marks: number;
    minutes: number;
    questions: Question[];
  };
};

/* ═══ session one · photosynthesis ════════════════════════════════ */

const photosynthesis: Session = {
  id: "s-4f2a",
  title: "Photosynthesis — the leaf as a factory",
  when: "just now",
  turns: 4,
  live: true,
  grade: "Grade 7",
  subject: "Science",
  made: ["lesson_plan", "presentation", "quiz"],
  prompt: {
    text: "A 45-minute Grade 7 lesson on photosynthesis — hands-on starter, a check for understanding halfway, and an exit ticket. Then turn it into a deck I can project, and a quiz I can set as homework.",
    at: "09:42",
    attachments: [
      { name: "Grade-7-Science-Ch4-Photosynthesis.pdf", pages: 14, size: "2.4 MB" },
      { name: "MoE-Science-Outcomes-2026.pdf", pages: 3, size: "310 KB" },
    ],
    skills: ["Inquiry-first openings", "Bilingual key terms"],
  },
  run: {
    model: "Murchid · Curriculum",
    stages: [
      { label: "Read the attachments", detail: "17 pages", ms: 2100 },
      { label: "Matched MoE outcomes", detail: "3 of 3", ms: 900 },
      { label: "Planned the lesson", detail: "6 phases", ms: 4300 },
      { label: "Built the deck", detail: "8 slides", ms: 6800 },
      { label: "Wrote the quiz", detail: "6 questions", ms: 3100 },
    ],
    totalSeconds: 17.2,
    credits: 3,
    grounding: ["Ch. 4, pp. 61–74", "MoE SCI.7.3.a–c"],
    clock: ["09:42:03", "09:42:05", "09:42:06", "09:42:10", "09:42:17"],
  },
  plan: {
    kind: "lesson_plan",
    title: "Photosynthesis — the leaf as a factory",
    subject: "Science",
    grade: "Grade 7",
    duration: "45 minutes",
    outcomes: [
      "Explain photosynthesis as an energy conversion, not a food-delivery.",
      "Identify the three inputs and two outputs from a labelled diagram.",
      "Predict what happens to a plant when one input is removed.",
    ],
    materials: ["Elodea sprigs + beakers", "Desk lamp ×6", "Sodium bicarbonate", "Exit-ticket slips"],
    phases: [
      {
        n: "01",
        name: "Starter — the sealed jar",
        minutes: 7,
        body: "Show a sealed jar with a living plant that has been closed for a year. Ask the one question that does the work: where is the plant getting its food? Take three answers, write all three on the board, correct none of them yet.",
        teacher: "Ask, don't tell. The wrong answers are the lesson.",
      },
      {
        n: "02",
        name: "Build the equation",
        minutes: 10,
        body: "Work from what they already said towards CO₂ + H₂O + light → glucose + O₂. Put the Arabic term (البناء الضوئي) beside the English one on the board and keep both there for the rest of the lesson.",
        teacher: "Watch for 'plants eat soil' — it survives this age reliably.",
      },
      {
        n: "03",
        name: "Hands-on — counting bubbles",
        minutes: 14,
        body: "In pairs: elodea in bicarbonate solution, lamp at 10 cm, count oxygen bubbles for one minute. Move the lamp to 30 cm and count again. Two numbers per pair, on the board.",
        teacher: "Groups of two, not four. Four means two watching.",
      },
      {
        n: "04",
        name: "Check for understanding",
        minutes: 6,
        body: "Thumbs up / thumbs down on four claims, one of which is the soil misconception. If more than a third get it wrong, re-run the equation before moving on.",
        teacher: "This is the halfway gate. Do not skip it to save time.",
      },
      {
        n: "05",
        name: "Apply — the greenhouse problem",
        minutes: 5,
        body: "A grower wants more tomatoes. Give them light, CO₂ and water as levers and ask which one they would spend money on first, and why.",
        teacher: "There is no single right answer. Score the reasoning.",
      },
      {
        n: "06",
        name: "Exit ticket",
        minutes: 3,
        body: "One slip, one line: 'A plant in a dark cupboard still dies even with plenty of water. Why?'",
        teacher: "Read these before tomorrow — they set the starter.",
      },
    ],
    differentiation: {
      support: "Provide the equation as a cut-up card sort rather than blank recall.",
      stretch: "Ask for the limiting-factor graph shape before it is taught.",
      ell: "Key terms pre-loaded in Arabic and English on the wall card.",
    },
  },
  deck: {
    kind: "presentation",
    title: "The leaf as a factory",
    subtitle: "Grade 7 Science · Photosynthesis",
    slides: [
      {
        n: 1,
        title: "The leaf as a factory",
        bullets: ["Grade 7 Science", "Ms. Haddad · Al Noor International"],
        notes: "Leave this up while they settle. Don't start talking over it.",
        art: "cover-leaf",
        layout: "cover",
      },
      {
        n: 2,
        title: "A jar, sealed for a year",
        bullets: ["The plant is alive.", "Nothing went in.", "So where is the food coming from?"],
        notes: "Take three answers. Write all three down. Correct none of them yet.",
        art: "sealed-jar",
        layout: "full",
      },
      {
        n: 3,
        title: "Three things in, two things out",
        bullets: ["In — carbon dioxide, water, light", "Out — glucose, oxygen", "البناء الضوئي"],
        notes: "Keep both languages on the board for the rest of the lesson.",
        art: "equation",
        layout: "split",
      },
      {
        n: 4,
        title: "Inside the leaf",
        bullets: ["Chloroplasts hold the chlorophyll", "Chlorophyll catches the light", "Stomata let the gas move"],
        notes: "Point at the diagram, not at the slide title.",
        art: "cell-cross",
        layout: "split",
      },
      {
        n: 5,
        title: "Counting bubbles",
        bullets: ["Elodea, bicarbonate, one lamp", "Lamp at 10 cm — count for a minute", "Lamp at 30 cm — count again"],
        notes: "Pairs, not fours. Two numbers per pair on the board.",
        art: "bubbles",
        layout: "list",
      },
      {
        n: 6,
        title: "What the numbers said",
        bullets: ["Closer lamp, more bubbles", "Light is a limiting factor", "Take one input away and the rate falls"],
        notes: "Use their real numbers, not the ones on the slide.",
        art: "rate-curve",
        layout: "split",
      },
      {
        n: 7,
        title: "A grower wants more tomatoes",
        bullets: ["More light?", "More carbon dioxide?", "More water?", "Which would you pay for first?"],
        notes: "No single right answer. Score the reasoning.",
        art: "greenhouse",
        layout: "list",
      },
      {
        n: 8,
        title: "Before you go",
        bullets: ["A plant in a dark cupboard, watered daily, still dies.", "One line. Why?"],
        notes: "Read these tonight — they set tomorrow's starter.",
        art: "exit-ticket",
        layout: "quote",
      },
    ],
  },
  check: {
    kind: "quiz",
    title: "Photosynthesis — check for understanding",
    grade: "Grade 7",
    marks: 6,
    minutes: 15,
    // The correct answer deliberately moves around the four positions. An
    // answer key that reads B B B B B B is the first thing that makes a
    // sample quiz look generated.
    questions: [
      {
        q: "Which pair are the raw materials a plant takes IN during photosynthesis?",
        options: ["Glucose and oxygen", "Oxygen and nitrogen", "Carbon dioxide and water", "Sugar and minerals"],
        answer: 2,
        why: "Glucose and oxygen are the outputs — that first option is the most common slip.",
        difficulty: "Recall",
      },
      {
        q: "A plant is kept well watered in a dark cupboard for two weeks. It dies. Why?",
        options: [
          "It ran out of water",
          "The soil lost its minerals",
          "It could not breathe in the dark",
          "It could not carry out photosynthesis without light",
        ],
        answer: 3,
        why: "Directly mirrors the exit ticket, so the homework rehearses the lesson.",
        difficulty: "Apply",
      },
      {
        q: "In the bubble experiment, moving the lamp from 10 cm to 30 cm made the bubble count fall. What does that show?",
        options: [
          "Less light means a slower rate of photosynthesis",
          "The plant got tired",
          "The water got colder",
          "Oxygen dissolved faster",
        ],
        answer: 0,
        why: "Ties the number they wrote on the board to the idea.",
        difficulty: "Analyse",
      },
      {
        q: "Where in the leaf does photosynthesis mostly happen?",
        options: ["In the roots", "In the stem", "In the chloroplasts", "On the leaf surface"],
        answer: 2,
        why: "Straight recall — put it here so the paper does not open hard.",
        difficulty: "Recall",
      },
      {
        q: "Which statement about a plant's food is correct?",
        options: [
          "A plant takes its food ready-made from the soil",
          "A plant makes its own food using light energy",
          "A plant absorbs food through its leaves from the air",
          "A plant only needs water to make food",
        ],
        answer: 1,
        why: "The soil misconception, asked once more in plain words.",
        difficulty: "Recall",
      },
      {
        q: "A grower can add EITHER more light OR more carbon dioxide to a greenhouse already bright at midday. Which is more likely to raise the yield, and why?",
        options: [
          "More light — plants always want more light",
          "Neither will change anything",
          "Both would have exactly the same effect",
          "More carbon dioxide — light is unlikely to be the limiting factor at midday",
        ],
        answer: 3,
        why: "The stretch question. Score the reasoning, not the letter.",
        difficulty: "Evaluate",
      },
    ],
  },
};

/* ═══ session two · states of matter ══════════════════════════════ */
// The second conversation in the rail, and the reason it is here: it is
// a DIFFERENT shape of work. An activity rather than a lesson plan,
// homework rather than a quiz, a shorter deck, a different grade. A
// design that only looks right on the first session is not finished.

const statesOfMatter: Session = {
  id: "s-31c8",
  title: "States of matter — the card sort",
  when: "Yesterday · 16:20",
  turns: 6,
  live: false,
  grade: "Grade 6",
  subject: "Science",
  made: ["activity", "presentation", "homework"],
  prompt: {
    text: "My Grade 6 class cannot hold on to particle arrangement. Build me a 25-minute card-sort activity they do in fours, a short deck to set it up, and homework that makes them explain it in their own words.",
    at: "16:20",
    attachments: [{ name: "G6-Term2-Matter-Unit.pdf", pages: 9, size: "1.1 MB" }],
    skills: ["Misconception-first", "Group roles"],
  },
  run: {
    model: "Murchid · Curriculum",
    stages: [
      { label: "Read the attachment", detail: "9 pages", ms: 1400 },
      { label: "Found the misconception", detail: "particle spacing", ms: 1100 },
      { label: "Built the activity", detail: "5 phases", ms: 3600 },
      { label: "Built the deck", detail: "6 slides", ms: 4900 },
      { label: "Wrote the homework", detail: "4 tasks", ms: 2200 },
    ],
    totalSeconds: 13.2,
    credits: 3,
    grounding: ["Unit 2, pp. 18–26", "MoE SCI.6.1.b"],
    clock: ["16:20:11", "16:20:12", "16:20:14", "16:20:17", "16:20:24"],
  },
  plan: {
    kind: "activity",
    title: "States of matter — the card sort",
    subject: "Science",
    grade: "Grade 6",
    duration: "25 minutes",
    outcomes: [
      "Sort particle diagrams by state without being told which is which.",
      "Justify a sort using spacing and movement, not shape of container.",
      "Correct the 'particles get bigger when heated' misconception aloud.",
    ],
    materials: ["Card sort packs ×8", "Whiteboard markers", "Sand timer", "Role cards"],
    phases: [
      {
        n: "01",
        name: "Hand out, say nothing",
        minutes: 3,
        body: "One pack per four. No instructions beyond 'put these into groups that make sense to you'. Do not say the words solid, liquid or gas.",
        teacher: "The silence is the method. Resist rescuing them.",
      },
      {
        n: "02",
        name: "Sort and defend",
        minutes: 8,
        body: "Each four decides its own grouping rule and writes it on the whiteboard in one sentence. Assign roles: sorter, scribe, timekeeper, challenger.",
        teacher: "The challenger role is what stops one child doing all four jobs.",
      },
      {
        n: "03",
        name: "The swap",
        minutes: 6,
        body: "Groups rotate one table clockwise and try to work out the rule the previous group used, without seeing the sentence. Then they read it.",
        teacher: "This is where the wrong rules surface. Let them.",
      },
      {
        n: "04",
        name: "Name the three",
        minutes: 5,
        body: "Only now put solid, liquid and gas on the board, and map them onto whichever sorts already match. Correct the ones that do not.",
        teacher: "Name it after they built it, never before.",
      },
      {
        n: "05",
        name: "The heated-particle trap",
        minutes: 3,
        body: "Show two diagrams: same particles, one spread wider. Ask whether the particles got bigger or just further apart. Take a vote, then settle it.",
        teacher: "Roughly half will say bigger. That is the whole point of the lesson.",
      },
    ],
    differentiation: {
      support: "Give the support packs — six cards instead of twelve, no gas edge cases.",
      stretch: "Add the plasma card and let them argue about where it goes.",
      ell: "Cards are diagram-only; the words arrive in phase 04 in both languages.",
    },
  },
  deck: {
    kind: "presentation",
    title: "What are things made of?",
    subtitle: "Grade 6 Science · States of matter",
    slides: [
      {
        n: 1,
        title: "What are things made of?",
        bullets: ["Grade 6 Science", "Card sort · 25 minutes"],
        notes: "Up on the board before they walk in.",
        art: "particles-three",
        layout: "cover",
      },
      {
        n: 2,
        title: "Put these into groups",
        bullets: ["No rules from me.", "Your group decides.", "Write your rule in one sentence."],
        notes: "Say nothing else. Start the timer and walk away.",
        art: "card-sort",
        layout: "full",
      },
      {
        n: 3,
        title: "Same stuff, three arrangements",
        bullets: ["Packed and locked", "Touching, but sliding", "Far apart, moving fast"],
        notes: "Do not put the three names up yet.",
        art: "ice-water-steam",
        layout: "split",
      },
      {
        n: 4,
        title: "Heat is movement",
        bullets: ["Add energy — they move more", "Move more — they spread out", "Spread out — the state changes"],
        notes: "Use your hands. This one lands physically.",
        art: "thermometer",
        layout: "split",
      },
      {
        n: 5,
        title: "Bigger, or further apart?",
        bullets: ["Same particles, both pictures.", "One is heated.", "Which is it?"],
        notes: "Take a vote before you answer. Roughly half say bigger.",
        art: "spacing-trap",
        layout: "list",
      },
      {
        n: 6,
        title: "Tonight",
        bullets: ["Explain your group's rule to someone at home.", "Write down what they got wrong."],
        notes: "Explaining it to a parent is the real homework.",
        art: "homework-slip",
        layout: "quote",
      },
    ],
  },
  check: {
    kind: "homework",
    title: "States of matter — explain it to someone",
    grade: "Grade 6",
    marks: 4,
    minutes: 20,
    questions: [
      {
        q: "In which state are the particles packed closely together AND locked in place?",
        options: ["Liquid", "Solid", "Gas", "All three, equally"],
        answer: 1,
        why: "Opens easy on purpose — homework that opens hard does not get started.",
        difficulty: "Recall",
      },
      {
        q: "A balloon is left in the sun and gets bigger. What happened to the particles inside?",
        options: [
          "Each particle grew larger",
          "More particles appeared",
          "They moved faster and spread further apart",
          "They changed into a different gas",
        ],
        answer: 2,
        why: "The exact misconception phase 05 votes on, asked again at home.",
        difficulty: "Apply",
      },
      {
        q: "Why can you pour a liquid but not a solid?",
        options: [
          "Liquid particles can slide past one another",
          "Liquid particles are smaller",
          "Liquids are lighter than solids",
          "Solids have no particles",
        ],
        answer: 0,
        why: "Checks that 'sliding' survived from the card sort into their words.",
        difficulty: "Analyse",
      },
      {
        q: "You explain your group's rule at home and are told 'gas has no particles at all'. What is the best correction?",
        options: [
          "They are right — gas is empty space",
          "Gas has particles, just far apart and moving fast",
          "Gas particles are much bigger than liquid ones",
          "Only heavy gases have particles",
        ],
        answer: 1,
        why: "Teaching it to someone is the real task; this checks they can correct the answer they get back.",
        difficulty: "Explain",
      },
    ],
  },
};

export const SESSIONS: Session[] = [photosynthesis, statesOfMatter];

/* ── the history rail ─────────────────────────────────────────────── */
// The two live sessions above, plus the older threads behind them. Only
// the first two open; the rest are there because a rail with two rows in
// it does not tell you what a rail looks like.

export const olderSessions = [
  { id: "s-2b90", title: "Cell structure — microscope lab", when: "2d ago", turns: 3, kind: "lesson_plan" as Kind },
  { id: "s-1f47", title: "Respiration vs photosynthesis", when: "3d ago", turns: 8, kind: "homework" as Kind },
  { id: "s-0c22", title: "Forces — the bridge challenge", when: "Mon", turns: 5, kind: "activity" as Kind },
  { id: "s-0a18", title: "Acids and bases — practical safety", when: "Mon", turns: 2, kind: "lesson_plan" as Kind },
  { id: "s-09d4", title: "Term 2 revision deck", when: "Sun", turns: 11, kind: "presentation" as Kind },
];

/** What the library holds, for designs that show a shelf as well as a rail. */
export const recents = [
  { title: "The leaf as a factory", kind: "presentation" as Kind, when: "just now", grade: "G7", live: true },
  { title: "Photosynthesis — check for understanding", kind: "quiz" as Kind, when: "just now", grade: "G7", live: true },
  { title: "States of matter — the card sort", kind: "activity" as Kind, when: "Yesterday", grade: "G6" },
  { title: "What are things made of?", kind: "presentation" as Kind, when: "Yesterday", grade: "G6" },
  { title: "Cell structure — microscope lab", kind: "lesson_plan" as Kind, when: "2d ago", grade: "G7" },
  { title: "Forces — bridge challenge", kind: "activity" as Kind, when: "Mon", grade: "G7" },
  { title: "Acids and bases — practical", kind: "lesson_plan" as Kind, when: "Mon", grade: "G8" },
  { title: "Term 2 revision deck", kind: "presentation" as Kind, when: "Sun", grade: "G7" },
];

/* ── the data that keeps moving ───────────────────────────────────── */

export const pulse = [2, 0, 5, 3, 6, 1, 0, 4, 7, 3, 8, 5, 9, 12];

export const tally = [
  { kind: "lesson_plan" as Kind, made: 34, delta: +6 },
  { kind: "presentation" as Kind, made: 21, delta: +4 },
  { kind: "quiz" as Kind, made: 28, delta: +9 },
  { kind: "homework" as Kind, made: 17, delta: -2 },
  { kind: "activity" as Kind, made: 12, delta: +1 },
];

export const classes = [
  { name: "7A", students: 28, next: "Sun 08:15", ready: true },
  { name: "7C", students: 26, next: "Sun 10:40", ready: true },
  { name: "8B", students: 30, next: "Mon 09:00", ready: false },
];

export const streak = { days: 12, hours: 9.4, label: "hours of planning saved this term" };

/** Every kind, in the order the composer offers them. */
export const KINDS: Kind[] = ["lesson_plan", "presentation", "quiz", "homework", "activity"];
