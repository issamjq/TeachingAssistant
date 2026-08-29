// =====================================================================
// Is this generation a rework of the last one, or a new piece of work?
//
// A teacher stays in one conversation all afternoon. Sometimes she is
// correcting what she just made — "make it grade 5" — and sometimes she
// has moved on to a different lesson entirely. The two need opposite
// things from the library: the first must UPDATE the card she already
// saved, the second must create a new one.
//
// Getting it wrong is expensive in both directions. Treating a rework as
// new leaves her with two nearly identical cards and two timetable
// entries, one of them wrong. Treating a new topic as a rework silently
// overwrites a lesson she wanted to keep.
//
// So the guess is deliberately conservative — it only claims "rework"
// when the topics clearly overlap — and it is never acted on silently:
// the finalise step says which one it thinks this is and offers the
// other, so she can correct it in one click.
// =====================================================================

/** Words too common to say anything about what a lesson is about. */
const NOISE = new Set([
  "lesson", "plan", "class", "grade", "unit", "week", "the", "and", "for", "with",
  "into", "from", "that", "this", "your", "their", "about", "introduction", "intro",
  "notes", "guide", "teach", "teaching", "students", "student", "minutes", "how",
]);

/** The words that carry the topic. */
export function topicWords(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !NOISE.has(w)),
  );
}

/**
 * How much two topics share, 0 to 1.
 *
 * Jaccard over the significant words: "Water Cycle Processes" against
 * "The Water Cycle" scores high, against "Completing the Square" scores
 * zero. Crude, and that is the point — it has to be explainable when it
 * gets one wrong.
 */
