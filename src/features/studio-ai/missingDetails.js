// =====================================================================
// What a request does not say, and how to ask for it
//
// "A lesson on volcanoes" names a topic and nothing else. The generator
// will happily fill the gaps — it wrote "Science · Grade 9 · 45 minutes"
// for exactly that prompt — and every one of those was a guess presented
// to the teacher afterwards as a fact.
//
// A guessed grade is not a cosmetic problem: it decides the reading
// level, the worked examples and the difficulty of every question in the
// lesson. Getting it wrong means regenerating the whole thing. So the
// asking happens BEFORE the work, not after, and it happens once — one
// short line covering everything that is missing.
//
// Detection is deliberately plain string work rather than a model call:
// it runs as she types, it costs nothing, and being slightly generous is
// the safe direction. A prompt that mentions a grade in an unusual way is
// simply not asked about.
// =====================================================================
import { MAJORS } from "@/lib/enums";

const SUBJECTS = MAJORS.map((m) => m.toLowerCase());

/**
 * Topics that name their own subject.
 *
 * "A quiz on cyber security for Grade 10" says what subject it is as plainly
 * as writing "Computer Science" would — and asking anyway is the kind of
 * question that makes a teacher stop using the thing. Matching only the
 * subject NAMES meant every request phrased by topic, which is how teachers
 * actually write them, collected a needless question.
 *
 * Deliberately short and obvious. A miss costs one extra question; a wrong
 * guess files a lesson under the wrong subject, so anything ambiguous is left
 * out on purpose.
 */
/* Each pattern ends open rather than on a word boundary, so "fraction"
   also matches "fractions" and "magnet" matches "magnetism". */
const SUBJECT_BY_TOPIC = [
  [/\b(cyber ?security|programming|coding|algorithm|computer|software|internet safety|spreadsheet|database|python|javascript|networking|hardware|it skills)\w*/i, "Computer Science"],
  [/\b(fraction|decimal|algebra|geometry|multiplication|division|arithmetic|equation|percentage|trigonometry|calculus|probability|statistics)\w*/i, "Math"],
  [/\b(photosynthesis|water cycle|solar system|ecosystem|magnet|gravity|electricity|weather|planet|volcano|energy|matter|habitat)\w*/i, "Science"],
  [/\b(cell|dna|genetic|organism|human body|digestion|respiration|plant|animal|evolution)\w*/i, "Biology"],
  [/\b(force|motion|velocity|newton|optics|thermodynamic)\w*/i, "Physics"],
  [/\b(atom|molecule|periodic table|chemical|reaction|acid|alkali|compound)\w*/i, "Chemistry"],
  [/\b(grammar|comprehension|essay|poem|poetry|vocabulary|punctuation|spelling|reading|creative writing)\w*/i, "English"],
  [/\b(world war|ancient|civilisation|civilization|revolution|empire|historical)\w*/i, "History"],
  [/\b(continent|climate|map skills|river|mountain|population|country|capital cit)\w*/i, "Geography"],
  [/\b(primary colour|primary color|painting|drawing|sculpture|collage)\w*/i, "Art"],
];

/** The subject a topic implies, or null when nothing is clear enough. */
export function subjectFromTopic(prompt) {
  const t = String(prompt || "");
  return SUBJECT_BY_TOPIC.find(([re]) => re.test(t))?.[1] ?? null;
}

const HAS_GRADE =
  /\bgrade\s*\d{1,2}\b|\byear\s*\d{1,2}\b|\bkg\s*\d?\b|\bg\d{1,2}\b|\bkindergarten\b|\breception\b|\bfoundation\b/i;

const HAS_DURATION = /\b\d{1,3}\s*(min|minute|minutes|hr|hour|hours)\b|\b(single|double)\s+period\b|\bperiod\b/i;

/**
 * Does she say when it is taught?
 *
 * Asked here with the rest rather than after the documents are written. The
 * date was the one detail collected at the end, which meant two separate
 * interruptions for one request — the studio asking about the class before
 * writing, then asking about the calendar after. One question is one
 * interruption.
 */
const HAS_DATE =
  /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(today|tomorrow|tonight)\b|\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}(st|nd|rd|th)\b|\b\d{4}-\d{2}-\d{2}\b|\bnext week\b/i;

/**
 * Does she give the hours it runs, and not just a day?
 *
 * "Friday 9 to 10", "10am–11am", "from 9:30 to 10:15" — a start AND an end.
 * A lesson does not need this: it takes its period, and its length is in the
 * plan. A quiz does. It opens and it closes, both times are on the timetable,
 * and inferring the end from a duration nobody stated puts a made-up finish
 * time in front of a class sitting an exam.
 */
const HAS_TIME_RANGE =
  /\b\d{1,2}(:\d{2})?\s*(am|pm)?\s*(-|–|—|to|until|till)\s*\d{1,2}(:\d{2})?\s*(am|pm)?/i;

