// =====================================================================
// The fixed session every studio design variant renders
//
// Seven designs are only comparable if they are showing the SAME thing.
// So none of them fetch, none of them generate, and none of them hold
// state that changes what is on screen — they all read this file and
// lay it out differently. What differs between /preview1 and /preview7
// is the design, not the content.
//
// It is deliberately a FULL session rather than a happy little sample:
// an attachment, a prose lesson plan, a quiz with an answer key, an
// eight-slide deck with artwork, and the usage data the real studio
// shows around the edges. A design that only looks good on three lines
// of text is not a design you can choose from.
// =====================================================================

export type Kind = "lesson_plan" | "quiz" | "homework" | "presentation" | "activity";

export const KIND_LABEL: Record<Kind, string> = {
  lesson_plan: "Lesson plan",
  quiz: "Quiz",
  homework: "Homework",
  presentation: "Presentation",
  activity: "Activity",
};

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

/* ── what was asked ───────────────────────────────────────────────── */

export const prompt = {
  text: "A 45-minute Grade 7 lesson on photosynthesis — hands-on starter, a check for understanding halfway, and an exit ticket. Then turn it into a deck I can project, and a quiz I can set as homework.",
  at: "09:42",
  attachments: [
    { name: "Grade-7-Science-Ch4-Photosynthesis.pdf", pages: 14, size: "2.4 MB" },
    { name: "MoE-Science-Outcomes-2026.pdf", pages: 3, size: "310 KB" },
  ],
  skills: ["Inquiry-first openings", "Bilingual key terms"],
};

/* ── how the answer arrived ───────────────────────────────────────── */

export const run = {
  model: "Murchid · Curriculum",
  stages: [
    { label: "Read the attachments", detail: "17 pages", ms: 2100, done: true },
    { label: "Matched MoE outcomes", detail: "3 of 3", ms: 900, done: true },
    { label: "Planned the lesson", detail: "6 phases", ms: 4300, done: true },
    { label: "Built the deck", detail: "8 slides", ms: 6800, done: true },
    { label: "Wrote the quiz", detail: "6 questions", ms: 3100, done: true },
  ],
  totalSeconds: 17.2,
  credits: 3,
  grounding: ["Ch. 4, pp. 61–74", "MoE SCI.7.3.a–c"],
};

/* ── outcome 1 · the lesson plan ──────────────────────────────────── */

export const lesson = {
  kind: "lesson_plan" as Kind,
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
};

/* ── outcome 2 · the quiz ─────────────────────────────────────────── */

export const quiz = {
  kind: "quiz" as Kind,
  title: "Photosynthesis — check for understanding",
  grade: "Grade 7",
  marks: 6,
  minutes: 15,
  // The correct answer deliberately moves around the four positions. An
  // answer key that reads B B B B B B is the first thing that makes a
  // sample quiz look generated, and it makes every design's answer-key
  // treatment look better than it is.
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
};

/* ── outcome 3 · the deck ─────────────────────────────────────────── */

export type Slide = {
  n: number;
  title: string;
  bullets: string[];
  notes: string;
  /** Seed for the generated artwork — same seed, same picture, every variant. */
  art: string;
  layout: "cover" | "split" | "full" | "list" | "quote";
};

export const deck = {
  kind: "presentation" as Kind,
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
  ] as Slide[],
};

/* ── the library shelf ────────────────────────────────────────────── */

export const recents = [
  { title: "The leaf as a factory", kind: "presentation" as Kind, when: "just now", grade: "G7", live: true },
  { title: "Photosynthesis — check for understanding", kind: "quiz" as Kind, when: "just now", grade: "G7", live: true },
  { title: "Cell structure — microscope lab", kind: "lesson_plan" as Kind, when: "2h ago", grade: "G7" },
  { title: "States of matter — card sort", kind: "activity" as Kind, when: "Yesterday", grade: "G6" },
  { title: "Respiration vs photosynthesis", kind: "homework" as Kind, when: "Yesterday", grade: "G8" },
  { title: "Forces — bridge challenge", kind: "activity" as Kind, when: "Mon", grade: "G7" },
  { title: "Acids and bases — practical", kind: "lesson_plan" as Kind, when: "Mon", grade: "G8" },
  { title: "Term 2 revision deck", kind: "presentation" as Kind, when: "Sun", grade: "G7" },
];

/* ── the data that keeps moving ───────────────────────────────────── */
// Fourteen days of activity, the per-kind tally, and where the class is.
// Every variant draws these from here, so the sparkline in one design is
// literally the same fourteen numbers as the sparkline in another.

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