export function overlap(a, b) {
  const A = topicWords(a);
  const B = topicWords(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  return shared / new Set([...A, ...B]).size;
}

/**
 * Wording that means "change what you just made" whatever the topic says.
 *
 * "Make it grade 5" shares no topic words with "the water cycle" at all,
 * so the overlap test alone would call it a new lesson.
 */
const EDIT_PHRASING =
  new RegExp(
    "^\\s*(" +
      [
        // rewrite it
        "rework", "redo", "rewrite", "regenerate", "again", "change", "edit", "update",
        // "make" bare, so "make it simpler", "make the examples clearer" and
        // "make them harder" all read as edits. "Make a lesson on volcanoes"
        // is not caught by this, because NAMES_NEW_WORK is checked first.
        "make", "keep", "instead",
        // reshape it
        "shorter", "longer", "simpler", "harder", "easier", "expand", "shorten",
        "simplify", "more", "less", "add", "remove", "drop", "include", "use", "but",
        // move it — a reschedule is a change to the same lesson, and leaving
        // these out sent "move it to thursday at 2pm" off as a brand-new
        // request with no topic in it at all
        "move", "shift", "reschedule", "postpone", "bring", "push", "set", "put",
        "rename", "retitle",
      ].join("|") +
      ")\\b|\\binstead\\b|\\brework\\b|\\bmove it\\b|\\breschedule\\b",
    "i",
  );

/**
 * A request for a NEW piece of work, however it opens.
 *
 * The edit-verb list is what makes "make it simpler" a rework, and it is also
 * what made "add a lesson on volcanoes" one — the verb said edit, the rest of
 * the sentence said build something new, and the verb won. It would have
 * overwritten a lesson she wanted to keep.
 *
 * Naming a kind and then a topic — "lesson on volcanoes", "quiz on
 * fractions" — is the giveaway, and it is a shape reworks do not have.
 * "Add a hands-on model-making activity" names a kind but no topic after it,
 * so it stays a rework, which is right: it is describing a section to add,
 * not a document to make.
 */
const NAMES_NEW_WORK =
  /\b(lesson|quiz|exam|test|homework|presentation|deck|activity|worksheet)\b[^.!?]{0,30}?\bon\s+[a-z]/i;

/**
 * Kept for callers that want the softer "does this look related" signal.
 * `isRework` no longer needs it: naming new work is the only thing that
 * takes a follow-up out of the current lesson.
 */
export const REWORK_THRESHOLD = 0.2;

/**
 * Does this new generation replace `previous`?
 *
 * `previous` is the last batch she finalised in this conversation.
 */
export function isRework({ previous, prompt, title }) {
  if (!previous) return false;

  /**
   * Asking for a new document is never a rework, whatever verb it opens with.
   * This is the only thing that takes a follow-up OUT of the current lesson.
   */
  if (NAMES_NEW_WORK.test(String(prompt || ""))) return false;

  /**
   * Everything else in an open thread is a refinement of what is in it.
   *
   * This began as a list of edit verbs and it kept being wrong by omission:
   * "make it simpler" was covered but "make the examples clearer" was not,
   * "move it to Friday" was not, and each miss sent a follow-up off as a
   * fresh request — which then asked her for the grade and subject she had
   * given thirty seconds earlier, and filed the result as a second card.
   *
   * A list of ways to say "change this" can never be complete. What CAN be
   * decided reliably is the opposite: whether she has named a new document to
   * make. If she has not, she is talking about the one already on screen.
   *
   * The guess is still shown and still reversible — the finalise step offers
   * "Save as a new lesson instead" — so the cost of being wrong here is one
   * click, where the cost of asking her again is the whole point of the
   * feature.
   */
  return true;
}


/* ── which of the three documents she is talking about ─────────────────── */

/**
 * The ways a teacher names each document.
 *
 * Deliberately not matching a bare "lesson": "make the lesson simpler" means
 * the whole thing, and reading it as the lesson-plan document alone would
 * leave a guide and a set of notes still written for the old version. Only
 * wording that clearly picks ONE part out of the set counts.
 */
const KIND_PHRASES = [
  [
    "lesson_plan",
    /\b(lesson\s*plan|the\s+plan|plan\s+document|main\s+plan)\b/i,
  ],
  [
    "teaching_guide",
    /\b(teaching\s*guide|teacher'?s?\s*guide|the\s+guide|guide\s+document)\b/i,
  ],
  [
    "student_notes",
    /\b(student\s*notes|students'?\s*notes|the\s+notes|handout|note\s*sheet)\b/i,
  ],
];

/**
 * Which documents does this instruction actually ask to change?
 *
 * Regenerating all three to fix one of them is slow, spends a generation the
 * teacher did not ask for, and — worse — hands back new wording for two
 * documents she had already read and approved. When she names what she wants
 * changed, only that is rewritten.
 *
 * An empty result means she named nothing in particular, and the whole set is
 * rewritten as before: "make it simpler" is about the lesson, not about one
 * page of it.
 */
export function targetedKinds(prompt) {
  const t = String(prompt || "");
  // Naming a new document to build is not naming a part to edit.
  if (NAMES_NEW_WORK.test(t)) return [];
  return KIND_PHRASES.filter(([, re]) => re.test(t)).map(([kind]) => kind);
}

/* ── rescheduling is not rewriting ─────────────────────────────────────── */

/** Anything that names a day or an hour. */
/**
 * A day or a date, written out in full rather than as a stem.
 *
 * The abbreviations used to carry `[a-z]*` after them, so any word STARTING
 * with one counted as a date. "dec" ate **deck** — which meant every request
 * for a slide deck read as naming a time, took the reschedule branch, and
 * came back "I couldn't find that in your library to move it" instead of a
 * presentation. "sun" ate **sunlight**, in a lesson about photosynthesis.
 *
 * So each name is matched whole. The short forms and the long forms are
 * listed separately because \b after "dec" is exactly what stops "deck",
 * and a stem with anything appended is the thing that broke.
 */
const NAMES_A_TIME =
  /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\b|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b|\b(january|february|march|april|june|july|august|september|october|november|december)\b|\b(today|tomorrow|tonight)\b|\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}(st|nd|rd|th)\b|\b\d{4}-\d{2}-\d{2}\b|\bnext week\b|\bperiod\b/i;

/** Anything that asks for the documents themselves to change. */
const ASKS_FOR_CONTENT =
  /\b(add|remove|include|drop|replace|simpler|harder|easier|shorter|longer|expand|shorten|simplify|rewrite|redo|regenerate|rework|better|improve|example|examples|activity|question|questions|objective|objectives|content|explain|detail|grade|year)\b/i;

/**
 * Is this only asking to move it?
 *
 * "Move it to Thursday at 2pm" changes a date and nothing else. Sending that
 * through the generator rewrote three documents that nobody asked to have
 * rewritten — minutes of waiting, a chunk of the day's quota, and a fresh set
 * of wording she had already approved. The timetable row is the only thing
 * that needs to change, so it is the only thing that does.
 *
 * Deliberately strict: it must name a time AND ask for nothing else. Anything
 * mentioning content — even alongside a new time — goes the long way round,
 * because a rewrite that was skipped is far worse than one that was not.
 */
/**
 * Is she asking to move it, without saying when?
 *
 * "Reschedule the quiz", "can we move this". There is no time in it to act on,
 * but the intent is unmistakable and it is NOT a request to write anything —
 * which is what it became: the generator wrote a second quiz, and the teacher
 * who asked to change a time got a new set of questions instead.
 *
 * The answer to this is a question, not a booking: which day, and the hours.
 */
export const namesNewWork = (prompt) => NAMES_NEW_WORK.test(String(prompt || ""));

/** The words a teacher uses for each kind, when she names one outright. */
const KIND_WORDS = [
  ["quiz", /\b(quiz|exam|test paper|assessment)\b/i],
  ["homework", /\b(homework|assignment)\b/i],
  ["presentation", /\b(presentation|slide ?deck|deck|slides)\b/i],
  ["activity", /\b(activity|worksheet)\b/i],
  ["lesson_plan", /\blesson\b/i],
];

/**
 * Which kind she asked for, when the request says so itself.
 *
 * The composer's kind row resets to "Lesson" on every page load, and it is
 * the composer — not the sentence — that decided what got written. So "now a
 * quiz on photosynthesis for grade 7", typed into a thread the day after,
 * was answered with the lesson planner's question about how long it runs.
 *
 * Only consulted when she NAMES new work: "make it shorter" names no kind and
 * belongs to whatever is already on screen.
 */
export function kindsNamedIn(prompt) {
  const t = String(prompt || "");
  if (!NAMES_NEW_WORK.test(t)) return [];
  /**
   * All of them, not the first.
   *
   * "Homework and an activity on decimals" names two, and returning only the
   * one that appears earliest silently dropped the other — the composer had
   * both chips lit, the teacher asked for both, and one arrived.
   */
  return KIND_WORDS.filter(([, re]) => re.test(t)).map(([kind]) => kind);
}

/** The single kind she named, when she named exactly one. */
export function kindNamedIn(prompt) {
  const all = kindsNamedIn(prompt);
  return all.length === 1 ? all[0] : null;
}

export function asksToReschedule(prompt) {
  const t = String(prompt || "");
  if (NAMES_NEW_WORK.test(t) || ASKS_FOR_CONTENT.test(t)) return false;
  return /\b(reschedule|re-?schedule|move|shift|postpone|push\s+(it|this)|change\s+the\s+(time|date|day|slot)|different\s+(time|day|slot))\b/i.test(
    t,
  );
}

export function isScheduleOnly(prompt) {
  const t = String(prompt || "");
  /**
   * "A maths lesson on fractions on Friday 9am" names a time and asks for no
   * changes — and taken at face value it would have MOVED the lesson already
   * on screen instead of writing the one she asked for. A request that names
   * new work is never a bare reschedule, however much of a date it carries.
   */
  if (NAMES_NEW_WORK.test(t)) return false;
  return NAMES_A_TIME.test(t) && !ASKS_FOR_CONTENT.test(t);
}