/** A time of day on its own — "at 10am", "9:30", "second period". */
const HAS_CLOCK =
  /\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|\b(first|second|third|fourth|fifth|last)\s+period\b/i;

/**
 * The kinds that are booked between two times rather than given a period.
 * The same set the scheduler asks an end time for.
 */
const BOUNDED = new Set(["quiz"]);

/**
 * An activity runs for a length, at a time.
 *
 * Unlike a quiz — which a teacher thinks of as "9 to 9:45" — an activity is
 * usually "twenty minutes, some time on Friday". Both facts are needed to put
 * it on a timetable, and either phrasing supplies both: a start and an end
 * gives the length, and a start and a length gives the end. So the question
 * asks only for the half she left out, rather than for a window she was never
 * thinking in.
 */
const TIMED = new Set(["activity"]);

/**
 * A deck is not an event.
 *
 * Slides are shown during a lesson that is already on the timetable — they do
 * not start at a time of their own or run for a length of their own. Asking a
 * teacher what time her slides begin and how long they last is a question
 * about nothing, and it stood between her and the deck every time.
 *
 * So nothing about the calendar is asked before writing. Putting a deck on
 * the timetable is offered afterwards, at the save, where it is a choice
 * rather than a toll.
 */
const UNTIMED = new Set(["presentation"]);

/**
 * The kinds handed in rather than sat.
 *
 * Homework has a deadline, not a slot. It was grouped with quizzes, so the
 * studio asked a teacher setting a worksheet what time it "starts and ends" —
 * two times she has no reason to have in mind, for something that has one
 * date. What it needs is the day it is due.
 */
const DUE_ONLY = new Set(["homework"]);

/**
 * What the prompt leaves open.
 *
 * `kind` matters: the same missing detail is a different question for a quiz
 * than for a lesson. Left out, it defaults to the lesson's rules, which is
 * what every existing caller expects.
 */
export function missingFrom(prompt, kind) {
  const text = String(prompt || "");
  const lower = text.toLowerCase();

  /**
   * The composer is a multi-select, so one request can be a lesson AND a quiz.
   * Reading only the first of them asked for a duration and never for the
   * hours the quiz runs — and the quiz went on the timetable with an end time
   * nobody had given. If anything in the batch is booked between two times,
   * the question covers that.
   */
  const asked = Array.isArray(kind) ? kind : [kind];

  const missing = [];
  if (!HAS_GRADE.test(text)) missing.push("grade");
  // Named outright, or plain from the topic — either way she has said it.
  if (!SUBJECTS.some((s) => lower.includes(s)) && !subjectFromTopic(text)) {
    missing.push("subject");
  }

  // Checked before BOUNDED so a request for homework AND a quiz still asks
  // for the hours: the quiz needs them and the deadline costs no extra words.
  if (asked.some((k) => BOUNDED.has(k))) {
    if (!HAS_DATE.test(text)) missing.push("day");
    // One question covers both ends of it, because one answer does.
    if (!HAS_TIME_RANGE.test(text)) missing.push("window");
    return missing;
  }

  if (asked.some((k) => DUE_ONLY.has(k))) {
    if (!HAS_DATE.test(text)) missing.push("due");
    return missing;
  }

  // Nothing further: a deck needs the class it is for, not a slot.
  if (asked.every((k) => UNTIMED.has(k))) return missing;

  if (asked.some((k) => TIMED.has(k))) {
    if (!HAS_DATE.test(text)) missing.push("day");
    // A range answers both halves at once, so neither is asked for.
    if (!HAS_TIME_RANGE.test(text)) {
      if (!HAS_CLOCK.test(text)) missing.push("start");
      if (!HAS_DURATION.test(text)) missing.push("duration");
    }
    return missing;
  }

  if (!HAS_DURATION.test(text)) missing.push("duration");
  if (!HAS_DATE.test(text)) missing.push("date");
  return missing;
}

/**
 * One line, not a form.
 *
 * Three separate prompts for three fields is the wizard this studio was
 * built to replace. She answers in her own words — "grade 5 science, one
 * period" — and anything she leaves out stays out.
 */
export function askFor(missing) {
  const names = {
    grade: "which grade",
    subject: "what subject",
    duration: "how long it runs",
    date: "when you are teaching it",
    // Named as a pair on purpose: "what time it runs" invites a start and
    // nothing else, and the end is the half that goes on the timetable.
    window: "what time it starts and ends",
    day: "which day it is on",
    due: "when it is due",
    start: "what time it starts",
  };
  const parts = missing.map((m) => names[m]).filter(Boolean);
  if (!parts.length) return "";

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return `Before I write it — ${list}? One line is enough, or say "you decide".`;
}

/** Did she decline to specify? Then stop asking and let the model choose. */
export const declined = (answer) =>
  /\byou decide\b|\bwhatever\b|\bany\b|\bdoesn'?t matter\b|\bup to you\b|\bskip\b/i.test(
    String(answer || ""),
  );
