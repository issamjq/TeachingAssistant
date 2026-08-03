import React, { useEffect, useMemo, useRef, useState } from "react";
import { setNavGuard } from "../lib/route";
import {
  Sparkles, FileText, ClipboardList, GraduationCap,
  Layers, Users, Calendar, Save, Copy, Check, X, RotateCcw, FileDown,
  Send, Paperclip, Plus, Wand2, RefreshCw, Zap, Dices, ChevronDown,
  BookOpen, Gauge, Hash, Clock, Globe, HelpCircle, ListChecks, Award, Minus,
  Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker, api, getProfile } from "./_shared";
import { useT, useI18n, tIn, isArabicLang } from "../lib/i18n";
import { parseSections, joinSections, renderMarkdown } from "../lib/markdown";
import StudioCard from "./StudioCard";
import SlideBuilder from "./SlideBuilder";
import BrandLoader from "../components/BrandLoader";
import {
  GRADE_LEVELS, MAJORS,
  QUIZ_QUESTION_COUNTS, QUIZ_DURATIONS, QUIZ_DIFFICULTIES,
  QUIZ_LANGUAGES, QUIZ_SECTIONS, QUIZ_QUESTION_MIXES,
} from "../lib/enums";

// Same base URL the rest of the app uses (Vercel rewrites /api → Render in
// prod; same-origin in dev via the Vite middleware).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Each kind has its headline split into three parts so the noun-phrase can
// be rendered as an inline-clickable element inside the Murchid sentence:
//   "{verb} a {inlineLabel}. {suffix}"
// e.g.  Plan  a  [schedule ▾].  Tell Murchid the timeframe.
const KINDS = [
  {
    value: "lesson_plan",  label: "Lesson",     icon: FileText,
    oneliner: "Structured class plan",
    menuBlurb: "Outline + materials",
    verb: "Make", inlineLabel: "lesson plan",   suffix: "Tell Murchid what to teach.",
    sample: "A 45-minute Grade 7 science lesson on photosynthesis with a hands-on starter, two activities, and a quick exit ticket.",
  },
  {
    value: "quiz",         label: "Quiz",       icon: GraduationCap,
    oneliner: "MCQ, T/F, short or essay",
    menuBlurb: "MCQ, T/F, short or essay",
    verb: "Make", inlineLabel: "quiz",          suffix: "Tell Murchid what to test.",
    // The chips above the textarea already carry grade / subject / major
    // / difficulty / count / duration, so the prompt should focus on
    // content only: which sub-topics, real-world hooks, what to emphasise.
    sample: "Linear equations — focus on word problems with real-world scenarios. Avoid pure plug-and-chug.",
  },
  {
    value: "homework",     label: "Homework",   icon: ClipboardList,
    oneliner: "Take-home tasks",
    menuBlurb: "Take-home practice",
    verb: "Make", inlineLabel: "homework",      suffix: "Tell Murchid the focus.",
    sample: "Reading-comprehension homework for Grade 6 English on a short story — students answer 5 questions in writing.",
  },
  {
    value: "activity",     label: "Activity",   icon: Users,
    oneliner: "In-class task",
    menuBlurb: "Pair, group or solo",
    verb: "Make", inlineLabel: "activity",      suffix: "Tell Murchid the goal.",
    sample: "A 20-minute group activity for Grade 8 geography on map reading — four stations, students rotate every five minutes.",
  },
  {
    value: "presentation", label: "Presentation", icon: Layers,
    oneliner: "Slide-by-slide outline",
    menuBlurb: "Deck for class",
    verb: "Make", inlineLabel: "presentation",  suffix: "Tell Murchid what to cover.",
    sample: "8-slide intro deck on the water cycle for Grade 4.",
  },
];

// Translated KIND label (module-level so any component can use it with
// its own t()). Falls back to the English KINDS label when not keyed.
function kindLabelFor(t, v) {
  const s = t(`kind.${v}`);
  return s === `kind.${v}` ? (KINDS.find((k) => k.value === v)?.label || v) : s;
}

// Recent prompts live in localStorage so the chips always reflect what
// THIS teacher actually generated. Stored per kind, capped at 8, prepended
// on each successful generation. First-time users see a kind-appropriate
// seed list (so the row is never empty).
// First H1/H2 of the generated markdown — where the model puts the artifact's
// name. Falls back when the output opens with prose instead.
function titleFromMarkdown(text, fallback) {
  const line = text.split(/\r?\n/).find((l) => /^#{1,2}\s+/.test(l)) || fallback;
  return line.replace(/^#+\s*/, "").trim().slice(0, 120) || fallback;
}

// The Section chip can hold one value or several ("Section(s)"), but the
// homework / presentations tables store a single TEXT column. Join rather than
// silently keeping the first, so a two-section assignment doesn't quietly
// become a one-section one.
function sectionToColumn(section) {
  if (Array.isArray(section)) return section.filter(Boolean).join(", ") || null;
  return section || null;
}

// Split generated markdown into deck slides — one slide per heading, with the
// lines beneath it as the body.
//
// Emits { title, body } rather than a full slide object deliberately:
// deckFromPresentation() in SlideBuilder already splits `body` into bullets
// when `bullets` is absent, and picks layout/background itself. Producing the
// minimal shape keeps one owner for those defaults instead of two.
//
// Text before the first heading becomes the opening slide, so a preamble is
// carried rather than dropped.
function slidesFromMarkdown(text) {
  const lines = String(text || "").split(/\r?\n/);
  const slides = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      if (current) slides.push(current);
      current = { title: heading[1].trim().slice(0, 200), body: "" };
      continue;
    }
    if (!current) {
      if (!line.trim()) continue;
      current = { title: "", body: "" };
    }
    current.body += (current.body ? "\n" : "") + line;
  }
  if (current) slides.push(current);
  return slides
    .map((s) => ({ title: s.title, body: s.body.trim() }))
    .filter((s) => s.title || s.body);
}

const RECENTS_STORAGE_KEY = (kind) => `murchid:studio:recents:${kind}`;
const RECENT_SEEDS = {
  lesson_plan:  ["Photosynthesis", "Pythagoras", "Story arc", "Buoyancy"],
  quiz:         ["Linear equations", "Quadratics", "Geometry: angles", "Statistics: mean & median"],
  homework:     ["Reading comp · Lesson 4", "Word problems", "Vocab review"],
  activity:     ["Town-hall debate", "Lab pair-up", "Gallery walk"],
  presentation: ["Water cycle", "World religions", "Plot diagram"],
  schedule:     ["Term 2 plan", "Forces & motion week", "Exam revision"],
};

const loadRecents = (kind) => {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY(kind));
    if (!raw) return RECENT_SEEDS[kind] || [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return RECENT_SEEDS[kind] || [];
    return parsed;
  } catch {
    return RECENT_SEEDS[kind] || [];
  }
};

const pushRecent = (kind, fullPrompt) => {
  const trimmed = String(fullPrompt || "").trim();
  if (!trimmed) return;
  try {
    const cur = loadRecents(kind);
    const lower = trimmed.toLowerCase();
    const filtered = cur.filter((p) => p.toLowerCase() !== lower);
    const next = [trimmed, ...filtered].slice(0, 8);
    localStorage.setItem(RECENTS_STORAGE_KEY(kind), JSON.stringify(next));
  } catch {}
};

// Short label for a chip — full prompt becomes the textarea content on
// click, but the chip itself only has room for ~3 words.
const recentLabel = (s) => {
  const t = String(s || "").trim();
  // Use the first heading-style chunk before an em-dash / colon, capped.
  const head = t.split(/[—:|]/)[0].trim() || t;
  return head.length <= 28 ? head : head.slice(0, 26).trim() + "…";
};

// Pre-prompt parameters the teacher locks in before a quiz is generated.
// Every chip is required (see REQUIRED_CHIPS) — generation is gated until
// they're all set. Default to empty (not 10 / 30 / Medium) so the chip
// placeholder reads "Pick…" and the teacher makes a real choice.
const QUIZ_PARAMS_DEFAULTS = {
  grade: "",       // from GRADE_LEVELS
  major: "",       // from MAJORS (this codebase's school-subject list)
  language: "",    // from QUIZ_LANGUAGES — output language of the quiz
  section: "",     // from QUIZ_SECTIONS — class section (e.g. "Section A")
  questions: "",   // from QUIZ_QUESTION_COUNTS
  duration: "",    // from QUIZ_DURATIONS (minutes)
  difficulty: "",  // from QUIZ_DIFFICULTIES
  types: "",       // from QUIZ_QUESTION_MIXES — which question types to include
  scheduled_for: "", // YYYY-MM-DD — when this quiz should run (cover-only meta)
  total_marks: "", // teacher-set total score; prints as "Score: ___ / N"
  instructions_mode: "none", // "auto" | "custom" | "none" — the worksheet instruction line
  instructions: "",          // teacher's own line, used when instructions_mode === "custom"
};

// Activity pre-prompt panel mirrors the quiz settings layout but with
// activity-specific labels. Per the chip rules, activities have NO
// grade or section — only Type, Major, Language, Duration. Same idea:
// all four are required before Murchid will build.
const ACTIVITY_TYPES = ["Individual", "Pair", "Group"];
const ACTIVITY_DURATIONS = [10, 15, 20, 30, 45, 60];
const ACTIVITY_PARAMS_DEFAULTS = {
  type: "",        // ACTIVITY_TYPES
  major: "",       // from MAJORS
  language: "",    // from QUIZ_LANGUAGES — same list, the output language
  duration: "",    // from ACTIVITY_DURATIONS (minutes)
  scheduled_for: "", // YYYY-MM-DD
};

// Lesson plan pre-prompt panel — Grade + Major + Language + Section +
// Duration, plus a schedule date. Mirrors the quiz/activity shape.
const LESSON_DURATIONS = [30, 45, 60, 75, 90];
const LESSON_PARAMS_DEFAULTS = {
  grade: "",       // from GRADE_LEVELS / teacher's profile
  major: "",       // from MAJORS
  language: "",    // from QUIZ_LANGUAGES
  section: "",     // from QUIZ_SECTIONS / teacher's profile
  duration: "",    // from LESSON_DURATIONS (minutes)
  scheduled_for: "", // YYYY-MM-DD
};

// Homework pre-prompt panel — Grade + Major + Language + Section, plus
// a "Schedule for" date that doubles as the due date and an OPTIONAL
// total score (only printed on the hand-out when the teacher fills it in).
const HOMEWORK_PARAMS_DEFAULTS = {
  grade: "",
  major: "",
  language: "",
  section: "",
  scheduled_for: "", // YYYY-MM-DD (interpreted as the due date)
  total_marks: "",   // optional — when set, prints as "Score: ___ / N"
};

// Presentation pre-prompt panel — Grade + Major + Language + Section +
// optional slide count, plus a schedule date.
const PRESENTATION_SLIDES = [5, 8, 10, 12, 15, 20];
const PRESENTATION_PARAMS_DEFAULTS = {
  grade: "",
  major: "",
  language: "",
  section: "",
  slides: "",       // from PRESENTATION_SLIDES
  scheduled_for: "",
};

// "Or try" pool — directive prompts. Expanded so we can shuffle 3 random
// suggestions per kind on each mount / kind change. Teachers shouldn't
// see the same three suggestions every time they open the studio.
const SUGGESTIONS_POOL_BY_KIND = {
  lesson_plan: [
    "Pop lesson from yesterday",
    "Re-teach what 8B got wrong",
    "Same lesson, harder",
    "Same lesson, simpler scaffolding",
    "Add a hands-on starter",
    "Plan with a flipped-classroom angle",
    "Shorten to 20 minutes",
    "Add a real-world tie-in",
  ],
  quiz: [
    "Pop quiz from Lesson 3",
    "Mid-term review (3 chapters)",
    "Re-teach what 8B got wrong",
    "Diagnostic — measure prior knowledge",
    "Quick recall — 5 short questions",
    "End-of-unit challenge",
    "Word problems only",
    "MCQ only for fast marking",
    "Stretch questions for top set",
    "Spiral review of last 2 weeks",
  ],
  homework: [
    "Easier version for 6B",
    "Add 2 word problems",
    "Same idea, shorter",
    "Extension task for fast finishers",
    "Family-involved version",
    "30-minute cap, no internet",
    "Build on yesterday's lesson",
  ],
  activity: [
    "Quick warm-up version",
    "Group of 4 instead",
    "Outdoor variant",
    "Silent / written variant",
    "Add a reflection at the end",
    "Pair-and-share format",
    "Gamified with points",
  ],
  presentation: [
    "Add slide on examples",
    "Remove text-heavy slides",
    "Add a quiz at the end",
    "More visual, less text",
    "Compress to 5 slides",
    "Add speaker notes",
    "Story arc with a hook + payoff",
  ],
  schedule: [
    "Two-week version",
    "Compress to 3 days",
    "Add a review day",
    "Slot in formative assessments",
    "Front-load the hardest topics",
    "Build in a buffer day",
    "Cover-class friendly version",
  ],
};

// Pick three random suggestions per kind. Stable per (kind, generation
// counter) so the row doesn't reshuffle every render.
const pickSuggestions = (kind, seed) => {
  const pool = SUGGESTIONS_POOL_BY_KIND[kind] || [];
  if (pool.length <= 3) return pool;
  // Tiny xorshift-style picker so we can derive an order from a seed
  // (avoiding randomness that would re-shuffle on every render).
  const order = [...pool].map((s, i) => ({ s, k: (i * 9301 + 49297 + seed * 233) % 233280 }));
  order.sort((a, b) => a.k - b.k);
  return order.slice(0, 3).map((x) => x.s);
};

// Attachment-specific suggestions — replace the generic "Or try" row
// whenever the teacher has a file attached. Each chip teaches a real
// pattern of how the attachment + prompt combine, so teachers discover
// "make an exact copy" / "same structure, different questions" /
// "translate" without us writing a manual.
const ATTACHMENT_SUGGESTIONS_POOL_BY_KIND = {
  lesson_plan: [
    "Re-teach what this lesson covers",
    "Same lesson, simpler scaffolding",
    "Build a lesson around this material",
    "Add a hands-on starter to this",
    "Shorten this to 20 minutes",
  ],
  quiz: [
    "Make an exact copy",
    "Same structure, different questions",
    "Same topics, harder",
    "Same topics, easier",
    "Translate to the chosen language",
    "Convert everything to MCQ",
    "Skip the word problems",
    "Give me the answer key only",
    "Make a 20-question version of this",
    "Add 5 stretch questions to this",
  ],
  homework: [
    "Make a homework version of this",
    "Easier version for revision",
    "Add a reflection question",
    "Convert to a take-home worksheet",
  ],
  activity: [
    "Turn this into a group activity",
    "Outdoor / hands-on variant",
    "Pair-and-share version",
    "Add a quick reflection at the end",
  ],
  presentation: [
    "Turn this into 5 slides",
    "Outline a 10-slide deck on this",
    "Add speaker notes for each section",
    "Make a visual-first version",
  ],
  schedule: [
    "Plan a week around this material",
    "Build a two-week unit from this",
    "Add formative assessments",
  ],
};

const pickAttachmentSuggestions = (kind, seed) => {
  const pool = ATTACHMENT_SUGGESTIONS_POOL_BY_KIND[kind] || [];
  if (pool.length <= 3) return pool;
  const order = [...pool].map((s, i) => ({ s, k: (i * 9301 + 49297 + seed * 233) % 233280 }));
  order.sort((a, b) => a.k - b.k);
  return order.slice(0, 3).map((x) => x.s);
};

// Normalise Arabic-Indic digits (٠-٩) to ASCII digits so a regex written
// with \d catches both "Grade 7" and "الصف ٧".
const toAsciiDigits = (s) =>
  String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

// Detect plausible Grade / Duration / Slides / Questions mentions in the
// teacher's free-text prompt, and flag a conflict when the chip is set
// to a different value. Returns an array of { field, chip, prompt } —
// empty when no conflicts. Field is an i18n key for the chip label.
function detectChipPromptConflicts(promptText, params, kind) {
  const out = [];
  const text = toAsciiDigits(promptText);
  if (!text || !params) return out;

  // Grade — matches "Grade 7", "Grade 7-8", "grade 12", "الصف 7", "صف 7".
  if (params.grade) {
    const m = text.match(/\b(?:grade|الصف|صف)\s*(\d{1,2})\b/i);
    if (m) {
      const promptGrade = `Grade ${m[1]}`;
      const chip = String(params.grade);
      if (!chip.replace(/\s+/g, "").toLowerCase().includes(`grade${m[1]}`)) {
        out.push({ field: "grade", chip, prompt: promptGrade });
      }
    }
  }

  // Duration — matches "45-minute", "45 min", "45 minutes", "45 mins",
  // "45 دقيقة". Quiz/Lesson/Homework/Activity carry numeric duration.
  if (params.duration) {
    const m = text.match(/\b(\d{2,3})\s*[-\s]?(?:minute|minutes|min|mins|m|دقيقة|دقائق)\b/i);
    if (m) {
      const promptDur = Number(m[1]);
      const chipDur = Number(params.duration);
      if (chipDur && promptDur && chipDur !== promptDur) {
        out.push({ field: "duration", chip: `${chipDur} min`, prompt: `${promptDur} min` });
      }
    }
  }

  // Slides — presentations only.
  if (kind === "presentation" && params.slides) {
    const m = text.match(/\b(\d{1,2})[-\s]?slides?\b/i);
    if (m) {
      const promptSl = Number(m[1]);
      const chipSl = Number(params.slides);
      if (chipSl && promptSl && chipSl !== promptSl) {
        out.push({ field: "slides", chip: String(chipSl), prompt: String(promptSl) });
      }
    }
  }

  // Questions — quizzes only.
  if (kind === "quiz" && params.questions) {
    const m = text.match(/\b(\d{1,3})\s*questions?\b/i);
    if (m) {
      const promptQ = Number(m[1]);
      const chipQ = Number(params.questions);
      if (chipQ && promptQ && chipQ !== promptQ) {
        out.push({ field: "questions", chip: String(chipQ), prompt: String(promptQ) });
      }
    }
  }

  return out;
}

export default function Studio({ initialKind } = {}) {
  // initialKind comes from the URL (#/studio/<kind>) so the Teaching
  // surfaces can deep-link straight to "Make a quiz", "Make a
  // homework", etc. Falls back to lesson_plan when the route is bare
  // or the value isn't one of the recognised kinds.
  const t = useT();
  const { lang: uiLang } = useI18n();
  const kindLabel = (v) => kindLabelFor(t, v);
  const validKind = KINDS.some((k) => k.value === initialKind) ? initialKind : "lesson_plan";
  const [kind, setKind] = useState(validKind);
  const [prompt, setPrompt] = useState("");
  // The signed-in teacher's profile (majors / grade_levels / languages),
  // fetched once on mount. Used to scope the studio dropdowns down to
  // what the teacher actually teaches, so they don't scroll past Arabic,
  // KG 1, etc. when they teach Science to Grades 5–8. Falls back to the
  // global enums when the profile is empty.
  const [teacher, setTeacher] = useState(null);
  useEffect(() => {
    let alive = true;
    getProfile()
      .then((data) => { if (alive) setTeacher(data); })
      .catch(() => { if (alive) setTeacher({}); });
    return () => { alive = false; };
  }, []);

  // Per-chip option lists. Prefer the teacher's curated set; fall back
  // to the global enum so a first-time teacher (empty profile) still
  // gets a usable dropdown.
  // Memoised because these are effect dependencies (the single-option
  // auto-select below). Rebuilt inline they would carry a new array identity on
  // every render and re-run the effect each time.
  const gradeOptions = useMemo(() => {
    const own = (teacher?.grade_levels || []).filter(Boolean);
    return own.length ? own : GRADE_LEVELS;
  }, [teacher]);
  const majorOptions = useMemo(() => {
    const own = (teacher?.majors || []).filter(Boolean);
    return own.length ? own : MAJORS;
  }, [teacher]);
  const languageOptions = useMemo(() => {
    const own = (teacher?.languages || []).filter(Boolean);
    return own.length ? own : QUIZ_LANGUAGES;
  }, [teacher]);
  const sectionOptions = useMemo(() => {
    const own = (teacher?.sections || []).filter(Boolean);
    return own.length ? own : QUIZ_SECTIONS;
  }, [teacher]);

  const [busy, setBusy] = useState(false);
  // Quizzes now stream as markdown text just like every other kind, so
  // the teacher watches each question get written live. The structured
  // quiz object arrives in the final `done` event (backend restructures
  // the finished markdown) and drives the editable cards.
  const [streamingText, setStreamingText] = useState("");
  // Pre-prompt knobs the teacher locks in before generating a quiz.
  // Every chip is required (REQUIRED_CHIPS) — generation is gated until set.
  // Only surfaced when kind === "quiz".
  const [quizParams, setQuizParams] = useState(QUIZ_PARAMS_DEFAULTS);
  const [activityParams, setActivityParams] = useState(ACTIVITY_PARAMS_DEFAULTS);
  const [lessonParams, setLessonParams] = useState(LESSON_PARAMS_DEFAULTS);
  const [homeworkParams, setHomeworkParams] = useState(HOMEWORK_PARAMS_DEFAULTS);
  const [presentationParams, setPresentationParams] = useState(PRESENTATION_PARAMS_DEFAULTS);

  // Auto-select any chip that has exactly one possible value (F27).
  //
  // "Make it" stays disabled until every required chip is set, but the option
  // lists are scoped to what this teacher actually teaches — so a teacher with
  // one grade, one language and one section had to open three menus that each
  // contained a single choice, and click the only thing in them. Measured on a
  // real account: three of the five required chips had exactly one option, so
  // five menus expressed two real decisions.
  //
  // A one-option list carries no information, so choosing from it is not a
  // decision the teacher is making — it is a decision the profile already made
  // during onboarding. Filling it in is the honest representation of that.
  //
  // Only ever fills a field the teacher has left empty, and only when there is
  // literally one candidate, so it can never override or guess at a choice.
  // Runs when the profile arrives (options are derived from it) and is safe to
  // re-run: already-set fields are left alone.
  useEffect(() => {
    if (!teacher) return; // profile hasn't landed yet — options aren't final
    const only = (list) => (list.length === 1 ? list[0] : null);
    const single = {
      grade: only(gradeOptions),
      major: only(majorOptions),
      language: only(languageOptions),
      section: only(sectionOptions),
    };
    const fill = (setter, keys) => setter((prev) => {
      let next = prev;
      for (const k of keys) {
        if (single[k] && !prev[k]) {
          if (next === prev) next = { ...prev };
          next[k] = single[k];
        }
      }
      return next; // unchanged reference when nothing applied — no re-render
    });
    fill(setQuizParams,         ["grade", "major", "language", "section"]);
    fill(setLessonParams,       ["grade", "major", "language", "section"]);
    fill(setHomeworkParams,     ["grade", "major", "language", "section"]);
    fill(setPresentationParams, ["grade", "major", "language", "section"]);
    // Activity has no grade/section chips by design — see ACTIVITY_PARAMS_DEFAULTS.
    fill(setActivityParams,     ["major", "language"]);
  }, [teacher, gradeOptions, majorOptions, languageOptions, sectionOptions]);
  // Optional file attachment (image or PDF) — base64-encoded, sent
  // alongside the prompt so the AI can read a textbook page, photo of
  // the board, scanned exam, etc., and base the output on it.
  //   each: { name, mediaType, dataBase64, sizeBytes }; multiple allowed
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState(null);
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  // Sections are the editable per-card breakdown of the result. They start
  // as the parsed structure of streamingText and are then mutated as the
  // user edits or regenerates individual cards.
  const [sections, setSections] = useState([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [error, setError] = useState(null);
  // Pending generation gated on the chip/prompt conflict modal.
  // Shape: { conflicts: [...], proceed: () => void } — non-null while
  // the warning modal is open.
  const [pendingConflicts, setPendingConflicts] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState(null);
  // When the teacher renames the deck inside the SlideBuilder, the
  // top "AI studio" crumb should follow live instead of staying on
  // the AI-generated heading. Stays null for non-presentation kinds.
  const [presentationTitleOverride, setPresentationTitleOverride] = useState(null);
  // True whenever the in-memory result differs from what was last
  // saved (or from the freshly-generated AI version if never saved).
  // Drives the Save button's enabled state — teachers shouldn't be
  // able to re-save a quiz they haven't changed.
  const [isDirty, setIsDirty] = useState(false);
  // When the teacher edited any correct_answer pre-save we surface a
  // confirmation modal that lists each change. Holds the diff rows
  // (null means closed).
  const [pendingAnswerConfirm, setPendingAnswerConfirm] = useState(null);
  // When the teacher tries to leave the studio mid-generation or with
  // unsaved edits, we stash the in-flight nav action here and show a
  // custom confirm modal. `proceed()` runs the original navigation if
  // they pick Leave; closing the modal cancels it.
  const [pendingLeave, setPendingLeave] = useState(null);
  // The "Ask Murchid to tweak" input. Submitting it regenerates the current
  // section with the typed hint as guidance. For structured quizzes the
  // teacher can scope the tweak to the current question or the whole quiz.
  const [tweak, setTweak] = useState("");
  const [tweakScope, setTweakScope] = useState("question"); // "question" | "quiz"
  // Inline kind popover — opened from the kind pill on the picker view.
  // Keyboard-first: arrow keys move `cursor`, Enter picks, 1–6 jump-pick.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  // Pulse the kind button briefly each time the kind changes from the menu.
  const [pulseKey, setPulseKey] = useState(0);
  const abortRef = useRef(null);
  // One AbortController per regenerating section, keyed by section id, so
  // each card can be cancelled independently.
  const regenAbortsRef = useRef(new Map());

  const active = KINDS.find((k) => k.value === kind);
  // Bumping `recencyTick` re-reads localStorage + reshuffles OR TRY,
  // so finishing a generation refreshes both rows without a remount.
  const [recencyTick, setRecencyTick] = useState(0);
  const recents = useMemo(() => loadRecents(kind), [kind, recencyTick]);
  // Suggestions swap based on attachment. With a file attached, the OR
  // TRY row becomes a how-to-use cheatsheet — "Make an exact copy",
  // "Same structure, different questions", "Translate to the chosen
  // language", etc. With no file, it shows the regular kind-specific
  // directive pool.
  const hasAttach = attachments.length > 0;
  const suggestions = useMemo(
    () => hasAttach
      ? pickAttachmentSuggestions(kind, recencyTick + Date.now() % 1000)
      : pickSuggestions(kind, recencyTick + Date.now() % 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, recencyTick, hasAttach]
  );
  const currentSection = sections[sectionIndex];
  const currentLetter = sectionIndex >= 0 ? String.fromCharCode(65 + sectionIndex) : "";
  const tweakBusy = !!currentSection?.regenerating;
  // True while ANY section is being tweaked — including a "whole quiz"
  // rewrite where every section is flagged at once, OR a "this question"
  // rewrite when the teacher has navigated away from the busy section.
  // We use this to lock down sidebar nav, prev/next, and inline edits so
  // the teacher can't race the AI mid-stream.
  const quizScopeBusy =
    result?.kind === "quiz" && sections.some((s) => s.regenerating);

  // First H1/H2 in the joined doc — used as the result-view subtitle.
  // For the quiz path the title is a typed field; prefer that over any
  // markdown heading so the header tracks live edits.
  const docTitle = useMemo(() => {
    if (result?.kind === "presentation" && presentationTitleOverride) return presentationTitleOverride;
    if (result?.kind === "quiz" && result.quiz?.title) return result.quiz.title;
    const text = sections.length && sections[0]?.markdown != null
      ? joinSections(sections)
      : streamingText;
    const line = (text || "").split(/\r?\n/).find((l) => /^#{1,3}\s+/.test(l));
    return line ? line.replace(/^#+\s*/, "").trim() : `${active?.label || ""} draft`;
  }, [result, sections, streamingText, active?.label, presentationTitleOverride]);

  // While streaming and before the final parse, run parseSections on the
  // partial text so the sidebar can show section letters lighting up as
  // they appear. Only used when the canonical sections array is empty.
  const previewSections = useMemo(() => {
    if (sections.length || !streamingText) return [];
    try {
      return parseSections(streamingText, kind) || [];
    } catch {
      return [];
    }
  }, [sections.length, streamingText, kind]);

  // Mutate the live quiz being previewed/edited. total_marks is derived
  // from the sum of question marks so the cover always matches reality.
  const updateQuiz = (patch) => {
    setResult((prev) => {
      if (!prev?.quiz) return prev;
      return { ...prev, quiz: { ...prev.quiz, ...patch } };
    });
    setIsDirty(true);
  };

  const updateQuestion = (index, patch) => {
    setResult((prev) => {
      if (!prev?.quiz) return prev;
      const questions = (prev.quiz.questions || []).map((q, i) =>
        i === index ? { ...q, ...patch } : q
      );
      // total_marks is the teacher's intended total (set on the Score field
      // and fixed). Per-question marks are allocated against it — they must
      // add up to total_marks before the quiz can be exported — so we do NOT
      // overwrite total_marks with the running sum here.
      return {
        ...prev,
        quiz: { ...prev.quiz, questions },
      };
    });
    setIsDirty(true);
  };

  const onPickKind = (next) => {
    setKind(next);
    // If the prompt is still the previous kind's sample (or empty), nudge
    // it to the new kind's sample so the user has something to start from.
    const previous = KINDS.find((k) => k.sample === prompt);
    if (!prompt.trim() || previous) {
      const found = KINDS.find((k) => k.value === next);
      if (found) setPrompt(found.sample);
    }
  };

  // Pick from the inline popover. Pulse the pill, close immediately —
  // the pill's pulse animation gives the visual confirmation.
  const onPickFromMenu = (next) => {
    onPickKind(next);
    setPulseKey((n) => n + 1);
    setPickerOpen(false);
  };

  const openPicker = () => {
    const idx = Math.max(0, KINDS.findIndex((k) => k.value === kind));
    setCursor(idx);
    setPickerOpen(true);
  };

  const surpriseMe = () => {
    const others = KINDS.filter((k) => k.value !== kind);
    const next = others[Math.floor(Math.random() * others.length)].value;
    onPickFromMenu(next);
  };

  const reset = () => {
    abortRef.current?.abort();
    setKind("lesson_plan");
    setPrompt("");
    setBusy(false);
    setStreamingText("");
    setQuizParams(QUIZ_PARAMS_DEFAULTS);
    setActivityParams(ACTIVITY_PARAMS_DEFAULTS);
    setLessonParams(LESSON_PARAMS_DEFAULTS);
    setHomeworkParams(HOMEWORK_PARAMS_DEFAULTS);
    setPresentationParams(PRESENTATION_PARAMS_DEFAULTS);
    setAttachments([]);
    setAttachError(null);
    setResult(null);
    setSections([]);
    setError(null);
    setSavedDraftId(null); setPresentationTitleOverride(null);
    setIsDirty(false);
    setPendingAnswerConfirm(null);
    setTweak("");
  };

  // Read a selected file into base64 and stash it in `attachment`. Capped
  // at 4 MB before encoding so the resulting JSON stays under the 10 MB
  // express body limit.
  const ALLOWED_ATTACH_MIME = new Set([
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "application/pdf",
  ]);
  const MAX_ATTACH_BYTES = 4 * 1024 * 1024;
  const MAX_ATTACH_COUNT = 6;

  const onPickFile = (e) => {
    setAttachError(null);
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file later
    if (files.length === 0) return;

    setAttachments((prev) => {
      const room = MAX_ATTACH_COUNT - prev.length;
      if (room <= 0) {
        setAttachError(`Up to ${MAX_ATTACH_COUNT} files. Remove one to add more.`);
        return prev;
      }
      return prev;
    });

    files.forEach((file) => {
      if (!ALLOWED_ATTACH_MIME.has(file.type)) {
        setAttachError(`Type "${file.type || "unknown"}" isn't supported. Use a PNG, JPEG, WebP, GIF, or PDF.`);
        return;
      }
      if (file.size > MAX_ATTACH_BYTES) {
        setAttachError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Cap is 4 MB per file.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        const dataBase64 = comma >= 0 ? result.slice(comma + 1) : "";
        setAttachments((prev) =>
          prev.length >= MAX_ATTACH_COUNT
            ? prev
            : [...prev, { name: file.name, mediaType: file.type, sizeBytes: file.size, dataBase64 }]
        );
      };
      reader.onerror = () => setAttachError("Could not read that file.");
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setAttachError(null);
  };

  // Consume the SSE stream from the studio endpoint. For kind=quiz we hit
  // the structured /api/studio/quiz path (tool-use → typed Quiz object);
  // every other kind uses the markdown /api/studio/generate path.
  const generate = async () => {
    // Either a typed prompt or an attached file is enough — when the
    // teacher only attaches an image of a worksheet, an empty textarea
    // is a valid signal of "use the whole image".
    if (!prompt.trim() && attachments.length === 0) return;

    // Before kicking off the fetch, scan the prompt for grade/duration/
    // slides/questions mentions that conflict with the chip values. If
    // any are found, gate the generation behind a modal so the teacher
    // can either edit or explicitly accept chip-wins.
    const isQuiz = kind === "quiz";
    const paramsForKindRaw =
      kind === "lesson_plan"   ? lessonParams       :
      kind === "homework"      ? homeworkParams     :
      kind === "activity"      ? activityParams     :
      kind === "presentation"  ? presentationParams :
      null;
    const paramsToCheck = isQuiz ? quizParams : paramsForKindRaw;
    // Every setting must be chosen first — the teacher fills all chips, so
    // Murchid never guesses the basics. The button mirrors this guard, but
    // Cmd+Enter routes here directly, so enforce it here too.
    if (!chipsComplete(kind, paramsToCheck)) return;
    const conflicts = detectChipPromptConflicts(prompt, paramsToCheck, kind);
    if (conflicts.length > 0) {
      // Hand the actual fetch to the modal — it'll call runGenerate(true)
      // if the teacher picks "use chips", or just dismiss to let them edit.
      setPendingConflicts({
        conflicts,
        proceed: () => {
          setPendingConflicts(null);
          runGenerate(true);
        },
      });
      return;
    }
    runGenerate(false);
  };

  const runGenerate = async (enforceChips) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true); setError(null); setResult(null);
    setStreamingText(""); setSavedDraftId(null);
    setSections([]);

    const isQuiz = kind === "quiz";
    // Pick the right params bag for this kind so the backend can pass
    // counts/scope into the system prompt as hard constraints. Quiz
    // has its own structured route; everyone else now goes through
    // /generate with their kind-specific params.
    const paramsForKind =
      kind === "lesson_plan"   ? lessonParams       :
      kind === "homework"      ? homeworkParams     :
      kind === "activity"      ? activityParams     :
      kind === "presentation"  ? presentationParams :
      null;
    // When the teacher leaves Language on "Auto", fall back to the UI
    // language. So an Arabic-mode teacher gets Arabic output by default;
    // explicitly picking English/Turkish/etc. in the dropdown overrides.
    const uiDefaultLang = uiLang === "ar" ? "Arabic" : "English";
    const withDefaultLang = (p) =>
      p ? { ...p, language: p.language || uiDefaultLang } : p;
    try {
      const body = isQuiz
        ? { kind, prompt: prompt.trim(), params: withDefaultLang(quizParams), attachments, enforceChips }
        : { kind, prompt: prompt.trim(), params: withDefaultLang(paramsForKind), attachments, enforceChips };
      // Raw fetch (not the api() helper) because we need a streaming
      // response body — the helper resolves the whole JSON before
      // returning. Attach the Firebase Bearer token manually so the
      // backend's requireAuth() middleware lets the request through.
      const { getIdToken } = await import("../lib/firebaseAuth");
      const token = await getIdToken().catch(() => null);
      const res = await fetch(API_BASE + (isQuiz ? "/api/studio/quiz" : "/api/studio/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const dataLine = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let payload;
          try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (payload.type === "delta") {
            acc += payload.text;
            setStreamingText(acc);
          } else if (payload.type === "done") {
            // Persist whatever the teacher just generated to the recents
            // list for this kind. Prefer the quiz title when available
            // (it's a cleaner short label than the raw prompt) and fall
            // back to the prompt text. recencyTick bump forces the
            // RECENT + OR TRY chips to refresh.
            const recentText =
              (payload.kind === "quiz" && payload.quiz?.title)
                ? payload.quiz.title
                : prompt.trim();
            pushRecent(payload.kind, recentText);
            setRecencyTick((t) => t + 1);
            // A fresh generation IS the first "change worth saving",
            // so unblock the Save button. Edits keep it true; a real
            // save flips it back to false.
            setIsDirty(true);

            if (payload.kind === "quiz" && payload.quiz) {
              // The result-watching effect rebuilds `sections` from the
              // structured quiz, so we just persist the result here. The
              // sidebar + right pane re-render automatically.
              // originalQuiz is a frozen snapshot of what the AI produced,
              // used at save-time to diff which correct_answers the teacher
              // edited and surface a "Are you sure?" confirmation.
              // Merge the picker's scheduled_for onto the AI's quiz before
              // we commit. The AI doesn't generate this field — it's purely
              // a planning value the teacher set on the picker — but it has
              // to ride along on result.quiz so the save payload picks it up.
              // Worksheet instruction line: "auto" keeps what the AI wrote,
              // "custom" swaps in the teacher's own text, "none" drops it.
              const instrMode = quizParams.instructions_mode || "none";
              const instrOverride =
                instrMode === "custom"
                  ? { instructions: quizParams.instructions || "" }
                  : instrMode === "none"
                  ? { instructions: "" }
                  : {};
              const aiQuiz = {
                ...payload.quiz,
                ...instrOverride,
                // Keep the chosen output language on the quiz so the export
                // worksheet titles can match it (Arabic quiz → Arabic, RTL).
                language: payload.quiz.language || quizParams.language || uiDefaultLang,
                ...(quizParams.scheduled_for ? { scheduled_for: quizParams.scheduled_for } : {}),
                ...(quizParams.total_marks !== "" && quizParams.total_marks != null
                  ? { total_marks: Number(quizParams.total_marks) }
                  : {}),
              };
              setResult({
                kind: "quiz",
                quiz: aiQuiz,
                originalQuiz: JSON.parse(JSON.stringify(aiQuiz)),
                stop_reason: payload.stop_reason,
                usage: payload.usage,
              });
              setSectionIndex(0);
            } else {
              setResult({
                text: acc,
                kind: payload.kind,
                stop_reason: payload.stop_reason,
                usage: payload.usage,
              });
              setSections(parseSections(acc, payload.kind));
              setSectionIndex(0);
            }
          } else if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setStreamingText("");
        setResult(null);
        setSections([]);
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => abortRef.current?.abort();

  // Keyboard shortcuts:
  //   When the kind popover is open: ↑/↓ move the cursor, Enter picks,
  //   1–6 jump-pick by index, Esc closes. Popover keys take precedence
  //   over the result-navigation arrows below.
  //   ←/→  navigate result sections (when not typing)
  //   K    open the kind popover (when not typing, picker view only)
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      const inField = tag === "TEXTAREA" || tag === "INPUT";
      if (pickerOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPickerOpen(false);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCursor((c) => (c + 1) % KINDS.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setCursor((c) => (c - 1 + KINDS.length) % KINDS.length);
          return;
        }
        if (e.key === "Home") {
          e.preventDefault();
          setCursor(0);
          return;
        }
        if (e.key === "End") {
          e.preventDefault();
          setCursor(KINDS.length - 1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const target = KINDS[cursor];
          if (target) onPickFromMenu(target.value);
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < KINDS.length) {
            e.preventDefault();
            onPickFromMenu(KINDS[idx].value);
          }
          return;
        }
        return;
      }
      // Lock arrow nav while a tweak is in flight so the teacher can't race
      // a question rewrite by skipping past it.
      const navLocked =
        result?.kind === "quiz" && sections.some((s) => s.regenerating);
      if (e.key === "ArrowLeft" && !inField && sections.length > 1 && !navLocked) {
        setSectionIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" && !inField && sections.length > 1 && !navLocked) {
        setSectionIndex((i) => Math.min(sections.length - 1, i + 1));
      } else if ((e.key === "k" || e.key === "K") && !inField && sections.length === 0 && !busy) {
        e.preventDefault();
        openPicker();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections, sections.length, pickerOpen, busy, cursor, kind, result?.kind]);

  // Reset / clamp the visible section index whenever sections change.
  useEffect(() => {
    if (sections.length === 0) {
      setSectionIndex(0);
    } else if (sectionIndex >= sections.length) {
      setSectionIndex(sections.length - 1);
    }
  }, [sections.length, sectionIndex]);

  // Re-synthesize sections from the live quiz on every edit so the sidebar
  // titles + per-question references stay in sync with what the teacher
  // typed. Only runs while in the quiz path; the markdown path's sections
  // are managed by parseSections elsewhere.
  useEffect(() => {
    if (result?.kind !== "quiz" || !result.quiz) return;
    const q = result.quiz;
    const next = [
      { id: "meta", title: q.title || "Cover", kind: "quiz_meta" },
      ...(q.questions || []).map((qq, i) => ({
        id: `q-${qq.position ?? i + 1}`,
        title:
          (qq.prompt || "").trim().slice(0, 50) ||
          `Question ${qq.position ?? i + 1}`,
        kind: "quiz_question",
        question: qq,
      })),
    ];
    setSections(next);
  }, [result]);

  // Warn before the user discards an in-flight or freshly-generated draft.
  // We skip the warning for a saved-and-clean quiz — there's nothing to lose
  // there and the modal would just be friction. Presentations are exempt
  // entirely: the SlideBuilder owns its own save + "Saved" state, so the
  // studio guard (with its quiz-worded copy) is just noise there.
  useEffect(() => {
    if (kind === "presentation") return;
    const hasInflight = busy || !!streamingText;
    // The generated page ALWAYS confirms before leaving — even once the
    // draft is saved and clean. (Per product: "still ask to exit the
    // generated page even after a save.") Pre-generation we only guard
    // when there's drafted content to lose.
    const onGeneratedPage = !!result;
    const hasDraftContent = !result && sections.length > 0;
    if (!hasInflight && !onGeneratedPage && !hasDraftContent) return;

    // In-app navigation (sidebar tabs, the × close button, etc.) routes
    // through setNavGuard — it returns false to hold the transition and
    // surfaces our custom modal instead.
    const cleanupGuard = setNavGuard((proceed) => {
      setPendingLeave({ proceed });
      return false;
    });

    // Browser Back / two-finger swipe fire `popstate`, which bypasses
    // setNavGuard entirely. We intercept it: prime one buffer history
    // entry, and whenever the user pops it, re-push to cancel the back
    // and surface the same confirm modal. Confirming steps back over the
    // buffer (go(-2)) to the real previous page.
    let leaving = false;
    const guardUrl = window.location.href;
    window.history.pushState(null, "", guardUrl);
    const onPopState = () => {
      if (leaving) return;
      window.history.pushState(null, "", guardUrl); // re-absorb the back
      setPendingLeave({
        proceed: () => {
          leaving = true;
          window.removeEventListener("popstate", onPopState);
          // Two entries back: over our buffer, then off the studio page.
          window.history.go(-2);
        },
      });
    };
    window.addEventListener("popstate", onPopState);

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cleanupGuard();
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [busy, streamingText, result, sections.length, savedDraftId, isDirty, kind]);

  // Internal — the actual reset. Wrapped by makeAnother() below which
  // checks for unsaved work first and surfaces the leave-confirm modal
  // instead of silently dropping the draft.
  const resetForNewDraft = () => {
    abortRef.current?.abort();
    regenAbortsRef.current.forEach((c) => c.abort?.());
    regenAbortsRef.current.clear();
    setBusy(false);
    setStreamingText("");
    setResult(null);
    setSections([]);
    setSectionIndex(0);
    setSavedDraftId(null); setPresentationTitleOverride(null);
    setIsDirty(false);
    setPendingAnswerConfirm(null);
    setError(null);
    setTweak("");
  };

  // Clicking "New" used to drop the current draft on the floor — even
  // if the teacher had unsaved edits or generation in flight. Route it
  // through the same leave-confirm modal we use for navigating away so
  // the teacher gets a chance to save first.
  const makeAnother = () => {
    const hasInflight = busy || !!streamingText;
    const hasUnsavedContent = !!result
      ? !savedDraftId || isDirty
      : sections.length > 0;
    // Presentations: SlideBuilder owns its own save — no studio confirm.
    if (kind !== "presentation" && (hasInflight || hasUnsavedContent)) {
      setPendingLeave({ proceed: resetForNewDraft });
      return;
    }
    resetForNewDraft();
  };

  // --- per-section editing -------------------------------------------------

  const setSectionMarkdown = (id, markdown) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, markdown } : s)));
  };

  const removeSection = (id) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const cancelRegenerate = (id) => {
    const ctrl = regenAbortsRef.current.get(id);
    ctrl?.abort?.();
    regenAbortsRef.current.delete(id);
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, regenerating: false, streamingMarkdown: null } : s))
    );
  };

  // Stream a fresh replacement for a single section.
  const regenerateSection = async (id, hint) => {
    const target = sections.find((s) => s.id === id);
    if (!target) return;

    const ctrl = new AbortController();
    regenAbortsRef.current.set(id, ctrl);
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, regenerating: true, streamingMarkdown: "" } : s))
    );

    try {
      const fullDocument = sections.map((s) => s.markdown).join("\n\n");
      // Streaming endpoint — raw fetch instead of api(). Same Bearer-
      // token attach pattern as the main generate call above.
      const { getIdToken } = await import("../lib/firebaseAuth");
      const token = await getIdToken().catch(() => null);
      const res = await fetch(API_BASE + "/api/studio/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind: result?.kind || kind,
          fullDocument,
          sectionMarkdown: target.markdown,
          hint: hint || null,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evt of events) {
          const dataLine = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let payload;
          try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (payload.type === "delta") {
            acc += payload.text;
            setSections((prev) =>
              prev.map((s) => (s.id === id ? { ...s, streamingMarkdown: acc } : s))
            );
          } else if (payload.type === "done") {
            setSections((prev) =>
              prev.map((s) =>
                s.id === id
                  ? { ...s, markdown: acc.trim(), streamingMarkdown: null, regenerating: false }
                  : s
              )
            );
          } else if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(`Could not regenerate "${target.title}": ${e.message}`);
      }
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, regenerating: false, streamingMarkdown: null } : s))
      );
    } finally {
      regenAbortsRef.current.delete(id);
    }
  };

  // Always derive from sections so manual edits + regenerations flow through.
  const fullText = () => (sections.length ? joinSections(sections) : streamingText);

  const exportPdf = () => {
    if (exportBlocked) return;
    window.print();
  };

  // Per-kind export formats. Lesson plans, quizzes, and homework can be
  // shipped to either PDF or Word; presentations are slide decks so PDF is
  // the only sensible static target. Derive from result.kind when available
  // (post-generation) and fall back to the current selection.
  const FORMATS_BY_KIND = {
    lesson_plan:  ["pdf", "doc"],
    quiz:         ["pdf", "doc"],
    homework:     ["pdf", "doc"],
    presentation: ["pdf"],
    activity:     ["pdf"],
  };
  const exportKind = result?.kind || kind;
  const availableFormats = FORMATS_BY_KIND[exportKind] || ["pdf"];

  // The current kind's settings bag + whether every required chip is set.
  // Gates the "Make it" button so the teacher chooses everything first.
  const currentKindParams =
    kind === "quiz"         ? quizParams         :
    kind === "lesson_plan"  ? lessonParams       :
    kind === "homework"     ? homeworkParams     :
    kind === "activity"     ? activityParams     :
    kind === "presentation" ? presentationParams :
    null;
  const paramsComplete = chipsComplete(kind, currentKindParams);

  // Per-question marks allocation. total_marks is the teacher's fixed total
  // (Score field); the per-question marks must add up to it before the quiz
  // can be exported, so the teacher consciously weights every question.
  const quizMarks = (() => {
    if (result?.kind !== "quiz" || !result.quiz) return null;
    const qs = result.quiz.questions || [];
    const total = Number(result.quiz.total_marks) || 0;
    const allocated = qs.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    return {
      total,
      allocated,
      remaining: total - allocated,
      count: qs.length,
      balanced: total > 0 && qs.length > 0 && allocated === total,
    };
  })();
  // Block PDF / Word export until every mark is allocated to a question.
  const exportBlocked = !!quizMarks && quizMarks.total > 0 && !quizMarks.balanced;
  // The on-screen quiz preview reads right-to-left for an Arabic quiz.
  const quizRtl = result?.kind === "quiz" && isArabicLang(result.quiz?.language);

  // Drop a single leading "# Title" line so the worksheet header (which
  // already prints the title centered) isn't followed by a duplicate H1.
  const stripLeadingTitle = (md) => {
    if (!md) return md;
    return md.replace(/^\s*#{1,6}\s+[^\n]*\n+/, "");
  };
  const sanitizeFilename = (s) => {
    const cleaned = String(s || "Murchid document").replace(/[\/\\:*?"<>|]/g, "").trim();
    return (cleaned.slice(0, 100) || "Murchid document");
  };
  // Real .docx — opens in Word, Pages, Google Docs, LibreOffice. The
  // earlier HTML-as-.doc trick worked in Word only and Apple Pages
  // refused to read it. `docx` is dynamic-imported so the package only
  // ships when the teacher actually clicks Word.
  const exportDoc = async () => {
    if (!result || exportBlocked) return;
    const docx = await import("docx");
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
      BorderStyle, LevelFormat, Table, TableRow, TableCell, WidthType, TableLayoutType,
    } = docx;
    const NO_BORDERS = {
      top:    { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    };

    // markdown → docx runs (handles **bold**, *italic*)
    const inlineRuns = (text) => {
      const out = [];
      let remaining = text || "";
      while (remaining.length > 0) {
        const bold = remaining.match(/^([\s\S]*?)\*\*([\s\S]+?)\*\*([\s\S]*)$/);
        const italic = remaining.match(/^([\s\S]*?)\*([^*\n]+?)\*([\s\S]*)$/);
        const candidates = [
          bold && { kind: "bold", m: bold, start: bold[1].length },
          italic && { kind: "italic", m: italic, start: italic[1].length },
        ].filter(Boolean);
        candidates.sort((a, b) => a.start - b.start);
        const w = candidates[0];
        if (!w) { out.push(new TextRun(remaining)); break; }
        if (w.m[1]) out.push(new TextRun(w.m[1]));
        if (w.kind === "bold")   out.push(new TextRun({ text: w.m[2], bold: true }));
        else                     out.push(new TextRun({ text: w.m[2], italics: true }));
        remaining = w.m[3];
      }
      return out.length ? out : [new TextRun("")];
    };
    // markdown body → docx paragraphs (subset matching renderMarkdown)
    const headingFor = [
      HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
    ];
    const mdToDocxParagraphs = (md) => {
      if (!md) return [];
      const lines = md.split(/\r?\n/);
      const out = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
          const level = Math.min(h[1].length, 6);
          out.push(new Paragraph({
            children: inlineRuns(h[2]),
            heading: headingFor[level - 1],
            spacing: { before: 200, after: 100 },
          }));
          i++; continue;
        }
        if (/^\s*[\*\-]\s+/.test(line)) {
          while (i < lines.length && /^\s*[\*\-]\s+/.test(lines[i])) {
            out.push(new Paragraph({
              children: inlineRuns(lines[i].replace(/^\s*[\*\-]\s+/, "")),
              bullet: { level: 0 },
            }));
            i++;
          }
          continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
            out.push(new Paragraph({
              children: inlineRuns(lines[i].replace(/^\s*\d+\.\s+/, "")),
              numbering: { reference: "studio-numbering", level: 0 },
            }));
            i++;
          }
          continue;
        }
        if (!line.trim()) { i++; continue; }
        const para = [line]; i++;
        while (i < lines.length && lines[i].trim() &&
               !/^(#{1,6})\s+/.test(lines[i]) &&
               !/^\s*[\*\-]\s+/.test(lines[i]) &&
               !/^\s*\d+\.\s+/.test(lines[i])) {
          para.push(lines[i]); i++;
        }
        out.push(new Paragraph({ children: inlineRuns(para.join(" ")) }));
      }
      return out;
    };

    const children = [];
    const k = result.kind;
    // Quiz, homework, AND lesson all get the worksheet-style header. Lesson
    // is a teacher-facing doc but still benefits from the Name / Grade /
    // Section / Major / Date row at the top — same layout, just no Score.
    const isWorksheet = k === "quiz" || k === "homework" || k === "lesson_plan";

    // ---- worksheet header (quiz + homework + lesson) ----
    // Titles follow the OUTPUT's own language (not the app toggle): Arabic
    // → Arabic titles laid out right-to-left; everything else English.
    // For non-quiz kinds the AI's structured object doesn't exist, so pull
    // grade/section/major/scheduled/score off the chip params (mapped so
    // `major` reads as `subject` to match the worksheet field label).
    const fromParams = (p) => p ? { ...p, subject: p.major } : {};
    const headerMeta =
      k === "quiz"       ? (result.quiz || {}) :
      k === "homework"   ? fromParams(homeworkParams) :
      k === "lesson_plan"? fromParams(lessonParams) :
      {};
    const qLang = headerMeta.language;
    const rtl = isArabicLang(qLang);
    const L = (key) => tIn(qLang, key);
    // Use PHYSICAL alignment for Arabic: AlignmentType.START / END are
    // supposed to flip based on paragraph direction, but Microsoft Word
    // (and Apple Pages) don't reliably honor jc="start" inside a bidi
    // paragraph — text comes out left-aligned even when bidirectional is
    // set. Map to RIGHT/LEFT explicitly so every viewer obeys.
    const align = rtl ? AlignmentType.RIGHT : undefined;
    if (isWorksheet) {
      // centered serif title, underlined full-width like the PDF worksheet
      children.push(new Paragraph({
        children: [new TextRun({ text: docTitle, size: 48, font: "Georgia", rightToLeft: rtl })],
        alignment: AlignmentType.CENTER,
        bidirectional: rtl,
        spacing: { after: 160 },
        border: { bottom: { color: "1A1814", size: 8, space: 10, style: BorderStyle.SINGLE } },
      }));
      // breathing room under the title rule, before the fill-in fields
      children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
      // Fill-in fields — Date / Grade / Section / Major are pre-filled with
      // what the teacher already set; Name and Score stay blank for the
      // student / grading. LTR uses a tab stop at the page midpoint for two
      // columns (a docx table collapses in Pages/Preview). RTL drops to one
      // right-aligned column per line — RTL tab stops are unreliable.
      const scheduled = headerMeta.scheduled_for ? String(headerMeta.scheduled_for).slice(0, 10) : "";
      const totalMarks = headerMeta.total_marks;
      const blank = "______________";
      const scoreExtra = totalMarks ? [new TextRun({ text: ` / ${totalMarks}`, bold: true })] : [];
      const fieldRuns = (label, value, extra = []) => [
        new TextRun({ text: `${label}: `, bold: true, rightToLeft: rtl }),
        value ? new TextRun({ text: String(value), bold: true }) : new TextRun({ text: blank }),
        ...extra,
      ];
      // Score row only appears for quiz (always) and homework (when the
      // teacher set a total). For lesson_plan we drop the Major/Score row
      // down to a Major-only row so the page doesn't carry an unused Score
      // line — lessons aren't student-facing assessments.
      const showScore = scoreVisibleFor(k, totalMarks);
      const rows = [
        [{ label: L("ws.name"), value: "" }, { label: L("ws.date"), value: scheduled }],
        [{ label: L("ws.grade"), value: trimFieldPrefix(headerMeta.grade, "Grade") }, { label: L("ws.section"), value: trimFieldPrefix(headerMeta.section, "Section") }],
        showScore
          ? [{ label: L("ws.major"), value: headerMeta.subject }, { label: L("ws.score"), value: "", extra: scoreExtra }]
          : [{ label: L("ws.major"), value: headerMeta.subject }, null],
      ];
      // Two-column header via a fixed-width borderless TABLE — same structure
      // for English and Arabic. Tab stops are ignored by some .docx viewers
      // (Pages / Quick Look), so a table is the only reliable way to pin the
      // outer column to the page edge. The primary column (Name/Grade/Major)
      // is wide and hugs the outer edge; the secondary column (Date/Section/
      // Score) is narrower and hugs the inner... For Arabic the whole table is
      // laid right-to-left (visuallyRightToLeft) so it mirrors the English.
      // outer column hugs the leading edge, secondary hugs the far edge.
      // For LTR: outer=LEFT, secondary=RIGHT. For RTL: outer=RIGHT, secondary=LEFT.
      // (START/END are spec'd as direction-aware but Word/Pages don't honor
      // them reliably inside bidi paragraphs — use physical alignment.)
      const outerAlign = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
      const innerAlign = rtl ? AlignmentType.LEFT : AlignmentType.RIGHT;
      const cell = (runs, width, outer) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { top: 30, bottom: 30, left: 0, right: 0 },
        children: [new Paragraph({
          bidirectional: rtl,
          alignment: outer ? outerAlign : innerAlign,
          children: runs,
        })],
      });
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: [5760, 3600],
        borders: NO_BORDERS,
        visuallyRightToLeft: rtl,
        rows: rows.map(([f1, f2]) => new TableRow({
          children: [
            cell(fieldRuns(f1.label, f1.value, f1.extra), 5760, true),
            // Second cell may be null when a row carries a single field
            // (lesson_plan drops the Score field, leaving Major alone).
            // Emit an empty cell so the table stays a 2-column grid.
            f2
              ? cell(fieldRuns(f2.label, f2.value, f2.extra), 3600, false)
              : cell([new TextRun({ text: "" })], 3600, false),
          ],
        })),
      }));
      // instructions pull-quote (quiz only) — with a gap above it so it
      // doesn't sit right on the Major / Score line.
      if (k === "quiz" && headerMeta.instructions) {
        children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
        children.push(new Paragraph({
          alignment: align,
          bidirectional: rtl,
          children: [
            new TextRun({ text: `${L("ws.instructions")}: `, bold: true, rightToLeft: rtl }),
            new TextRun({ text: headerMeta.instructions, italics: true }),
          ],
          spacing: { before: 120, after: 240 },
        }));
      }
      // gap between the header block and the first question
      children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
    }

    // ---- body ----
    // Question text comes from the AI in the quiz's language; align / indent
    // it to match (right-to-left for Arabic) and translate the fixed bits.
    const indentInside = rtl ? { right: 480 } : { left: 480 };
    if (k === "quiz" && result.quiz) {
      const questions = result.quiz.questions || [];
      questions.forEach((qq, i) => {
        // blank line between questions so they don't run together
        if (i > 0) children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
        const num = qq.position ?? i + 1;
        const marks = qq.marks
          ? `  (${qq.marks} ${qq.marks > 1 ? L("export.marks") : L("export.mark")})`
          : "";
        children.push(new Paragraph({
          alignment: align,
          bidirectional: rtl,
          children: [
            new TextRun({ text: `${num}. `, bold: true, rightToLeft: rtl }),
            new TextRun({ text: qq.prompt || "", bold: true, rightToLeft: rtl }),
            new TextRun({ text: marks, italics: true, color: "6B675E", rightToLeft: rtl }),
          ],
          spacing: { before: 80, after: 80 },
        }));
        // blank line between the question and its answers (MCQ options /
        // True-False / write-in lines). Paragraph spacing alone is ignored by
        // some .docx viewers, so use a real empty paragraph.
        children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
        if (qq.type === "mcq" && Array.isArray(qq.choices) && qq.choices.length) {
          // Each option gets an empty bubble for the student to tick.
          qq.choices.forEach((c) => {
            const tx = typeof c === "string" ? c : (c?.text ?? c?.label ?? "");
            children.push(new Paragraph({
              alignment: align,
              bidirectional: rtl,
              children: [
                new TextRun({ text: "○  ", rightToLeft: rtl }),
                new TextRun({ text: tx, rightToLeft: rtl }),
              ],
              indent: indentInside,
              spacing: { after: 100 },
            }));
          });
        } else if (qq.type === "tf" || qq.type === "true_false") {
          children.push(new Paragraph({
            alignment: align,
            bidirectional: rtl,
            children: [new TextRun({ text: `○ ${L("export.true")}       ○ ${L("export.false")}`, rightToLeft: rtl })],
            indent: indentInside,
            spacing: { after: 140 },
          }));
        } else {
          // write-in: real underscore lines the student writes on
          for (let r = 0; r < 3; r++) {
            children.push(new Paragraph({
              children: [new TextRun({ text: "_".repeat(60) })],
              alignment: align,
              bidirectional: rtl,
              spacing: { before: 60, after: 220 },
            }));
          }
        }
      });
    } else {
      const md = fullText();
      children.push(...mdToDocxParagraphs(isWorksheet ? stripLeadingTitle(md) : md));
    }

    const doc = new Document({
      creator: "Murchid",
      title: docTitle,
      numbering: {
        config: [{
          reference: "studio-numbering",
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 480, hanging: 360 } } },
          }],
        }],
      },
      styles: {
        default: {
          document: { run: { font: "Arial", size: 22 } },
        },
      },
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(docTitle)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy works as soon as there's any text — including mid-stream.
  const copyToClipboard = async () => {
    const text = fullText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // For quizzes only — compare each question's correct_answer to the AI's
  // original snapshot and return the rows that changed. Used at Save time.
  const diffChangedAnswers = () => {
    if (result?.kind !== "quiz" || !result.quiz || !result.originalQuiz) return [];
    const current = result.quiz.questions || [];
    const original = result.originalQuiz.questions || [];
    const changes = [];
    for (let i = 0; i < current.length; i++) {
      const c = current[i];
      const o = original[i];
      if (!o) continue;
      const a = JSON.stringify(c?.correct_answer);
      const b = JSON.stringify(o?.correct_answer);
      if (a !== b) {
        changes.push({
          position: c.position ?? i + 1,
          type: c.type,
          was: o.correct_answer,
          now: c.correct_answer,
          prompt: c.prompt,
        });
      }
    }
    return changes;
  };

  const handleSaveClick = () => {
    const changes = diffChangedAnswers();
    if (changes.length > 0) {
      setPendingAnswerConfirm(changes);
      return;
    }
    saveAsDraft();
  };

  const saveAsDraft = async () => {
    setPendingAnswerConfirm(null);
    setSaving(true);
    try {
      // Quiz path: persist as a real Quiz row + its quiz_questions in one
      // atomic transaction. The teacher can then open it in QuizBuilder
      // for further edits / scoring.
      if (result?.kind === "quiz" && result.quiz) {
        const q = result.quiz;
        const payload = {
          title: q.title || "Untitled quiz",
          subject: q.subject || null,
          grade: q.grade || null,
          section: q.section || null,
          language: q.language || null,
          difficulty: q.difficulty || null,
          duration_minutes: q.duration_minutes || null,
          total_marks: q.total_marks || null,
          instructions: q.instructions || null,
          scheduled_for: q.scheduled_for || null,
          status: "Draft",
          questions: (q.questions || []).map((qq, i) => ({
            position: qq.position ?? i + 1,
            type: qq.type,
            prompt: qq.prompt,
            choices: qq.choices ?? null,
            correct_answer: qq.correct_answer ?? null,
            marks: qq.marks ?? 1,
          })),
        };
        if (savedDraftId) {
          await api(`/api/quizzes/${savedDraftId}/sync`, { method: "POST", body: payload });
        } else {
          const created = await api("/api/quizzes/bulk", { method: "POST", body: payload });
          setSavedDraftId(created.quiz.id);
        }
        // Freeze a new snapshot so further edits diff against the just-saved
        // state, not the AI's original — otherwise the answer-change modal
        // would re-fire on every re-save.
        setResult((prev) => (prev ? { ...prev, originalQuiz: JSON.parse(JSON.stringify(prev.quiz)) } : prev));
        setIsDirty(false);
        return;
      }

      // Activity path: activities have their own table and their own screen, so
      // a generated one belongs there rather than in the drafts pile. The params
      // panel deliberately carries no grade or section (chip rules), so those
      // stay null and the teacher sets them in ActivityBuilder.
      if (result?.kind === "activity") {
        const text = fullText();
        if (!text) return;
        const body = {
          title: titleFromMarkdown(text, "Untitled activity"),
          type: activityParams.type || null,
          subject: activityParams.major || null,
          duration_minutes: activityParams.duration ? Number(activityParams.duration) : null,
          scheduled_for: activityParams.scheduled_for || null,
          instructions: text,
        };
        if (savedDraftId) {
          await api(`/api/activities/${savedDraftId}`, { method: "PATCH", body });
        } else {
          const created = await api("/api/activities", { method: "POST", body });
          setSavedDraftId(created.id);
        }
        setIsDirty(false);
        return;
      }

      // Homework path (F52). homework has its own table, its own screen and its
      // own builder — a generated one landing under Lesson Plans meant the
      // teacher had to find it in the wrong place and could not open it in
      // HomeworkBuilder at all. `instructions` is a text column, so the
      // generated markdown maps straight onto it.
      //
      // status is left to the column default ('Open'), matching what
      // HomeworkBuilder starts a new assignment with.
      if (result?.kind === "homework") {
        const text = fullText();
        if (!text) return;
        const body = {
          title: titleFromMarkdown(text, "Untitled homework"),
          subject: homeworkParams.major || null,
          grade: homeworkParams.grade || null,
          section: sectionToColumn(homeworkParams.section),
          instructions: text,
          due_date: homeworkParams.scheduled_for || null,
        };
        if (savedDraftId) {
          await api(`/api/homework/${savedDraftId}`, { method: "PATCH", body });
        } else {
          const created = await api("/api/homework", { method: "POST", body });
          setSavedDraftId(created.id);
        }
        setIsDirty(false);
        return;
      }

      // Presentation path (F52). The deck is stored as `slides` jsonb, so the
      // generated markdown is split into one slide per heading. We emit
      // { title, body } rather than a full slide object on purpose:
      // deckFromPresentation() already falls back to splitting `body` into
      // bullets when `bullets` is absent, so this is the shape it is built to
      // accept, and SlideBuilder owns layout/background defaults from there.
      if (result?.kind === "presentation") {
        const text = fullText();
        if (!text) return;
        const body = {
          title: presentationTitleOverride
            || titleFromMarkdown(text, "Untitled presentation"),
          subject: presentationParams.major || null,
          grade: presentationParams.grade || null,
          section: sectionToColumn(presentationParams.section),
          scheduled_for: presentationParams.scheduled_for || null,
          slides: slidesFromMarkdown(text),
        };
        if (savedDraftId) {
          await api(`/api/presentations/${savedDraftId}`, { method: "PATCH", body });
        } else {
          const created = await api("/api/presentations", { method: "POST", body });
          setSavedDraftId(created.id);
        }
        setIsDirty(false);
        return;
      }

      // Markdown path — lesson plans only now. The drafts table is structured
      // around lesson plans, and every other kind has its own table above.
      const text = fullText();
      if (!text) return;
      const name = titleFromMarkdown(text, "Untitled lesson");
      const draft = await api("/api/drafts", {
        method: "POST",
        body: {
          name,
          subject: "—",
          status: "In progress",
          progress: 50,
          note: "Generated by AI Studio. Refine below.",
          main_activity: text,
          objectives: [],
          materials: [],
        },
      });
      setSavedDraftId(draft.id);
      setIsDirty(false);
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Apply the tweak input as guidance to regenerate something. Three shapes:
  //   - Markdown path: regenerate the current section's markdown via the
  //     existing /api/studio/regenerate endpoint.
  //   - Quiz path, scope=question: rewrite the open question via the new
  //     /api/studio/quiz-tweak endpoint, then swap it into result.quiz.
  //   - Quiz path, scope=quiz: rewrite the entire quiz via the same
  //     endpoint and replace result.quiz wholesale.
  const sendTweak = () => {
    const hint = tweak.trim();
    if (!hint || sections.length === 0 || tweakBusy) return;
    if (result?.kind === "quiz" && result.quiz) {
      const effectiveScope =
        currentSection?.kind === "quiz_meta" ? "quiz" : tweakScope;
      tweakQuiz(hint, effectiveScope);
      return;
    }
    setTweak("");
    regenerateSection(currentSection.id, hint);
  };

  // Stream a tweaked question (or whole quiz) back from the structured
  // /api/studio/quiz-tweak endpoint and merge the result in place.
  const tweakQuiz = async (hint, scope) => {
    const q = result?.quiz;
    if (!q) return;
    const questionIndex = scope === "question" ? sectionIndex - 1 : null;

    // Reuse the per-section regenerating flag so the card shows a busy
    // affordance and the tweak input disables itself. For scope=quiz we
    // flag every section so the sidebar reads "Drafting" across the
    // board; the new quiz overwrites them as soon as it arrives.
    setSections((prev) =>
      prev.map((s) =>
        scope === "question"
          ? s.id === currentSection?.id
            ? { ...s, regenerating: true }
            : s
          : { ...s, regenerating: true }
      )
    );
    const ctrl = new AbortController();
    if (scope === "question" && currentSection?.id) {
      regenAbortsRef.current.set(currentSection.id, ctrl);
    } else {
      regenAbortsRef.current.set("__quiz__", ctrl);
    }
    setTweak("");

    try {
      // Same auth attach pattern as the other streaming endpoints.
      const { getIdToken } = await import("../lib/firebaseAuth");
      const token = await getIdToken().catch(() => null);
      const res = await fetch(API_BASE + "/api/studio/quiz-tweak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          quiz: q,
          hint,
          scope,
          questionIndex,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evt of events) {
          const dataLine = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let payload;
          try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }
          if (payload.type === "done") {
            if (payload.scope === "question" && payload.question) {
              setResult((prev) => {
                if (!prev?.quiz) return prev;
                const nextQuestions = (prev.quiz.questions || []).slice();
                nextQuestions[questionIndex] = payload.question;
                const totalMarks = nextQuestions.reduce(
                  (acc, qq) => acc + (Number(qq.marks) || 0),
                  0
                );
                return {
                  ...prev,
                  quiz: { ...prev.quiz, questions: nextQuestions, total_marks: totalMarks },
                };
              });
            } else if (payload.scope === "quiz" && payload.quiz) {
              setResult((prev) =>
                prev ? { ...prev, quiz: payload.quiz } : prev
              );
            }
            setIsDirty(true);
          } else if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(`Could not apply tweak: ${e.message}`);
      }
    } finally {
      setSections((prev) => prev.map((s) => ({ ...s, regenerating: false })));
      if (scope === "question" && currentSection?.id) {
        regenAbortsRef.current.delete(currentSection.id);
      } else {
        regenAbortsRef.current.delete("__quiz__");
      }
    }
  };

  const makeHarder = () => {
    if (!currentSection) return;
    regenerateSection(currentSection.id, "Make this section more challenging — bump cognitive load and depth, but keep the structure.");
  };

  // -------- view selection -------------------------------------------------

  const showResult = busy || !!streamingText || !!result || sections.length > 0;

  if (showResult) {
    const items = (currentSection?.markdown || "")
      .split(/\n/)
      .filter((l) => /^[\-*]|\d+\./.test(l.trim()))
      .length;

    // Once a presentation finishes generating, hand the markdown to the
    // Canva-style SlideBuilder — the teacher edits the deck on the slides
    // themselves instead of through the section/refine flow.
    const presentationDeck = kind === "presentation" && !!result && !busy;

    return (
      <div className="max-w-6xl mx-auto pb-4">
        {/* Top bar: brand + crumb + actions */}
        <div className="flex items-center justify-between gap-4 mb-5 print:hidden flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-ink leading-none flex-shrink-0">
              AI <em className="italic font-light text-accent">studio</em>
            </h2>
            <span className="hidden md:block h-6 w-px bg-line" />
            <p className="hidden md:block font-serif text-base md:text-lg italic text-ink-soft truncate max-w-md leading-tight">
              {docTitle}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* The marks-allocation status lives once, below the marks
                stepper inside the current question card (QuizQuestionCard)
                — not duplicated here in the top bar. */}
            {availableFormats.includes("doc") && (
              <Button
                variant="secondary"
                onClick={exportDoc}
                disabled={!result || exportBlocked}
                className="text-xs px-3 py-1.5"
                title={exportBlocked ? "Assign all marks to the questions first" : "Download as a Microsoft Word document"}
              >
                <FileText size={13} className="mr-1.5" /> {t("studio.doc")}
              </Button>
            )}
            {availableFormats.includes("pdf") && (
              <Button
                variant="secondary"
                onClick={exportPdf}
                disabled={!result || exportBlocked}
                className="text-xs px-3 py-1.5"
                title={exportBlocked ? "Assign all marks to the questions first" : "Open the print dialog and choose Save as PDF"}
              >
                <FileDown size={13} className="mr-1.5" /> {t("studio.pdf")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={copyToClipboard}
              disabled={!fullText()}
              className="text-xs px-3 py-1.5"
            >
              {copied
                ? <><Check size={13} className="mr-1.5" /> {t("studio.copied")}</>
                : <><Copy size={13} className="mr-1.5" /> {t("studio.copy")}</>}
            </Button>
            {savedDraftId && !isDirty ? (
              <span className="font-serif italic text-sm text-sage inline-flex items-center gap-1.5 px-2">
                <Check size={13} /> Saved #{savedDraftId}
              </span>
            ) : (
              <Button
                variant="secondary"
                onClick={handleSaveClick}
                disabled={saving || !result || !isDirty}
                title={savedDraftId
                  ? `Update saved quiz #${savedDraftId} with your edits`
                  : "Save the whole quiz — cover + every question — to your library"}
                className="text-xs px-3 py-1.5"
              >
                <Save size={13} className="mr-1.5" />
                {saving ? t("studio.saving") : t("studio.save")}
              </Button>
            )}
            {busy ? (
              <Button variant="secondary" onClick={cancel} className="text-xs px-3 py-1.5">
                <X size={13} className="mr-1.5" /> {t("studio.cancel")}
              </Button>
            ) : (
              <Button onClick={makeAnother} className="text-xs px-3 py-1.5">
                <Sparkles size={13} className="mr-1.5" /> {t("studio.new")}
              </Button>
            )}
          </div>
        </div>

        {presentationDeck ? (
          <Card className="studio-result-card shadow-sm overflow-hidden">
            <div className="p-5 md:p-7">
              <SlideBuilder
                markdown={result.text}
                presentationParams={presentationParams}
                onDeckTitleChange={(t) => setPresentationTitleOverride(t || null)}
                onSaved={(saved) => {
                  setSavedDraftId(saved.id);
                  setIsDirty(false);
                  if (saved?.title) setPresentationTitleOverride(saved.title);
                }}
              />
            </div>
          </Card>
        ) : (
        <>
        {/* Two-column card: sidebar + right pane */}
        <Card className="studio-result-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
            {/* Sidebar — sections list */}
            <aside className="border-b md:border-b-0 md:border-r border-line bg-paper-warm/30 print:hidden">
              <div className="p-4 md:p-5">
                <p className="font-serif italic text-base text-muted mb-3">Sections</p>
                {sections.length === 0 ? (
                  busy ? (
                    <div className="space-y-1.5">
                      {previewSections.map((s, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const slideMatch = kind === "presentation"
                          ? (s.title || "").match(/^Slide\s+(\d+)\s*[—:\-]?\s*(.*)$/i)
                          : null;
                        const isSlide = Boolean(slideMatch);
                        const badge = isSlide ? slideMatch[1] : letter;
                        const label = isSlide
                          ? (slideMatch[2].trim() || `Slide ${slideMatch[1]}`)
                          : (s.title || `Part ${letter}`);
                        return (
                          <div
                            key={s.id || i}
                            className="studio-section-fade-in flex items-start gap-2.5 px-2.5 py-2 rounded-lg"
                          >
                            <span className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-md font-mono text-[11px] uppercase tracking-wider bg-ink text-paper-cool flex items-center justify-center">
                              {badge}
                            </span>
                            <span className="flex-1 min-w-0">
                              {isSlide && (
                                <span className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-0.5">
                                  Slide {slideMatch[1]}
                                </span>
                              )}
                              <span className={`block text-sm text-ink-soft ${isSlide ? "line-clamp-2" : "truncate"}`}>
                                {label}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg opacity-60">
                        <span className="flex-shrink-0 h-7 w-7 rounded-md bg-line/60 animate-pulse" />
                        <span className="flex-1 min-w-0 text-xs text-muted inline-flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                          Drafting…
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">No sections yet.</p>
                  )
                ) : (
                  <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0">
                    {sections.map((s, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isActive = i === sectionIndex;
                      const itemCount = (s.markdown || "")
                        .split(/\n/)
                        .filter((l) => /^[\-*]|\d+\./.test(l.trim()))
                        .length;
                      // Quizzes get a friendlier index: "Cover" for the
                      // meta card, "Q1 / Q2 / ..." for questions with the
                      // question text shown on two lines (line-clamp-2)
                      // so "What is the prim..." reads as the full prompt
                      // before its truncation kicks in.
                      const isQuiz = s.kind === "quiz_meta" || s.kind === "quiz_question";
                      const questionNumber = sections
                        .slice(0, i + 1)
                        .filter((x) => x.kind === "quiz_question").length;
                      // Presentations come back as "## Slide N — Title"
                      // blocks. Strip the "Slide N — " prefix so the
                      // sidebar shows the slide TITLE prominently and
                      // puts the number in the badge, mirroring how
                      // quizzes show "Q1, Q2…".
                      const slideMatch = kind === "presentation"
                        ? (s.title || "").match(/^Slide\s+(\d+)\s*[—:\-]?\s*(.*)$/i)
                        : null;
                      const isSlide = Boolean(slideMatch);
                      const slideNumber = slideMatch ? slideMatch[1] : null;
                      const slideTitle = slideMatch ? slideMatch[2].trim() : null;
                      const badge =
                        isQuiz
                          ? (s.kind === "quiz_meta" ? "★" : `${questionNumber}`)
                          : isSlide
                            ? slideNumber
                            : letter;
                      const primaryLabel =
                        isQuiz
                          ? (s.kind === "quiz_meta"
                              ? "Cover"
                              : (s.question?.prompt || s.title || `Question ${questionNumber}`))
                          : isSlide
                            ? (slideTitle || `Slide ${slideNumber}`)
                            : (s.title || `Part ${letter}`);
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSectionIndex(i)}
                          title={
                            quizScopeBusy
                              ? "Murchid is rewriting — please wait."
                              : (s.question?.prompt || s.title)
                          }
                          disabled={quizScopeBusy}
                          className={`group flex-shrink-0 md:flex-shrink md:w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-all duration-200 ${
                            isActive
                              ? "border-ink bg-paper-cool shadow-sm"
                              : "border-transparent hover:border-line hover:bg-paper-cool/60"
                          } ${quizScopeBusy && !isActive ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span
                            className={`flex-shrink-0 mt-0.5 h-7 w-7 rounded-md font-mono text-[11px] uppercase tracking-wider flex items-center justify-center transition-colors duration-200 ${
                              isActive
                                ? "bg-accent text-paper-cool"
                                : "bg-ink text-paper-cool group-hover:bg-ink-soft"
                            }`}
                          >
                            {badge}
                          </span>
                          <span className="flex-1 min-w-0">
                            {isQuiz && s.kind === "quiz_question" && (
                              <span className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-0.5">
                                Question {questionNumber}
                              </span>
                            )}
                            {isSlide && (
                              <span className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-0.5">
                                Slide {slideNumber}
                              </span>
                            )}
                            <span className={`block text-[12.5px] font-medium text-ink leading-snug ${
                              isSlide ? "line-clamp-2" : "truncate"
                            }`}>
                              {isQuiz && s.kind === "quiz_question"
                                ? previewWords(primaryLabel, 4)
                                : primaryLabel}
                            </span>
                          </span>
                          {s.regenerating || s.streaming ? (
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" aria-label="Drafting" />
                          ) : s.kind === "quiz_question" && s.question?.marks ? (
                            <span className="hidden md:inline-block mt-1 text-[10px] text-muted font-mono px-1.5 py-0.5 rounded-md bg-paper border border-line">
                              {s.question.marks}m
                            </span>
                          ) : itemCount > 0 ? (
                            <span className="hidden md:inline-block mt-1 text-[10px] text-muted font-mono">
                              {itemCount}q
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    {/* "Drafting…" row — appended to the sidebar while
                        the AI is still emitting more sections. Mirrors
                        the placeholder lessson-plan/markdown path shows
                        when sections.length === 0, but pinned to the
                        bottom of the existing list so the teacher sees
                        where the next item will land. */}
                    {busy && (!sections[sections.length - 1]?.streaming) && (
                      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg opacity-60">
                        <span className="flex-shrink-0 h-7 w-7 rounded-md bg-line/60 animate-pulse" />
                        <span className="flex-1 min-w-0 text-xs text-muted inline-flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                          Drafting…
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* Right pane */}
            <div className="p-5 md:p-7 min-w-0">
              {/* Print-only block */}
              <div className="hidden print:block">
                <WorksheetHeader
                  kind={result?.kind || kind}
                  title={docTitle}
                  meta={(() => {
                    // Quiz uses the AI's structured quiz object as-is.
                    // Homework / lesson use the chip params bag, with the
                    // `major` chip surfaced as `subject` so the worksheet
                    // header's Major field renders without a special case.
                    const k = result?.kind || kind;
                    if (k === "quiz") return result?.quiz;
                    const fromParams = (p) => p ? { ...p, subject: p.major } : null;
                    if (k === "homework") return fromParams(homeworkParams);
                    if (k === "lesson_plan") return fromParams(lessonParams);
                    return null;
                  })()}
                />
                {result?.kind === "quiz" && result.quiz ? (
                  // Quizzes don't keep markdown on their section rows
                  // (each section carries a structured `question` instead),
                  // so joinSections gives an empty string and renderMarkdown
                  // prints nothing. Render the quiz directly from result.quiz.
                  <QuizPrintBody quiz={result.quiz} />
                ) : sections.length > 0 ? (
                  renderMarkdown(
                    // Homework and lesson_plan get a worksheet header above
                    // (with the title centered + underlined), so drop any
                    // leading H1 from the markdown body to avoid printing
                    // the title twice. Other kinds keep their full markdown.
                    (result?.kind === "homework" || result?.kind === "lesson_plan")
                      ? stripLeadingTitle(joinSections(sections))
                      : joinSections(sections)
                  )
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">{streamingText}</pre>
                )}
              </div>

              <div className="print:hidden">
                {/* While generating, every kind — quiz included — streams
                    its markdown token-by-token under a blinking caret, so
                    the teacher watches real headings and questions appear
                    word by word. Once it settles (sections built from the
                    result) we flip to the sectioned editable view. */}
                {sections.length === 0 ? (
                  <div>
                    <p className="font-serif italic text-base text-accent mb-3 inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      {busy ? t("studio.generating") : t("studio.done")}
                    </p>
                    <div className="max-h-[60vh] overflow-y-auto pr-1 studio-stream">
                      {streamingText ? (
                        <>
                          {renderMarkdown(streamingText)}
                          {busy && (
                            <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse align-text-bottom" />
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10">
                          <BrandLoader fullscreen={false} label={t("studio.thinking")} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Eyebrow row now hosts the prev/next chevrons too —
                        they used to sit below the card and forced the
                        whole right pane to be taller than the viewport.
                        Pinning them to the top means the card sits
                        flush above the refine bar with no whitespace
                        regardless of how short or tall a section is. */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="font-serif italic text-base text-accent inline-flex items-baseline gap-2">
                        <span>Part {currentLetter} · {kindLabel(active?.value)}</span>
                        {sections.length > 1 && (
                          <span className="text-muted">
                            · <span key={sectionIndex} className="studio-tick">{sectionIndex + 1}</span> of {sections.length}
                          </span>
                        )}
                        {items > 0 && <span className="text-muted">· {items} item{items === 1 ? "" : "s"}</span>}
                      </p>
                      {sections.length > 1 && (
                        <div className="inline-flex items-center gap-3 flex-shrink-0">
                          {/* Pagination dots — Quantro-style. Tap-target = the
                              parent button which is small but pad-extended via
                              padding on the wrapper. Active dot extends into a
                              pill via the CSS rule keyed on aria-current. */}
                          <div
                            className="studio-pagedots"
                            role="tablist"
                            aria-label="Section pages"
                          >
                            {sections.map((s, i) => (
                              <button
                                key={s.id}
                                type="button"
                                role="tab"
                                aria-label={`Go to ${s.title || `section ${i + 1}`}`}
                                aria-current={i === sectionIndex}
                                disabled={quizScopeBusy}
                                onClick={() => setSectionIndex(i)}
                              />
                            ))}
                          </div>
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSectionIndex((i) => Math.max(0, i - 1))}
                              disabled={sectionIndex <= 0 || quizScopeBusy}
                              aria-label="Previous section"
                              title="Previous section (←)"
                              className="h-7 w-7 rounded border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-150 hover:-translate-y-px"
                            >
                              <span className="font-mono text-[11px] leading-none">←</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSectionIndex((i) => Math.min(sections.length - 1, i + 1))}
                              disabled={sectionIndex >= sections.length - 1 || quizScopeBusy}
                              aria-label="Next section"
                              title="Next section (→)"
                              className="h-7 w-7 rounded border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-150 hover:-translate-y-px"
                            >
                              <span className="font-mono text-[11px] leading-none">→</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Every section kind renders its own title inside the
                        card (StudioCard, QuizMetaCard, QuizQuestionCard),
                        so the big h3 above was always a duplicate that
                        also clipped long titles at the panel edge. Drop
                        it across the board — lesson, homework, activity,
                        presentation, and quiz all rely on the in-card
                        title now. */}

                    {/* Section content — keyed so the in-animation fires
                        on each navigation. Quiz sections render a typed
                        question/meta card; everything else renders the
                        existing markdown StudioCard. */}
                    {/* First-time editing hint — shown only for quizzes
                        and only on the first section. Teaches the inline-
                        edit affordance without an onboarding tour. */}
                    {result?.kind === "quiz" && sectionIndex === 0 && (
                      <div className="mb-4 rounded-xl border-2 border-accent/40 bg-accent/[0.08] px-4 py-3 flex items-start gap-3 shadow-[0_4px_12px_-6px_rgba(200,71,43,0.18)]">
                        <span className="flex-shrink-0 inline-flex h-7 w-7 rounded-lg bg-accent/[0.18] text-accent items-center justify-center font-mono text-xs font-semibold">
                          !
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-[14px] font-medium text-accent leading-tight">
                            Tip · Everything here is editable
                          </p>
                          <p className="text-[12.5px] text-ink-soft leading-snug mt-0.5">
                            Click any field — title, marks, choices, even which letter is correct.
                            Changing the correct answer asks for confirmation before saving.
                          </p>
                        </div>
                      </div>
                    )}

                    <div
                      key={`${sectionIndex}-${currentSection?.id}`}
                      className="studio-card-flip-in relative"
                    >
                      <div className="max-h-[55vh] overflow-y-auto rounded-md">
                        {currentSection?.kind === "quiz_meta" ? (
                          // While streaming and no quiz settled yet, the
                          // meta section shows a live cover preview that
                          // mirrors the AI's title/subject as they land —
                          // no editable inputs (nothing to commit to yet).
                          currentSection.streamingMeta && !result?.quiz ? (
                            <StreamingCoverCard
                              meta={currentSection.streamingMeta}
                              busy={busy}
                              hintPrompt={prompt}
                            />
                          ) : (
                            <QuizMetaCard
                              quiz={result?.quiz}
                              onUpdate={updateQuiz}
                              disabled={quizScopeBusy}
                            />
                          )
                        ) : currentSection?.kind === "quiz_question" ? (
                          // Streaming question: read-only LiveQuestionCard
                          // (prompt + choices + answer fill in live).
                          // Settled question: the editable card.
                          currentSection.streaming ? (
                            <LiveQuestionCard q={currentSection.question} busy={busy} rtl={quizRtl} />
                          ) : (
                            <QuizQuestionCard
                              question={currentSection.question}
                              index={sectionIndex - 1}
                              onUpdate={(patch) => updateQuestion(sectionIndex - 1, patch)}
                              disabled={quizScopeBusy}
                              rtl={quizRtl}
                              marksTotal={quizMarks?.total || 0}
                              marksRemaining={quizMarks?.remaining ?? 0}
                            />
                          )
                        ) : (
                          <StudioCard
                            section={currentSection}
                            onSave={(md) => setSectionMarkdown(currentSection.id, md)}
                            onRegenerate={(hint) => regenerateSection(currentSection.id, hint)}
                            onCancelRegenerate={() => cancelRegenerate(currentSection.id)}
                            onRemove={() => removeSection(currentSection.id)}
                          />
                        )}
                      </div>
                      {quizScopeBusy && (
                        <div
                          className="absolute inset-0 rounded-md bg-paper-cool/55 backdrop-blur-[1.5px] flex items-center justify-center z-10 cursor-wait"
                          aria-live="polite"
                        >
                          <div className="bg-paper-cool/95 border border-line shadow-lg rounded-full px-4 py-2 inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                            <span className="font-serif italic text-sm text-ink">
                              {currentSection?.regenerating
                                ? "Murchid is rewriting this question…"
                                : "Murchid is rewriting the quiz…"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section action chips — markdown path only. Editing
                        a structured quiz happens in the QuizBuilder after
                        save. */}
                    {result?.kind !== "quiz" && (
                      <div className="flex flex-wrap items-center gap-2 mt-5">
                        <ActionChip
                          onClick={makeHarder}
                          disabled={tweakBusy}
                          title="Bump difficulty"
                        >
                          <Wand2 size={13} /> Harder
                        </ActionChip>
                        <ActionChip
                          onClick={() => regenerateSection(currentSection.id, null)}
                          disabled={tweakBusy}
                          title="Regenerate this section"
                        >
                          <RefreshCw size={13} className={tweakBusy ? "animate-spin" : ""} /> Regenerate
                        </ActionChip>
                        {tweakBusy && (
                          <ActionChip
                            onClick={() => cancelRegenerate(currentSection.id)}
                            title="Cancel regeneration"
                          >
                            <X size={13} /> Cancel
                          </ActionChip>
                        )}
                      </div>
                    )}

                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
        </>
        )}

        {result?.usage && (
          <CostFooter usage={result.usage} hadAttachment={attachments.length > 0} />
        )}

        {/* Tweak input bar — sticky at the bottom of the viewport so the
            teacher always sees it once generation starts. For markdown
            artefacts it regenerates the current section. For structured
            quizzes a small "this question / whole quiz" toggle picks the
            scope (auto-defaulted to whole-quiz when the cover is open).
            Hidden for a finished presentation — the SlideBuilder is the
            editor there, no section/refine flow. */}
        {!presentationDeck && (
        <div className="sticky bottom-2 md:bottom-3 z-20 mt-3 print:hidden studio-refine-rise">
          {/* The WHOLE bar (header + input) sits on one frosted panel so
              the result card / cost footer scroll cleanly behind it —
              without the panel the transparent header text collided with
              the content underneath. */}
          <div className="bg-paper-cool/95 backdrop-blur-md border border-line rounded-2xl shadow-[0_12px_40px_-16px_rgba(15,20,16,0.28)] p-3">
          {/* Two-line header above the input doubles as a teaching label so a
              teacher who's never used the bar before knows what it does, and
              an example line under it shows what kind of instructions land.
              Without this, the bar reads as a search box. */}
          <div className="flex items-end justify-between gap-3 px-1 mb-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent inline-flex items-center gap-1.5">
                <Sparkles size={11} strokeWidth={1.75} /> {t("studio.refine")}
                <HelpTip text={t("studio.refine.help")} />
              </p>
              <p className="font-serif italic text-[11.5px] text-muted leading-tight mt-0.5">
                {result?.kind === "quiz"
                  ? t("studio.refinePicked")
                  : t("studio.refineSection")}
              </p>
            </div>
            {quizScopeBusy && (
              <p className="font-serif italic text-[11.5px] text-accent inline-flex items-center gap-1.5 flex-shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Working — please wait
              </p>
            )}
          </div>
          <div
            className={`bg-paper border rounded-xl pl-4 pr-2 py-2 flex items-center gap-3 transition-all duration-200 ${
              tweak.trim() ? "border-ink" : "border-line"
            }`}
          >
            <Sparkles size={15} className={`flex-shrink-0 ${tweak.trim() ? "text-accent" : "text-muted"}`} />
            {result?.kind === "quiz" && sections.length > 0 && (
              <TweakScopeToggle
                value={currentSection?.kind === "quiz_meta" ? "quiz" : tweakScope}
                onChange={setTweakScope}
                metaLocked={currentSection?.kind === "quiz_meta"}
                disabled={tweakBusy}
              />
            )}
            <input
              type="text"
              value={tweak}
              onChange={(e) => setTweak(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTweak(); } }}
              placeholder={
                sections.length === 0
                  ? busy
                    ? "Murchid is drafting — tweak will be ready when sections appear."
                    : "Ask Murchid to tweak…"
                  : result?.kind === "quiz"
                    ? (currentSection?.kind === "quiz_meta" || tweakScope === "quiz")
                      ? "Tweak the whole quiz — e.g. 'switch every question to Arabic' or 'make it harder'"
                      : `Tweak Question ${(currentSection?.question?.position ?? sectionIndex)} — e.g. 'make this a word problem' or 'replace with True/False'`
                    : `Ask Murchid to tweak — e.g. 'make Part ${currentLetter} harder' or 'add 2 word problems'`
              }
              disabled={tweakBusy || sections.length === 0}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-muted disabled:opacity-50"
            />
            <Button
              variant="danger"
              onClick={sendTweak}
              disabled={!tweak.trim() || tweakBusy || sections.length === 0}
              className="text-xs px-3 py-1.5 hover:scale-[1.02] active:scale-[0.99] transition-transform duration-200"
            >
              <Send size={13} className="mr-1.5" />
              {tweakBusy ? "Working…" : "Send"}
            </Button>
          </div>
          </div>
        </div>
        )}

        {error && (
          <div className="mt-4 bg-paper border border-accent rounded-lg p-4 shadow-sm">
            <p className="text-sm font-medium text-accent mb-1">{t("studio.stream.couldNotGenerate")}</p>
            <p className="text-sm text-ink-soft">{error}</p>
            {error.includes("ai_studio") && (
              <p className="text-xs text-muted mt-2">
                Open Dev console (switch role from Account) → Feature flags → flip <span className="text-ink">ai_studio</span> to On.
              </p>
            )}
          </div>
        )}

        {pendingAnswerConfirm && (
          <AnswerChangeConfirm
            changes={pendingAnswerConfirm}
            onCancel={() => setPendingAnswerConfirm(null)}
            onConfirm={saveAsDraft}
          />
        )}

        {pendingLeave && (
          <LeaveStudioConfirm
            busy={busy}
            isDirty={isDirty}
            savedDraftId={savedDraftId}
            onStay={() => setPendingLeave(null)}
            onLeave={() => {
              const { proceed } = pendingLeave;
              setPendingLeave(null);
              // Abort any in-flight generation so the network/SSE doesn't
              // keep running after the studio unmounts.
              abortRef.current?.abort();
              regenAbortsRef.current.forEach((c) => c.abort?.());
              regenAbortsRef.current.clear();
              proceed?.();
            }}
          />
        )}

        {pendingConflicts && (
          <ChipPromptConflictModal
            conflicts={pendingConflicts.conflicts}
            onUseChips={pendingConflicts.proceed}
            onEdit={() => setPendingConflicts(null)}
          />
        )}
      </div>
    );
  }

  // ----- picker view -------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto pb-4 sm:pb-6 px-1 sm:px-0">
      <div className="mb-3 sm:mb-4">
        <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-[1.05] tracking-tight">
          AI <em className="italic font-light text-accent">studio</em>
        </h2>
      </div>

      {/* Murchid prompt block — the kind noun-phrase inside the sentence is
          itself the picker. Teachers read the sentence, see one phrase
          styled like a tappable mini-card with an icon + chevron, and
          click it to swap the kind. No "spin" jargon needed. */}
      <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
        <div className="flex-shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-ink text-paper-cool font-serif italic text-base sm:text-lg flex items-center justify-center shadow-sm">
          M
        </div>
        <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 sm:mb-2">{t("studio.eyebrow")}</p>
          {/* Use a <div> instead of a <p> here because InlineKindPicker
              opens a popover that contains its own <p> and <ul>, and
              <p> cannot legally contain those — React logged
              validateDOMNesting warnings. Same typography classes apply. */}
          <div className="font-serif text-lg sm:text-xl md:text-2xl lg:text-[1.75rem] text-ink leading-[1.4] sm:leading-[1.45]">
            {/* Keep "{verb} a [pill]" as a no-break unit so the kind pill
                never lands on its own line under "Make a". The suffix
                wraps naturally on narrow widths. */}
            <span className="whitespace-nowrap">
              {t(`kind.${active?.value}.verb`)}{" "}
              <InlineKindPicker
                active={active}
                pulseKey={pulseKey}
                open={pickerOpen}
                cursor={cursor}
                onOpen={openPicker}
                onClose={() => setPickerOpen(false)}
                onPick={onPickFromMenu}
                onCursor={setCursor}
              />
            </span>
            {". "}
            {t(`kind.${active?.value}.suffix`)}
          </div>
        </div>
      </div>

      {/* Recent chips — backed by localStorage. Show the four most-recent
          prompts (or quiz titles) for this kind. Clicking restores the
          full prompt into the textarea. */}
      {recents.length > 0 && (
        <div className="mb-3 flex items-center gap-3 flex-wrap">
          <p className="font-serif italic text-base text-muted flex-shrink-0">{t("studio.recent")}</p>
          <div className="flex flex-wrap gap-1.5">
            {recents.slice(0, 4).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPrompt(r)}
                title={r}
                className="px-3 py-1.5 rounded-full bg-paper-cool border border-line text-xs text-ink-soft hover:border-ink hover:bg-paper-warm transition-colors duration-200"
              >
                {recentLabel(r)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiz pre-prompt panel — dedicated block above the input card
          so the teacher can't miss it. Inside the input card it read
          as decoration; here it's clearly a settings step. */}
      {kind === "quiz" && (
        <QuizParamsPanel
          params={quizParams}
          onChange={setQuizParams}
          gradeOptions={gradeOptions}
          majorOptions={majorOptions}
          languageOptions={languageOptions}
          sectionOptions={sectionOptions}
        />
      )}

      {/* Activity pre-prompt panel — same DropdownChip pattern as
          quiz, with activity-specific labels (Type / Major / Language /
          Duration). No grade, no section per chip rules. */}
      {kind === "activity" && (
        <ActivityParamsPanel
          params={activityParams}
          onChange={setActivityParams}
          majorOptions={majorOptions}
          languageOptions={languageOptions}
        />
      )}

      {kind === "lesson_plan" && (
        <LessonParamsPanel
          params={lessonParams}
          onChange={setLessonParams}
          gradeOptions={gradeOptions}
          majorOptions={majorOptions}
          languageOptions={languageOptions}
          sectionOptions={sectionOptions}
        />
      )}

      {kind === "homework" && (
        <HomeworkParamsPanel
          params={homeworkParams}
          onChange={setHomeworkParams}
          gradeOptions={gradeOptions}
          majorOptions={majorOptions}
          languageOptions={languageOptions}
          sectionOptions={sectionOptions}
        />
      )}

      {kind === "presentation" && (
        <PresentationParamsPanel
          params={presentationParams}
          onChange={setPresentationParams}
          gradeOptions={gradeOptions}
          majorOptions={majorOptions}
          languageOptions={languageOptions}
          sectionOptions={sectionOptions}
        />
      )}

      {/* Big input card */}
      <div className="bg-paper-cool rounded-2xl border border-line shadow-sm overflow-hidden focus-within:border-ink transition-colors duration-200">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              generate();
            }
          }}
          placeholder={
            hasAttach
              ? t("studio.textarea.attachedPlaceholder")
              : t(`kind.${active?.value}.sample`)
          }
          className="w-full bg-transparent outline-none px-5 py-3 text-base text-ink placeholder:text-muted resize-none"
        />
        <div className="border-t border-line px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={onPickFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach images or PDFs — Murchid will base the output on them"
              className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                hasAttach
                  ? "border-accent bg-accent/[0.06] text-accent"
                  : "border-line bg-paper-cool hover:border-ink hover:bg-paper-warm text-ink-soft"
              }`}
            >
              <Paperclip size={14} />
            </button>
            {attachments.map((f, i) => (
              <AttachmentChip key={i} file={f} onRemove={() => removeAttachment(i)} />
            ))}
            {!hasAttach && kind !== "quiz" && (
              <ParamChip>{t(`kind.${active?.value}.oneliner`)}</ParamChip>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className={`hidden sm:block text-xs italic ${paramsComplete ? "text-muted" : "text-accent"}`}>
              {!paramsComplete
                ? t("studio.caption.pickAll")
                : hasAttach && !prompt.trim()
                ? t("studio.caption.withFile")
                : t("studio.caption.willFill")}
            </p>
            <Button
              variant="danger"
              onClick={generate}
              disabled={(!prompt.trim() && !hasAttach) || !paramsComplete}
              className="hover:scale-[1.02] active:scale-[0.99] transition-transform duration-200 px-4 py-2 text-sm"
            >
              <Send size={14} className="mr-1.5" />
              {t("studio.makeIt")}
            </Button>
          </div>
        </div>
      </div>

      {attachError && (
        <p className="mt-2 text-[11px] text-accent leading-relaxed">
          {attachError}
        </p>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <p className="font-serif italic text-base text-muted flex-shrink-0">
            {hasAttach ? t("studio.doThisWithIt") : t("studio.orTry")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-cool border border-line text-xs text-ink-soft hover:border-ink hover:bg-paper-warm transition-colors duration-200"
              >
                <Plus size={12} strokeWidth={2.25} className="text-accent" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 bg-paper border border-accent rounded-lg p-4 shadow-sm">
          <p className="text-sm font-medium text-accent mb-1">{t("studio.stream.couldNotGenerate")}</p>
          <p className="text-sm text-ink-soft">{error}</p>
          {error.includes("ai_studio") && (
            <p className="text-xs text-muted mt-2">
              Open Dev console (switch role from Account) → Feature flags → flip <span className="text-ink">ai_studio</span> to On.
            </p>
          )}
        </div>
      )}

      {/* Conflict modal must render in the picker view too. Without this,
          clicking Make it on a fresh kind (no prior result) silently
          no-ops when a chip↔prompt conflict is detected — generate()
          sets pendingConflicts but the modal was only mounted inside
          the result-view return block, so nothing showed up. */}
      {pendingConflicts && (
        <ChipPromptConflictModal
          conflicts={pendingConflicts.conflicts}
          onUseChips={pendingConflicts.proceed}
          onEdit={() => setPendingConflicts(null)}
        />
      )}

    </div>
  );
}

// --- helper components -----------------------------------------------------

// Print-only worksheet header for quizzes and homework. Renders nothing
// on-screen (toggled by the .ws-paper rule in index.css) but appears at
// the top of the printed paper so the teacher's PDF hand-out has the
// student fill-in row a real school paper has: Name / Date / Grade /
// Section / Score. Lesson plans and presentations don't get a header —
// those aren't student-facing.
// Strip a redundant leading label word so "Grade 6" prints as "Grade: 6"
// and "Section A" as "Section: A" ("All sections" / "KG 1" stay whole).
const trimFieldPrefix = (v, word) =>
  String(v ?? "").replace(new RegExp(`^${word}\\s+`, "i"), "").trim();

// Score visibility per kind:
//   - quiz:        always (with / N when total is set)
//   - homework:    only when total_marks is set (it's optional on homework)
//   - lesson_plan: never (lessons aren't student-facing assessments)
const scoreVisibleFor = (kind, totalMarks) =>
  kind === "quiz" || (kind === "homework" && totalMarks != null && totalMarks !== "");

function WorksheetHeader({ kind, title, meta }) {
  if (kind !== "quiz" && kind !== "homework" && kind !== "lesson_plan") return null;
  // Titles follow the OUTPUT's own language (not the app toggle): an Arabic
  // quiz/homework/lesson prints Arabic titles, right-to-left; everything
  // else is English. `meta` is a unified bag — for quiz it's the AI's quiz
  // object, for homework/lesson it's the chip params with `subject` mapped
  // from `major`.
  const lang = meta?.language;
  const rtl = isArabicLang(lang);
  const L = (key) => tIn(lang, key);
  const totalMarks = meta?.total_marks;
  const scheduled = meta?.scheduled_for ? String(meta.scheduled_for).slice(0, 10) : "";
  const showScore = scoreVisibleFor(kind, totalMarks);
  // Date / Grade / Section / Major are pre-filled with what the teacher
  // already set; Name and Score stay blank for the student / grading.
  const field = (label, value, after) => (
    <div className="ws-row">
      <span className="ws-label">{label}:</span>
      {value ? <span className="ws-value">{value}</span> : <span className="ws-blank" />}
      {after}
    </div>
  );
  return (
    <div className="ws-paper" dir={rtl ? "rtl" : "ltr"}>
      <h1 className="ws-title">{title}</h1>
      <hr className="ws-rule" />
      <div className="ws-fields">
        {field(L("ws.name"), "")}
        {field(L("ws.date"), scheduled)}
        {field(L("ws.grade"), trimFieldPrefix(meta?.grade, "Grade"))}
        {field(L("ws.section"), trimFieldPrefix(meta?.section, "Section"))}
        {field(L("ws.major"), meta?.subject)}
        {showScore && field(
          L("ws.score"),
          "",
          totalMarks ? <span style={{ flexShrink: 0, fontWeight: 600 }}>/ {totalMarks}</span> : null
        )}
      </div>
      {meta?.instructions && (
        <p className="ws-instr">{meta.instructions}</p>
      )}
    </div>
  );
}

// Print-only structured render of a quiz, used when the user hits PDF
// from the studio. Quiz sections don't carry markdown (each section
// holds a structured `question` object instead), so the regular
// renderMarkdown path produces an empty page. This walks result.quiz
// directly and prints the same layout the .docx export uses.
function QuizPrintBody({ quiz }) {
  if (!quiz) return null;
  const questions = quiz.questions || [];
  const lang = quiz.language;
  const L = (key) => tIn(lang, key);
  return (
    <ol className="quiz-print-list" dir={isArabicLang(lang) ? "rtl" : "ltr"}>
      {questions.map((qq, i) => {
        const num = qq.position ?? i + 1;
        const isMcq = qq.type === "mcq" && Array.isArray(qq.choices) && qq.choices.length > 0;
        const isTF  = qq.type === "tf" || qq.type === "true_false";
        return (
          <li key={qq.id ?? i} className="quiz-print-item">
            <p className="quiz-print-prompt">
              <strong>{num}. {qq.prompt || ""}</strong>
              {qq.marks ? (
                <em className="quiz-print-marks">
                  &nbsp;&nbsp;({qq.marks} {qq.marks > 1 ? L("export.marks") : L("export.mark")})
                </em>
              ) : null}
            </p>
            {isMcq ? (
              <ul className="quiz-print-choices">
                {qq.choices.map((c, idx) => (
                  <li key={idx}>
                    <span className="quiz-print-bubble">○</span>
                    {typeof c === "string" ? c : (c?.text ?? c?.label ?? "")}
                  </li>
                ))}
              </ul>
            ) : isTF ? (
              <p className="quiz-print-tf">○ {L("export.true")} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ○ {L("export.false")}</p>
            ) : (
              <>
                <p className="quiz-print-blank">&nbsp;</p>
                <p className="quiz-print-blank">&nbsp;</p>
                <p className="quiz-print-blank">&nbsp;</p>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ActionChip({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-paper-cool text-xs text-ink-soft hover:border-ink hover:bg-paper-warm hover:text-ink transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// Tiny cost-summary line shown under the result card after a generation
// completes. Prices below are claude-haiku-4-5 list rates ($1/M input,
// $5/M output) and ignore prompt-caching discounts — so this is the
// upper-bound retail cost per generation. Cache hits make it cheaper.
const HAIKU_INPUT_PER_MTOK_USD = 1.0;
const HAIKU_OUTPUT_PER_MTOK_USD = 5.0;

function CostFooter({ usage, hadAttachment }) {
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cachedIn = usage.cache_read_input_tokens ?? 0;
  const cost =
    (inTok * HAIKU_INPUT_PER_MTOK_USD + outTok * HAIKU_OUTPUT_PER_MTOK_USD) / 1_000_000;
  const fmtUsd = (x) => x < 0.01 ? "<$0.01" : `$${x.toFixed(3)}`;
  const fmtTok = (n) => n.toLocaleString();
  return (
    <div className="mt-3 flex items-center justify-end gap-2.5 text-[11px] text-muted flex-wrap print:hidden">
      <span className="font-mono uppercase tracking-[0.14em] text-muted/80">Cost</span>
      <span className="text-line">·</span>
      <span><span className="text-ink">{fmtTok(inTok)}</span> in</span>
      <span className="text-line">·</span>
      <span><span className="text-ink">{fmtTok(outTok)}</span> out</span>
      {cachedIn > 0 && (
        <>
          <span className="text-line">·</span>
          <span className="text-sage">{fmtTok(cachedIn)} cached</span>
        </>
      )}
      {hadAttachment && (
        <>
          <span className="text-line">·</span>
          <span className="text-accent">w/ attachment</span>
        </>
      )}
      <span className="text-line">·</span>
      <span className="text-ink font-medium">{fmtUsd(cost)}</span>
    </div>
  );
}

// Small chip showing the currently-attached file (image or PDF) next to
// the paperclip. Click × to clear. Sized to one line, truncates the
// filename if it's long. The file goes to the AI as base64; the chip
// is the only visual cue that an attachment is included in the request.
function AttachmentChip({ file, onRemove }) {
  const sizeKb = Math.max(1, Math.round(file.sizeBytes / 1024));
  const sizeLabel = sizeKb >= 1024
    ? `${(sizeKb / 1024).toFixed(1)} MB`
    : `${sizeKb} KB`;
  const isPdf = file.mediaType === "application/pdf";
  return (
    <span className="inline-flex items-center gap-1.5 max-w-[18rem] px-2.5 py-1 rounded-full border border-accent/40 bg-accent/[0.06] text-[11px] text-ink">
      {isPdf
        ? <FileText size={12} className="flex-shrink-0 text-accent" />
        : <Paperclip size={11} className="flex-shrink-0 text-accent" />}
      <span className="truncate font-medium" title={file.name}>{file.name}</span>
      <span className="flex-shrink-0 text-muted">· {sizeLabel}</span>
      <button
        type="button"
        onClick={onRemove}
        title="Remove attachment"
        className="flex-shrink-0 ml-0.5 h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-accent/15 text-accent"
      >
        <X size={11} strokeWidth={2} />
      </button>
    </span>
  );
}

function ParamChip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line bg-paper-cool text-[11px] text-ink-soft">
      {children}
    </span>
  );
}

// The kind word inside the Murchid headline, rendered as a tappable mini-card
// that hosts a keyboard-first popover menu. Affordance is the icon + chevron;
// the popover is anchored directly under the pill.
function InlineKindPicker({
  active, pulseKey,
  open, cursor, onOpen, onClose, onPick, onCursor,
}) {
  const t = useT();
  if (!active) return null;
  const Icon = active.icon;
  // The pill is rendered inline inside a serif <p>, so wrap it in an
  // inline-block span that we can position the popover against.
  return (
    <span className="relative inline-block align-middle">
      <button
        key={pulseKey}
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Tap to choose what Murchid makes — or press K"
        className={`studio-kind-pulse group inline-flex items-center gap-2 px-3.5 py-1 mx-1 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 transition-all duration-200 align-middle -translate-y-[0.12em] whitespace-nowrap text-[0.72em] font-sans font-medium tracking-normal cursor-pointer ${
          open
            ? "bg-ink border-ink text-paper-cool shadow-[0_0_0_4px_rgba(28,26,22,0.06)]"
            : "bg-paper-cool border-line/70 hover:border-ink hover:bg-paper-warm"
        }`}
      >
        <Icon
          size={12}
          strokeWidth={1.5}
          className={`transition-colors duration-200 ${
            open ? "text-paper-cool" : "text-ink-soft group-hover:text-accent"
          }`}
        />
        <span className={`leading-none ${open ? "text-paper-cool" : "text-ink"}`}>
          {kindLabelFor(t, active.value)}
        </span>
        <ChevronDown
          size={11}
          strokeWidth={1.5}
          className={`transition-all duration-200 ${
            open
              ? "text-paper-cool rotate-180"
              : "text-muted group-hover:text-accent"
          }`}
        />
      </button>

      {open && (
        <KindMenu
          activeValue={active.value}
          cursor={cursor}
          onPick={onPick}
          onClose={onClose}
          onCursor={onCursor}
        />
      )}
    </span>
  );
}

// The keyboard-first popover that lists all kinds. Clicking anywhere outside
// closes it (handled by a transparent fixed-inset backdrop). Keyboard
// navigation is centralised in the parent's window keydown effect — this
// component just renders the visual state driven by `cursor` + `activeValue`.
function KindMenu({ activeValue, cursor, onPick, onClose, onCursor }) {
  const t = useT();
  return (
    <>
      {/* Click-outside scrim. Transparent — no dim, no blur. The popover
          itself stops propagation so its own clicks don't close it. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-transparent cursor-default"
      />
      <div
        role="listbox"
        aria-label="What Murchid makes"
        onClick={(e) => e.stopPropagation()}
        className="studio-menu-rise absolute start-0 top-full mt-2 z-50 w-[22rem] sm:w-[28rem] max-w-[calc(100vw-2rem)] origin-top-left rtl:origin-top-right rounded-2xl border border-line bg-paper-cool shadow-xl ring-1 ring-ink/5 overflow-hidden"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted px-4 pt-3.5 pb-2">
          {t("studio.menu.switchTo")}
        </p>
        <ul className="grid grid-cols-2 gap-1 px-2 pb-2">
          {KINDS.map((k, i) => {
            const Icon = k.icon;
            const isActive = k.value === activeValue;
            const isCursor = i === cursor;
            return (
              <li key={k.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => onCursor(i)}
                  onClick={() => onPick(k.value)}
                  className={`group w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-start transition-colors duration-100 ${
                    isActive
                      ? "bg-paper-warm"
                      : isCursor
                      ? "bg-paper-warm/60"
                      : "bg-transparent hover:bg-paper-warm/40"
                  }`}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={`flex-shrink-0 mt-0.5 transition-colors duration-100 ${
                      isActive ? "text-accent" : "text-ink-soft"
                    }`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`font-sans text-sm font-medium leading-none truncate ${
                          isActive ? "text-accent" : "text-ink"
                        }`}
                      >
                        {kindLabelFor(t, k.value)}
                      </span>
                    </span>
                    <span className="block mt-1 text-[11px] text-muted leading-snug truncate">
                      {(() => {
                        const tr = t(`kind.${k.value}.blurb`);
                        return tr === `kind.${k.value}.blurb` ? (k.menuBlurb || k.oneliner) : tr;
                      })()}
                    </span>
                  </span>
                  {isActive && (
                    <Check size={13} className="flex-shrink-0 mt-0.5 text-accent" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-4 py-2.5 flex items-center justify-center gap-3 bg-paper">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] text-ink-soft leading-none">↑↓</kbd>
            <span className="font-serif italic text-base text-ink-soft">{t("studio.menu.browse")}</span>
          </span>
          <span className="text-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] text-ink-soft leading-none">↵</kbd>
            <span className="font-serif italic text-base text-ink-soft">{t("studio.menu.pick")}</span>
          </span>
          <span className="text-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] text-ink-soft leading-none">Esc</kbd>
            <span className="font-serif italic text-base text-ink-soft">{t("studio.menu.close")}</span>
          </span>
        </div>
      </div>
    </>
  );
}

// --- Quiz components -------------------------------------------------------
//
// Structured-quiz path. The studio's regular markdown view doesn't apply
// here because each question has typed fields. These three components
// render the quiz progress (while streaming), the meta/header card, and
// each individual question.

const QUIZ_TYPE_LABELS = {
  mcq: "Multiple choice",
  tf: "True / False",
  short: "Short answer",
  essay: "Essay",
};

// Read-only cover card — kept for the structured quiz result view.
function StreamingCoverCard({ meta, busy, hintPrompt }) {
  const t = useT();
  const title = meta?.title || (hintPrompt ? truncate(hintPrompt, 80) : null);
  const subject = meta?.subject;
  const questions = meta?.questions || [];
  const totalQ = questions.length;
  const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 0), 0);

  return (
    <div className="rounded-2xl border border-line bg-paper-cool p-5 md:p-6 studio-card-stagger">
      <p className="font-serif italic text-base text-muted mb-2">Cover</p>
      {title ? (
        <h3 className="font-serif text-2xl md:text-3xl font-medium text-ink leading-tight mb-2">
          {title}
          {!meta?.title && busy && (
            <span className="inline-block w-1.5 h-6 bg-accent ml-1 animate-pulse align-text-bottom" />
          )}
        </h3>
      ) : (
        <h3 className="font-serif text-2xl md:text-3xl font-medium text-muted/80 italic leading-tight mb-2">
          {t("studio.stream.structuring")}
          <span className="inline-block w-1.5 h-6 bg-accent ml-1 animate-pulse align-text-bottom" />
        </h3>
      )}

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-ink-soft mb-1">
        {subject ? (
          <span className="inline-flex items-baseline gap-1.5">
            <span className="font-serif italic text-sm text-muted">Subject</span>
            <span className="text-sm text-ink font-medium">{subject}</span>
          </span>
        ) : busy ? (
          <span className="font-serif italic text-sm text-muted/70 inline-flex items-baseline gap-1">
            {t("studio.stream.pickingMeta")}
            <span className="inline-block w-1.5 h-3 bg-accent ml-1 animate-pulse align-text-bottom" />
          </span>
        ) : null}
        {totalQ > 0 && (
          <span className="font-serif italic text-muted">
            · {totalQ} question{totalQ === 1 ? "" : "s"}
            {totalMarks > 0 && (
              <>
                {" · "}
                <span className="text-ink not-italic font-medium">{totalMarks} marks</span>
              </>
            )}
          </span>
        )}
      </div>

      <p className="font-serif italic text-sm text-muted mt-4">
        {t("studio.stream.draftingRest")}
      </p>
    </div>
  );
}

function LiveQuestionCard({ q, busy, rtl = false }) {
  const t = useT();
  const inflight = !q.complete && busy;
  const typeLabel = QUIZ_TYPE_LABELS[q.type] || (q.type ? q.type : null);
  const correctLetter =
    typeof q.correct_answer === "string" && q.correct_answer.length === 1
      ? q.correct_answer.toUpperCase()
      : null;
  return (
    <div
      dir={rtl ? "rtl" : undefined}
      className={`rounded-xl border bg-paper-cool px-4 py-3 transition-colors duration-200 ${
        inflight ? "border-accent/60 shadow-[0_0_0_3px_rgba(200,71,43,0.08)]" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-2">
          <span className={`flex-shrink-0 h-5 w-5 rounded-md font-mono text-[10px] flex items-center justify-center ${
            inflight ? "bg-accent text-paper-cool animate-pulse" : "bg-ink text-paper-cool"
          }`}>
            {q.position}
          </span>
          {typeLabel && (
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-mono">
              {typeLabel}
            </span>
          )}
        </span>
        {q.marks != null && (
          <span className="font-mono text-[10px] text-muted">
            {q.marks} mark{q.marks === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {q.prompt !== null ? (
        <p className="font-serif text-[15px] text-ink leading-snug mb-2">
          {q.prompt}
          {q.promptInflight && (
            <span className="inline-block w-1.5 h-4 bg-accent ml-1 animate-pulse align-text-bottom" />
          )}
        </p>
      ) : (
        <p className="font-serif italic text-[13px] text-muted mb-2">
          {t("studio.stream.writingPrompt")}
          <span className="inline-block w-1.5 h-3 bg-accent ml-1 animate-pulse align-text-bottom" />
        </p>
      )}

      {/* Choices — MCQ shows A-D rows, TF shows True/False pills, short
          and essay show their expected-answer text directly below. */}
      {q.type === "mcq" && Array.isArray(q.choices) && q.choices.length > 0 && (
        <ol className="space-y-1 mb-1">
          {q.choices.map((c, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = correctLetter === letter;
            return (
              <li
                key={i}
                className={`flex items-start gap-2 px-2 py-1 rounded-md text-[12.5px] ${
                  isCorrect ? "bg-accent/[0.08] text-accent" : "text-ink-soft"
                }`}
              >
                <span className={`flex-shrink-0 h-4 w-4 rounded font-mono text-[9px] flex items-center justify-center ${
                  isCorrect ? "bg-accent text-paper-cool" : "bg-paper-warm text-muted"
                }`}>
                  {letter}
                </span>
                <span className="leading-snug flex-1 min-w-0">{c}</span>
              </li>
            );
          })}
        </ol>
      )}

      {q.type === "tf" && (
        <div className="flex gap-1.5 mb-1">
          {[true, false].map((v) => {
            const label = v ? "True" : "False";
            const isCorrect = q.correct_answer === v
              || (typeof q.correct_answer === "string"
                  && q.correct_answer.toLowerCase() === label.toLowerCase());
            return (
              <span
                key={label}
                className={`px-2 py-0.5 rounded-md text-[11px] border ${
                  isCorrect
                    ? "bg-accent/[0.08] border-accent/40 text-accent"
                    : "bg-paper-warm border-line text-ink-soft"
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {(q.type === "short" || q.type === "essay") && q.correct_answer && (
        <p className="text-[12.5px] text-ink-soft leading-snug mt-1 pl-1 border-l-2 border-accent/40">
          <span className="font-serif italic text-muted mr-1.5">
            {q.type === "essay" ? "Rubric:" : "Answer:"}
          </span>
          {typeof q.correct_answer === "string" ? q.correct_answer : ""}
        </p>
      )}
    </div>
  );
}

// Trim a string to N chars, breaking on a word boundary if possible.
function truncate(s, n) {
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n);
  const space = cut.lastIndexOf(" ");
  return (space > n * 0.6 ? cut.slice(0, space) : cut) + "…";
}

// Keep only the first N words (+ "…") — for the sidebar question previews,
// which only need a glance label since the full prompt shows on the right.
function previewWords(s, n = 4) {
  const words = String(s || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.join(" ");
  return words.slice(0, n).join(" ") + "…";
}

// Heuristics to spot the most common chip mix-ups. Each function takes
// the chip's current value, the whole `params`, and the option list it's
// drawing from. Returns:
//   null  → value looks fine
//   { reason, suggestSlot } → value belongs to suggestSlot, not this one
//
// We use small, conservative rules — false positives are worse than
// false negatives here, because the AI also auto-corrects on the backend.
const looksLikeGrade = (v) =>
  /grade\s*\d/i.test(v) ||
  /^kg\b/i.test(v) ||
  /^year\s*\d/i.test(v) ||
  /^form\s*\d/i.test(v);

const looksLikeDifficulty = (v) =>
  /^(easy|medium|hard|beginner|intermediate|advanced|mixed)$/i.test(v.trim());

const looksLikeMajor = (v) =>
  MAJORS.some((m) => m.toLowerCase() === v.trim().toLowerCase());

const looksLikeInteger = (v) => /^\d+$/.test(String(v).trim());

// Per-kind required selections. The teacher must set every one of these
// before Studio will generate — no nulls, no "Murchid guesses the basics".
// The ONLY field allowed to stay empty is the schedule-for date (the
// teacher may decide when to run it later). The instruction line isn't
// listed because it always carries a mode ("none" by default), never null.
const REQUIRED_CHIPS = {
  quiz:         ["grade", "major", "language", "section", "difficulty", "questions", "duration", "types", "total_marks"],
  lesson_plan:  ["grade", "major", "language", "section", "duration"],
  homework:     ["grade", "major", "language", "section"],
  activity:     ["type", "major", "language", "duration"],
  presentation: ["grade", "major", "language", "section", "slides"],
};
const chipIsSet = (v) => v !== "" && v != null;
const chipsComplete = (kind, params) => {
  const req = REQUIRED_CHIPS[kind];
  if (!req || !params) return true;
  return req.every((k) => chipIsSet(params[k]));
};

const CHIP_VALIDATORS = {
  grade: (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (looksLikeGrade(s)) return null;
    if (looksLikeMajor(s)) return { reason: "That looks like a Major", suggestSlot: "major" };
    if (looksLikeDifficulty(s)) return { reason: "That looks like a Difficulty", suggestSlot: "difficulty" };
    if (looksLikeInteger(s)) return null; // could be a custom value
    return null;
  },
  major: (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (looksLikeGrade(s)) return { reason: "That looks like a Grade", suggestSlot: "grade" };
    if (looksLikeDifficulty(s)) return { reason: "That looks like a Difficulty", suggestSlot: "difficulty" };
    return null;
  },
  difficulty: (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (looksLikeDifficulty(s)) return null;
    if (looksLikeMajor(s)) return { reason: "That looks like a Major", suggestSlot: "major" };
    if (looksLikeGrade(s)) return { reason: "That looks like a Grade", suggestSlot: "grade" };
    return null;
  },
  questions: (v) => {
    if (v === "" || v == null) return null;
    if (!looksLikeInteger(v)) {
      const s = String(v).trim();
      if (looksLikeMajor(s)) return { reason: "Looks like a Major", suggestSlot: "major" };
      return { reason: "Should be a number", suggestSlot: null };
    }
    return null;
  },
  duration: (v) => {
    if (v === "" || v == null) return null;
    if (!looksLikeInteger(v)) {
      const s = String(v).trim();
      if (looksLikeMajor(s)) return { reason: "Looks like a Major", suggestSlot: "major" };
      return { reason: "Should be a number", suggestSlot: null };
    }
    return null;
  },
};

// Progress badge shown in each settings panel's header. Always visible:
// counts how many of the required chips are set, and flips to a green
// "All set" with a check once the teacher has chosen everything.
function SetCountBadge({ count, total }) {
  const t = useT();
  const done = count >= total;
  return (
    <p className={`font-mono text-[10px] uppercase tracking-[0.14em] flex-shrink-0 inline-flex items-center gap-1 ${done ? "text-sage" : "text-accent"}`}>
      {done && <Check size={11} strokeWidth={2.5} />}
      {done ? t("studio.params.allSet") : t("studio.params.setCountN", { n: count, total })}
    </p>
  );
}

// Pre-prompt panel that sits ABOVE the input card. Big, clearly chunked
// settings block with a header so it doesn't read as decoration. Each
// field is a dropdown chip with an icon, an uppercase label, and a value
// area; the chip is sized big enough that an empty state ("Pick a grade")
// is impossible to miss. Every chip is required — the teacher chooses
// everything before Murchid will build.
function QuizParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  // Count straight off REQUIRED_CHIPS.quiz (8 chips + Score) so the badge
  // and the "Make it" gate never disagree about what "all set" means.
  const setCount = REQUIRED_CHIPS.quiz.filter((k) => chipIsSet(params[k])).length;

  // Move this chip's current value into `targetSlot` and clear ours.
  // If `targetSlot` already has a value, swap them so nothing is lost.
  const moveTo = (fromSlot, targetSlot) => {
    if (!targetSlot) return;
    onChange((prev) => ({
      ...prev,
      [targetSlot]: prev[fromSlot],
      [fromSlot]: prev[targetSlot] ?? "",
    }));
  };

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">
            {t("studio.params.quiz")}
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={REQUIRED_CHIPS.quiz.length} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
          warning={CHIP_VALIDATORS.grade(params.grade)}
          onMoveTo={(target) => moveTo("grade", target)}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
          warning={CHIP_VALIDATORS.major(params.major)}
          onMoveTo={(target) => moveTo("major", target)}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Gauge}
          label={t("studio.chip.difficulty.label")}
          slot="difficulty"
          emptyHint={t("studio.chip.difficulty.empty")}
          help={t("studio.chip.difficulty.help")}
          value={params.difficulty}
          options={QUIZ_DIFFICULTIES}
          onChange={(v) => set({ difficulty: v })}
          warning={CHIP_VALIDATORS.difficulty(params.difficulty)}
          onMoveTo={(target) => moveTo("difficulty", target)}
        />
        <DropdownChip
          icon={Hash}
          label={t("studio.chip.questions.label")}
          slot="questions"
          emptyHint={t("studio.chip.questions.empty")}
          help={t("studio.chip.questions.help")}
          value={
            params.questions === "" || params.questions == null
              ? ""
              : String(params.questions)
          }
          options={QUIZ_QUESTION_COUNTS.map(String)}
          onChange={(v) => set({ questions: v === "" ? "" : Number(v) })}
          warning={CHIP_VALIDATORS.questions(params.questions)}
          onMoveTo={(target) => moveTo("questions", target)}
          numeric
        />
        <DropdownChip
          icon={Clock}
          label={t("studio.chip.duration.label")}
          slot="duration"
          emptyHint={t("studio.chip.duration.empty")}
          help={t("studio.chip.duration.help")}
          value={
            params.duration === "" || params.duration == null
              ? ""
              : String(params.duration)
          }
          options={QUIZ_DURATIONS.map(String)}
          onChange={(v) => set({ duration: v === "" ? "" : Number(v) })}
          warning={CHIP_VALIDATORS.duration(params.duration)}
          onMoveTo={(target) => moveTo("duration", target)}
          suffix="min"
          numeric
        />
        <DropdownChip
          icon={ListChecks}
          label={t("studio.chip.types.label")}
          slot="types"
          emptyHint={t("studio.chip.types.empty")}
          help={t("studio.chip.types.help")}
          value={params.types}
          options={QUIZ_QUESTION_MIXES}
          onChange={(v) => set({ types: v })}
        />
      </div>

      {/* Scheduled date — separate from the chips because it's a date
          picker, not a list. Persists straight onto the saved quiz row
          so the Schedule view and Quizzes & Exams list pick it up. */}
      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
        score={params.total_marks}
        onScoreChange={(v) => set({ total_marks: v })}
      />
      <InstructionsRow
        mode={params.instructions_mode}
        text={params.instructions}
        onModeChange={(v) => set({ instructions_mode: v })}
        onTextChange={(v) => set({ instructions: v })}
      />
    </div>
  );
}

// Activity settings panel — same shape as QuizParamsPanel (eyebrow,
// chip grid, schedule-for date row) but with activity-specific labels.
// Per the chip rules, no Grade and no Section. Type sits in the slot
// Grade would normally occupy so the grid stays balanced.
function ActivityParamsPanel({ params, onChange, majorOptions, languageOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.type, params.major, params.language, params.duration,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">
            {t("studio.params.activity")}
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={4} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DropdownChip
          icon={Users}
          label={t("studio.chip.type.label")}
          slot="type"
          emptyHint={t("studio.chip.type.empty")}
          help={t("studio.chip.type.help")}
          value={params.type}
          options={ACTIVITY_TYPES}
          onChange={(v) => set({ type: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Clock}
          label={t("studio.chip.duration.label")}
          slot="duration"
          emptyHint={t("studio.chip.duration.empty")}
          help={t("studio.chip.duration.help")}
          value={
            params.duration === "" || params.duration == null
              ? ""
              : String(params.duration)
          }
          options={ACTIVITY_DURATIONS.map(String)}
          onChange={(v) => set({ duration: v === "" ? "" : Number(v) })}
          suffix="min"
          numeric
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// Lesson plan settings — Grade + Major + Language + Section + Duration.
// Schedule-for date row anchors the lesson on the calendar.
function LessonParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section, params.duration,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">{t("studio.params.lesson")}</p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={5} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Clock}
          label={t("studio.chip.duration.label")}
          slot="duration"
          emptyHint={t("studio.chip.duration.empty")}
          help={t("studio.chip.duration.help")}
          value={
            params.duration === "" || params.duration == null
              ? ""
              : String(params.duration)
          }
          options={LESSON_DURATIONS.map(String)}
          onChange={(v) => set({ duration: v === "" ? "" : Number(v) })}
          suffix="min"
          numeric
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// Homework settings — Grade + Major + Language + Section. The
// schedule-for date doubles as the due date for the assignment.
function HomeworkParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">{t("studio.params.homework")}</p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={4} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
        score={params.total_marks}
        onScoreChange={(v) => set({ total_marks: v })}
        scoreOptional
      />
    </div>
  );
}

// Presentation settings — Grade + Major + Language + Section + Slides.
// Schedule-for anchors the deck on the calendar.
function PresentationParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section, params.slides,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">{t("studio.params.presentation")}</p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={5} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Hash}
          label={t("studio.chip.slides.label")}
          slot="slides"
          emptyHint={t("studio.chip.slides.empty")}
          help={t("studio.chip.slides.help")}
          value={
            params.slides === "" || params.slides == null
              ? ""
              : String(params.slides)
          }
          options={PRESENTATION_SLIDES.map(String)}
          onChange={(v) => set({ slides: v === "" ? "" : Number(v) })}
          numeric
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// `scoreOptional` — when true (homework), an empty score input renders with a
// muted dashed border instead of the accent-red dashed border that signals
// "this field is required and unset" on the quiz panel.
function ScheduledDateRow({ value, onChange, score, onScoreChange, scoreOptional = false }) {
  const t = useT();
  const todayISO = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <Calendar size={11} strokeWidth={1.75} />
          {t("studio.schedule.label")}
          <HelpTip text={t("studio.schedule.help")} />
        </span>
        <DatePicker
          value={value ? String(value).slice(0, 10) : ""}
          min={todayISO}
          onChange={(v) => onChange(v || "")}
          className="bg-paper-cool border border-line rounded-md px-2.5 py-1 text-sm text-ink outline-none focus:border-ink transition-colors duration-150 min-w-[160px]"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="font-serif italic text-xs text-muted hover:text-accent transition-colors duration-150"
          >
            {t("studio.schedule.clear")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(todayISO)}
            className="font-serif italic text-xs text-muted hover:text-accent transition-colors duration-150"
          >
            {t("studio.schedule.today")}
          </button>
        )}
      </span>

      {onScoreChange && (
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <Award size={11} strokeWidth={1.75} />
            {t("studio.schedule.score")}
            <HelpTip text={t("studio.score.help")} />
          </span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={score ?? ""}
            onChange={(e) => onScoreChange(e.target.value)}
            placeholder={t("studio.schedule.scorePlaceholder")}
            className={`w-20 bg-paper-cool border rounded-md px-2.5 py-1 text-sm text-ink outline-none focus:border-ink transition-colors duration-150 normal-case tracking-normal font-sans ${
              chipIsSet(score)
                ? "border-line"
                : scoreOptional
                ? "border-dashed border-line"
                : "border-dashed border-accent/60"
            }`}
          />
        </span>
      )}
    </div>
  );
}

// The instruction line printed at the top of the quiz hand-out ("Read each
// question carefully…"). Three modes: Auto (Murchid writes it), Custom (the
// teacher's own text, revealed in a textarea), or None (omit it). Defaults
// to None — the teacher opts into Auto or Custom.
function InstructionsRow({ mode, text, onModeChange, onTextChange }) {
  const t = useT();
  const m = mode || "none";
  const OPTIONS = [
    ["auto", t("studio.instructions.auto")],
    ["custom", t("studio.instructions.custom")],
    ["none", t("studio.instructions.none")],
  ];
  return (
    <div className="mt-2 px-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <ClipboardList size={11} strokeWidth={1.75} />
          {t("studio.instructions.label")}
          <HelpTip text={t("studio.instructions.help")} />
        </span>
        <div className="inline-flex rounded-md border border-line overflow-hidden">
          {OPTIONS.map(([v, label], i) => (
            <button
              key={v}
              type="button"
              onClick={() => onModeChange(v)}
              className={`px-3 py-1 text-xs font-sans transition-colors duration-150 ${i > 0 ? "border-s border-line" : ""} ${
                m === v ? "bg-ink text-paper-cool" : "bg-paper-cool text-muted hover:text-ink hover:bg-paper-warm"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {m === "custom" && (
        <textarea
          rows={2}
          value={text ?? ""}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t("studio.instructions.placeholder")}
          className="mt-2 w-full bg-paper-cool border border-line rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink transition-colors duration-150 resize-y"
        />
      )}
    </div>
  );
}

// A combobox-style field-card. Looks like a form control closed; opens
// into a text input + filtered dropdown. Teachers can pick from the
// preset list OR type any custom value — typed text becomes the value
// even if it doesn't match anything in `options`.
//
//   ┌───────────────────────┐
//   │ ⊕ GRADE             ▾ │   header (icon + mono label + chevron)
//   │ Grade 8 / [type…  ]   │   value or input depending on open
//   └───────────────────────┘
//
// Closed empty: dashed border + italic "Any grade" hint.
// Closed filled: solid border + ink text.
// Open: focus ring, input replaces the value display, menu drops below.
// numeric: input forwards inputMode="numeric"; non-numeric typed values
//          are coerced or ignored on commit.
// Split a multi-select chip's value (joined comma-separated string) into
// its component selections. Empty / null safe.
const splitMulti = (s) =>
  String(s || "").split(",").map((t) => t.trim()).filter(Boolean);
const joinMulti = (arr) => arr.filter(Boolean).join(", ");

// Render an ISO date (YYYY-MM-DD or a full timestamp) as a short, human
// label for the cover. Locale-aware; falls back to the raw value if parse
// fails so we never show an empty cell for a malformed date.
const formatScheduledDate = (iso) => {
  if (!iso) return null;
  const ymd = String(iso).slice(0, 10);
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function DropdownChip({
  icon: Icon, label, emptyHint, help, value, options, onChange,
  suffix, numeric, warning, onMoveTo,
  // multi=true → chip stores a comma-separated string of picks.
  // Clicking an option TOGGLES it (menu stays open). Custom typed
  // values get appended. Click-outside / Done closes.
  multi = false,
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const inputRef = useRef(null);

  // Re-seed draft from external value when the chip is closed (resets, etc.)
  useEffect(() => {
    if (!open) setDraft(value == null ? "" : String(value));
  }, [value, open]);

  // Focus + select the input as soon as it appears so typing just works.
  // For multi mode we start the draft empty so typing filters/adds new
  // values rather than re-editing the already-picked joined string.
  useEffect(() => {
    if (!open) return;
    if (multi) setDraft("");
    const id = setTimeout(() => {
      inputRef.current?.focus();
      if (!multi) inputRef.current?.select();
    }, 0);
    return () => clearTimeout(id);
  }, [open, multi]);

  const openMenu = () => {
    setDraft(value == null ? "" : String(value));
    setOpen(true);
  };

  // Commit a value: trims, coerces to number for numeric chips, then
  // closes the menu. Invalid numeric input becomes empty (Any).
  const commit = (raw) => {
    let v = raw === "" || raw == null ? "" : String(raw).trim();
    if (numeric && v !== "") {
      const n = Number(v);
      v = Number.isFinite(n) && n > 0 ? String(n) : "";
    }
    onChange(numeric ? (v === "" ? "" : Number(v)) : v);
    setOpen(false);
  };

  // Multi-select handlers: toggle an option in the joined list without
  // closing the menu, and add a typed custom value to the list.
  const currentMulti = multi ? splitMulti(value) : [];
  const toggleMulti = (opt) => {
    const next = currentMulti.includes(opt)
      ? currentMulti.filter((x) => x !== opt)
      : [...currentMulti, opt];
    onChange(joinMulti(next));
    setDraft(""); // ready to filter / add the next
  };
  const addCustomMulti = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return;
    if (currentMulti.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange(joinMulti([...currentMulti, v]));
    setDraft("");
  };

  const filteredOptions = useMemo(() => {
    // Numeric chips (DURATION, QUESTIONS) have a small, finite preset
    // list — typing a custom value should add to it, not filter it away.
    // The teacher needs to see every preset so they can re-pick a
    // different one without re-opening the chip.
    if (numeric) return options;
    if (!draft) return options;
    // When the draft is just reflecting the currently-picked value
    // (chip was just reopened, user hasn't typed yet), show every
    // option — otherwise re-opening "Biology" would hide Science,
    // Computer Science, etc., and the teacher couldn't switch.
    const currentValueStr = String(value == null ? "" : value);
    if (String(draft) === currentValueStr) return options;
    const q = String(draft).toLowerCase();
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [draft, options, numeric, value]);

  const isSet = Boolean(value) || value === 0;
  const display = isSet
    ? suffix ? `${value} ${suffix}` : value
    : emptyHint || t("studio.combo.pickOrType");

  const hasWarning = Boolean(warning && !open);
  const cardClass = `w-full text-left rounded-lg border px-3 py-2 transition-all duration-150 ${
    open
      ? "bg-paper-cool border-ink shadow-[0_0_0_3px_rgba(200,71,43,0.12)]"
      : hasWarning
        ? "bg-paper-cool border-accent/70"
        : isSet
          ? "bg-paper-cool border-line hover:border-ink"
          : "bg-paper border-dashed border-line/80 hover:border-ink hover:bg-paper-cool"
  }`;

  const header = (
    <div className="flex items-center justify-between gap-2 mb-0.5">
      <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
        isSet || open ? "text-ink-soft" : "text-muted"
      }`}>
        {Icon && <Icon size={11} strokeWidth={1.75} />}
        {label}
        {help && <HelpTip text={help} />}
      </span>
      <ChevronDown
        size={13}
        className={`flex-shrink-0 ${
          open ? "rotate-180 text-accent" : "text-muted"
        } transition-transform duration-150`}
      />
    </div>
  );

  // While open, bump the wrapper above the click-outside scrim so the
  // input + dropdown stay clickable (scrim is z-40, chip becomes z-50).
  return (
    <span className={`relative block min-w-0 ${open ? "z-50" : ""}`}>
      {!open ? (
        <div className={cardClass}>
          <button
            type="button"
            onClick={openMenu}
            aria-haspopup="listbox"
            aria-expanded={false}
            className="w-full text-left bg-transparent outline-none"
          >
            {header}
            <div className={`text-sm leading-tight truncate ${
              isSet ? "text-ink font-medium" : "text-muted italic"
            }`}>
              {display}
            </div>
          </button>
          {hasWarning && (
            <div className="mt-1.5 pt-1.5 border-t border-accent/30 flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-accent italic leading-tight">
                {warning.reason}
              </span>
              {warning.suggestSlot && onMoveTo && (
                <button
                  type="button"
                  onClick={() => onMoveTo(warning.suggestSlot)}
                  className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-accent hover:underline flex-shrink-0"
                >
                  Move →
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={cardClass}>
          {header}
          {/* Multi mode: show the joined picks above the input as a
              hint so the teacher always sees what's selected. */}
          {multi && currentMulti.length > 0 && (
            <div className="text-sm text-ink font-medium leading-tight truncate mb-1">
              {joinMulti(currentMulti)}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode={numeric ? "numeric" : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (multi) addCustomMulti(draft);
                else commit(draft);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={
              multi
                ? currentMulti.length > 0 ? t("studio.combo.addAnother") : (emptyHint || t("studio.combo.pickOrType"))
                : (emptyHint || t("studio.combo.pickOrType"))
            }
            className="w-full bg-transparent outline-none text-sm text-ink leading-tight placeholder:text-muted placeholder:italic placeholder:font-normal"
          />
        </div>
      )}

      {open && (
        <ComboboxMenu
          label={label}
          value={value}
          draft={draft}
          options={filteredOptions}
          allOptions={options}
          suffix={suffix}
          multi={multi}
          currentMulti={currentMulti}
          onPick={commit}
          onToggle={toggleMulti}
          onAddCustom={addCustomMulti}
          onClose={() => (multi ? setOpen(false) : commit(draft))}
        />
      )}
    </span>
  );
}

// Filtered menu that opens under a DropdownChip. Shows two regions:
//   1. "Use \"<draft>\" (custom)" — when the draft text doesn't match
//      any preset; lets the teacher commit (single) or append (multi)
//      a free-form value.
//   2. The filtered preset options.
// There is no "let Murchid choose" / clear option: every chip is required,
// so the teacher always lands on a concrete value.
// In multi mode, clicking an option toggles it in the joined value
// without closing the menu; "Done" at the bottom closes.
function ComboboxMenu({
  label, value, draft, options, allOptions, suffix,
  onPick, onClose,
  multi, currentMulti = [], onToggle, onAddCustom,
}) {
  const t = useT();
  // Explicit "Add new" popup — a clearer affordance than type-to-add for
  // teachers who don't realise the field is also a text input.
  const [addOpen, setAddOpen] = useState(false);
  const trimmed = String(draft || "").trim();
  const isCustom =
    trimmed.length > 0 &&
    !allOptions.some((o) => String(o).toLowerCase() === trimmed.toLowerCase());
  const isSelected = (opt) =>
    multi
      ? currentMulti.some((x) => String(x).toLowerCase() === String(opt).toLowerCase())
      : String(opt) === String(value);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-transparent cursor-default"
      />
      <div
        role="listbox"
        onClick={(e) => e.stopPropagation()}
        className="studio-menu-rise absolute left-0 top-full mt-1.5 z-50 min-w-[14rem] max-h-[60vh] overflow-y-auto origin-top-left rounded-2xl border border-line bg-paper-cool shadow-xl ring-1 ring-ink/5"
      >
        <ul className="py-1">
          {isCustom && (
            <>
              <li>
                <button
                  type="button"
                  onClick={() => multi ? onAddCustom(trimmed) : onPick(trimmed)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-paper-warm/60"
                >
                  <span className="truncate">
                    {multi ? t("studio.combo.add") : t("studio.combo.use")}
                    <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
                    <span className="text-muted ml-1.5 text-[11px] italic">{t("studio.combo.custom")}</span>
                  </span>
                  <Plus size={13} className="text-accent flex-shrink-0" />
                </button>
              </li>
              <li className="border-t border-line/60 my-1" />
            </>
          )}

          {options.length === 0 && !isCustom && (
            <li className="px-3 py-2 text-sm text-muted italic">{t("studio.combo.noMatches")}</li>
          )}

          {options.map((opt) => {
            const isActive = isSelected(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => (multi ? onToggle(opt) : onPick(opt))}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                    isActive
                      ? "bg-paper-warm text-ink font-medium"
                      : "text-ink hover:bg-paper-warm/60"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {multi && (
                      <span className={`inline-flex items-center justify-center h-4 w-4 rounded border ${
                        isActive
                          ? "bg-accent border-accent text-paper-cool"
                          : "border-line bg-paper"
                      }`}>
                        {isActive && <Check size={10} strokeWidth={3} />}
                      </span>
                    )}
                    <span>
                      {opt}
                      {suffix && <span className="text-muted ml-1">{suffix}</span>}
                    </span>
                  </span>
                  {!multi && isActive && <Check size={13} className="text-accent" />}
                </button>
              </li>
            );
          })}
          <li className="border-t border-line/60 mt-1 pt-1">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-paper-warm/60"
            >
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent/15">
                <Plus size={11} strokeWidth={2.5} />
              </span>
              {t("studio.combo.addNew")}
            </button>
          </li>
        </ul>
        {multi && (
          <div className="border-t border-line/60 px-2 py-2 flex items-center justify-between gap-2 bg-paper">
            <span className="font-serif italic text-xs text-muted px-1">
              {currentMulti.length === 0
                ? t("studio.combo.multiHint")
                : `${currentMulti.length} selected`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink hover:text-accent px-2 py-1"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {addOpen && (
        <AddChipValuePopup
          label={label}
          onCancel={() => setAddOpen(false)}
          onAdd={(v) => {
            setAddOpen(false);
            if (multi) onAddCustom(v);
            else onPick(v);
          }}
        />
      )}
    </>
  );
}

// Small centered popup for adding a brand-new chip value. Opened from the
// "Add new" row inside ComboboxMenu so the affordance is explicit (vs.
// the subtler type-to-add). Esc / backdrop / Cancel all dismiss.
function AddChipValuePopup({ label, onCancel, onAdd }) {
  const t = useT();
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 0);
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [onCancel]);
  const submit = () => {
    const v = val.trim();
    if (v) onAdd(v);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="studio-menu-rise relative bg-paper-cool rounded-2xl border border-line shadow-2xl w-full max-w-sm p-5">
        <p className="font-serif italic text-base text-accent mb-2">
          {t("studio.combo.addNewTitle", { label: label || "" })}
        </p>
        <input
          ref={ref}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={t("studio.combo.addNewPh")}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(200,71,43,0.12)] transition-all"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} className="text-sm px-4 py-2">
            {t("studio.combo.cancel")}
          </Button>
          <Button onClick={submit} disabled={!val.trim()} className="text-sm px-4 py-2">
            <Plus size={14} className="mr-1.5" />
            {t("studio.combo.addNewBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Save-time confirmation. Surfaced only when the teacher edited at least
// one correct_answer pre-save. Lists each changed question (was → now)
// Warn the teacher when their free-text prompt mentions a Grade /
// Duration / Slides / Questions value that disagrees with the chip
// value above. "Use settings" makes the chips authoritative on this
// generation; "Edit" closes the modal so they can fix the prompt.
function ChipPromptConflictModal({ conflicts, onUseChips, onEdit }) {
  const t = useT();
  const fieldLabel = (f) => t(`studio.chip.${f}.label`);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onEdit} />
      <div className="studio-menu-rise relative bg-paper-cool rounded-2xl border border-line shadow-2xl w-full max-w-md p-6 md:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-2">
          {t("studio.conflict.eyebrow")}
        </p>
        <h3 className="font-serif text-xl md:text-2xl font-medium text-ink leading-tight mb-3">
          {t("studio.conflict.title")}
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed mb-4">
          {t("studio.conflict.body")}
        </p>
        <ul className="space-y-2 mb-5">
          {conflicts.map((c, i) => (
            <li
              key={i}
              className="rounded-lg border border-line bg-paper-warm/40 px-3 py-2 text-sm"
            >
              <p className="font-medium text-ink mb-0.5">{fieldLabel(c.field)}</p>
              <p className="text-ink-soft leading-snug">
                <span className="font-medium">{t("studio.conflict.chip")}:</span> {c.chip}
                {" · "}
                <span className="font-medium">{t("studio.conflict.prompt")}:</span> {c.prompt}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2 rounded-lg border border-line text-ink text-sm font-medium hover:bg-paper-warm transition-colors"
          >
            {t("studio.conflict.edit")}
          </button>
          <button
            type="button"
            onClick={onUseChips}
            className="px-4 py-2 rounded-lg bg-accent text-paper-cool text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {t("studio.conflict.useChips")}
          </button>
        </div>
      </div>
    </div>
  );
}

// so the teacher can double-check before the change is persisted to the
// quiz_questions table. Cancel keeps editing; Confirm proceeds with the
// real save call.
function AnswerChangeConfirm({ changes, onCancel, onConfirm }) {
  const formatAnswer = (value, type) => {
    if (value === true) return "True";
    if (value === false) return "False";
    if (value == null || value === "") return "—";
    if (typeof value === "string") {
      // Trim long short/essay rubrics so the modal stays readable.
      if (type === "short" || type === "essay") {
        return value.length > 60 ? `${value.slice(0, 60)}…` : value;
      }
      return value;
    }
    return JSON.stringify(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="studio-menu-rise relative bg-paper-cool rounded-2xl border border-line shadow-2xl w-full max-w-md p-6 md:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-2">
          Heads up
        </p>
        <h3 className="font-serif text-xl md:text-2xl font-medium text-ink leading-tight mb-2">
          You changed {changes.length === 1 ? "the correct answer" : `the correct answer in ${changes.length} questions`}.
        </h3>
        <p className="text-sm text-muted mb-4 leading-relaxed">
          Saving will overwrite the answer key with your version. The other
          edits (prompts, choice text, marks) save without confirmation.
        </p>

        <ul className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto pr-1">
          {changes.map((c) => (
            <li
              key={c.position}
              className="rounded-lg border border-line bg-paper p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Question {c.position}
                </p>
                <span className="px-2 py-0.5 rounded-full border border-line bg-paper-cool text-[10px] text-ink-soft">
                  {QUIZ_TYPE_LABELS[c.type] || c.type}
                </span>
              </div>
              <p className="text-sm text-ink-soft leading-snug mb-2 line-clamp-2">
                {c.prompt}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">was</span>
                <span className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-ink-soft line-through">
                  {formatAnswer(c.was, c.type)}
                </span>
                <span className="text-muted">→</span>
                <span className="px-1.5 py-0.5 rounded border border-accent/40 bg-accent/[0.06] font-mono text-accent">
                  {formatAnswer(c.now, c.type)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="text-sm px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            className="text-sm px-4 py-2"
          >
            <Check size={14} className="mr-1.5" />
            Save anyway
          </Button>
        </div>
      </div>
    </div>
  );
}

// Premium custom modal for "you're about to leave with unsaved work."
// Replaces the native window.confirm. Same modal chrome as
// AnswerChangeConfirm: backdrop blur, cream paper sheet, serif headline,
// red eyebrow. Esc and backdrop click both stay; explicit "Leave studio"
// button proceeds.
function LeaveStudioConfirm({ busy, isDirty, savedDraftId, onStay, onLeave }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onStay(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStay]);

  const headline = busy
    ? "Cancel and leave the studio?"
    : savedDraftId && !isDirty
      ? "Leave the studio?"
      : "Leave with unsaved edits?";

  const body = busy
    ? "Murchid is still generating. Leaving now cancels the draft — nothing is saved to your library."
    : savedDraftId && !isDirty
      ? "Your quiz is safely saved. You can reopen it from the library any time."
      : "Your in-place edits aren't saved yet. Leaving will discard them.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={onStay}
      />
      <div className="studio-menu-rise relative bg-paper-cool rounded-2xl border border-line shadow-2xl w-full max-w-md p-6 md:p-7">
        <p className="font-serif italic text-base text-accent mb-2">
          {busy ? "Murchid is still working" : "Before you go"}
        </p>
        <h3 className="font-serif text-xl md:text-2xl font-medium text-ink leading-tight mb-2">
          {headline}
        </h3>
        <p className="text-sm text-ink-soft mb-5 leading-relaxed">
          {body}
        </p>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onStay}
            className="text-sm px-4 py-2"
            autoFocus
          >
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={onLeave}
            className="text-sm px-4 py-2"
          >
            <X size={14} className="mr-1.5" />
            {busy ? "Cancel & leave" : "Leave studio"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuizMetaCard({ quiz, onUpdate, disabled = false }) {
  const t = useT();
  if (!quiz) return null;
  const totalQ = (quiz.questions || []).length;
  // The meta chips (Subject, Grade, Language, Section, Difficulty, Duration)
  // and the scheduled date were all set on the picker view before generation.
  // Re-editing them mid-draft makes no sense (the body wouldn't match) so
  // they render read-only here. Only title and instructions stay editable.
  return (
    <div
      className="rounded-2xl border border-line bg-paper-cool p-5 md:p-6 studio-card-stagger"
      dir={isArabicLang(quiz.language) ? "rtl" : undefined}
    >
      <p className="font-serif italic text-base text-muted mb-2">{t("studio.cover.title")}</p>
      <EditableText
        value={quiz.title || ""}
        onChange={(v) => onUpdate({ title: v })}
        placeholder={t("studio.cover.titlePlaceholder")}
        disabled={disabled}
        className="font-serif text-2xl md:text-3xl font-medium text-ink leading-tight mb-4 w-full"
      />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-ink-soft mb-5">
        <ReadOnlyMeta label={t("studio.cover.subject")} value={quiz.subject} />
        <ReadOnlyMeta label={t("studio.cover.grade")} value={quiz.grade} />
        <ReadOnlyMeta label={t("studio.cover.language")} value={quiz.language} />
        <ReadOnlyMeta label={t("studio.cover.section")} value={quiz.section} />
        <ReadOnlyMeta label={t("studio.cover.difficulty")} value={quiz.difficulty} />
        <ReadOnlyMeta
          label={t("studio.cover.duration")}
          value={quiz.duration_minutes}
          suffix={quiz.duration_minutes ? t("studio.cover.min") : null}
        />
        <ReadOnlyMeta
          label={t("studio.cover.scheduled")}
          value={quiz.scheduled_for ? formatScheduledDate(quiz.scheduled_for) : null}
        />
        <span className="font-serif italic text-muted">
          · {t("studio.cover.questions", { n: totalQ })} · <span className="text-ink not-italic font-medium">{t("studio.cover.marks", { n: quiz.total_marks ?? 0 })}</span>
        </span>
      </div>

      <div>
        <p className="font-serif italic text-base text-muted mb-1.5">{t("studio.cover.instructions")}</p>
        <EditableTextarea
          value={quiz.instructions || ""}
          onChange={(v) => onUpdate({ instructions: v })}
          placeholder={t("studio.cover.instrPlaceholder")}
          rows={2}
          disabled={disabled}
          className="text-sm text-ink-soft leading-relaxed w-full"
        />
      </div>
    </div>
  );
}

function QuizQuestionCard({ question, index, onUpdate, disabled = false, rtl = false, marksTotal = 0, marksRemaining = 0 }) {
  const t = useT();
  const [showAnswer, setShowAnswer] = useState(false);
  if (!question) return null;
  const typeLabel = QUIZ_TYPE_LABELS[question.type] || question.type;
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const correctLetter =
    typeof question.correct_answer === "string" && question.correct_answer.length === 1
      ? question.correct_answer.toUpperCase()
      : null;

  const updateChoice = (i, text) => {
    if (disabled) return;
    const next = choices.slice();
    next[i] = text;
    onUpdate({ choices: next });
  };
  const safeUpdate = (patch) => { if (!disabled) onUpdate(patch); };

  return (
    <div className="rounded-2xl border border-line bg-paper-cool p-5 md:p-6 studio-card-stagger" dir={rtl ? "rtl" : undefined}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-serif italic text-base text-muted">
          Question {question.position ?? index + 1}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-full border border-line bg-paper text-[11px] text-ink-soft">
            {typeLabel}
          </span>
          {/* Per-question marks — an explicit labelled stepper so teachers
              see at a glance they can weight each question (no hidden
              click-to-edit). */}
          <span className="inline-flex items-center gap-1.5" dir="ltr">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {t("studio.qmarks.label")}
            </span>
            <span className="inline-flex items-center h-7 rounded-lg border border-line bg-paper overflow-hidden">
              <button
                type="button"
                onClick={() => safeUpdate({ marks: Math.max(1, (Number(question.marks) || 1) - 1) })}
                disabled={disabled || (Number(question.marks) || 1) <= 1}
                aria-label={t("studio.qmarks.dec")}
                className="px-2 h-full grid place-items-center text-ink-soft hover:bg-paper-warm hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus size={12} strokeWidth={2.5} />
              </button>
              <input
                type="number"
                value={question.marks ?? 1}
                onChange={(e) => safeUpdate({ marks: Math.max(1, Number(e.target.value) || 1) })}
                min={1}
                disabled={disabled}
                aria-label={t("studio.qmarks.label")}
                className="w-9 h-full text-center text-sm font-semibold text-ink bg-paper-warm/40 border-x border-line outline-none focus:bg-paper [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => safeUpdate({ marks: (Number(question.marks) || 1) + 1 })}
                disabled={disabled}
                aria-label={t("studio.qmarks.inc")}
                className="px-2 h-full grid place-items-center text-ink-soft hover:bg-paper-warm hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={12} strokeWidth={2.5} />
              </button>
            </span>
          </span>
        </div>
      </div>

      {/* Running allocation: the per-question marks must add up to the
          quiz total before it can be exported. */}
      {marksTotal > 0 && (
        <p className={`text-[11.5px] mb-3 -mt-1 ${marksRemaining === 0 ? "text-sage" : "text-accent"}`}>
          {marksRemaining === 0
            ? t("studio.marks.balanced", { total: marksTotal })
            : marksRemaining > 0
            ? t("studio.marks.left", { remaining: marksRemaining, total: marksTotal })
            : t("studio.marks.over", { over: -marksRemaining, total: marksTotal })}
        </p>
      )}

      <EditableTextarea
        value={question.prompt || ""}
        onChange={(v) => safeUpdate({ prompt: v })}
        placeholder="Question prompt"
        rows={2}
        disabled={disabled}
        className="font-serif text-lg md:text-xl text-ink leading-snug mb-4 w-full"
      />

      {question.type === "mcq" && (
        <ol className="space-y-2 mb-4">
          {choices.map((c, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = letter === correctLetter;
            const showHighlight = showAnswer && isCorrect;
            return (
              <li
                key={i}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg border transition-colors duration-200 ${
                  showHighlight
                    ? "border-accent/50 bg-accent/[0.06]"
                    : "border-line bg-paper"
                }`}
              >
                <button
                  type="button"
                  onClick={() => safeUpdate({ correct_answer: letter })}
                  disabled={disabled}
                  title={showAnswer && isCorrect ? "This is the correct answer" : "Mark as correct"}
                  className={`flex-shrink-0 h-6 w-6 rounded-md font-mono text-[11px] flex items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed ${
                    showHighlight
                      ? "bg-accent text-paper-cool"
                      : "bg-paper-warm text-ink-soft hover:bg-paper-warm/80 hover:text-ink"
                  }`}
                >
                  {letter}
                </button>
                <EditableText
                  value={c}
                  onChange={(v) => updateChoice(i, v)}
                  placeholder={`Option ${letter}`}
                  disabled={disabled}
                  className="flex-1 text-sm text-ink leading-snug"
                />
                {showHighlight && <Check size={14} className="text-accent flex-shrink-0 mt-0.5" />}
              </li>
            );
          })}
        </ol>
      )}

      {question.type === "tf" && (
        <div className="flex gap-2 mb-4">
          {[
            { label: t("export.true"), value: true },
            { label: t("export.false"), value: false },
          ].map(({ label, value }) => {
            const isCorrect = question.correct_answer === value;
            const showHighlight = showAnswer && isCorrect;
            return (
              <button
                key={label}
                type="button"
                onClick={() => safeUpdate({ correct_answer: value })}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors duration-200 disabled:cursor-not-allowed ${
                  showHighlight
                    ? "border-accent bg-accent/[0.06] text-accent font-medium"
                    : "border-line bg-paper text-ink-soft hover:border-ink"
                }`}
              >
                {label}
                {showHighlight && <Check size={13} className="inline ml-1.5 -mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}

      {(question.type === "short" || question.type === "essay") && showAnswer && (
        <div className="mb-4">
          <p className="font-serif italic text-base text-muted mb-1.5">
            {question.type === "essay" ? "Rubric outline" : "Expected answer"}
          </p>
          <EditableTextarea
            value={
              typeof question.correct_answer === "string"
                ? question.correct_answer
                : ""
            }
            onChange={(v) => safeUpdate({ correct_answer: v })}
            placeholder={
              question.type === "essay"
                ? "1–2 sentences describing what a strong response covers."
                : "Expected answer text."
            }
            rows={2}
            disabled={disabled}
            className="text-sm text-ink-soft leading-relaxed w-full"
          />
        </div>
      )}

      <div className="border-t border-line pt-3 mt-1 flex items-center justify-between gap-3">
        {!showAnswer ? (
          <button
            type="button"
            onClick={() => setShowAnswer(true)}
            className="font-serif italic text-sm text-muted hover:text-accent transition-colors duration-200"
            title="Show the AI's marking key for this question. You can still edit the correct answer."
          >
            Show correct answer
          </button>
        ) : (
          <p className="font-serif italic text-base text-accent">
            Correct answer
          </p>
        )}
        {showAnswer && (
          <button
            type="button"
            onClick={() => setShowAnswer(false)}
            className="text-[11px] text-muted hover:text-accent"
          >
            Hide
          </button>
        )}
      </div>
    </div>
  );
}

// --- Editable primitives ---------------------------------------------------
//
// These render as plain text in flow until hovered/focused. Subtle
// underline on hover signals "you can edit this"; a real input border
// appears once focused. They never lose focus on each keystroke (the
// input is the source of truth), so typing always feels native.

// Small custom tooltip for the chip help icons. Native `title` attrs have
// a 1–2s browser delay and don't fire on touch, so we render our own.
// Hover (or focus, or tap) shows; mouseleave / re-tap hides. Clicks
// stopPropagation so they don't bubble to the parent chip and open its
// dropdown. The popover floats above the chip with a small caret.
// Two-option segmented control for the tweak-bar scope. "Question" rewrites
// the open question; "Quiz" rewrites the whole quiz. Lives inside the
// frosted tweak bar so it reads as part of the same control. When the cover
// section is open `metaLocked` pins the value to "quiz" and disables the
// "question" button — there's no single question to target there.
function TweakScopeToggle({ value, onChange, metaLocked, disabled }) {
  const opts = [
    { id: "question", label: "This question" },
    { id: "quiz", label: "Whole quiz" },
  ];
  return (
    <div
      role="group"
      aria-label="Tweak scope"
      className={`flex-shrink-0 inline-flex items-center rounded-full bg-paper-warm/70 border border-line p-0.5 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {opts.map((o) => {
        const active = value === o.id;
        const lockedOff = metaLocked && o.id === "question";
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled || lockedOff}
            onClick={() => onChange(o.id)}
            title={
              lockedOff
                ? "Open a question section first to tweak just that one."
                : o.id === "question"
                  ? "Rewrite only the open question."
                  : "Rewrite every question in the quiz."
            }
            className={`px-2.5 py-1 rounded-full text-[11px] leading-none font-serif italic transition-colors duration-150 ${
              active
                ? "bg-ink text-paper-cool"
                : lockedOff
                  ? "text-muted/50 cursor-not-allowed"
                  : "text-ink-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function HelpTip({ text }) {
  const [open, setOpen] = useState(false);
  const { dir } = useI18n();
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      aria-label={`Help: ${text}`}
    >
      <HelpCircle
        size={11}
        strokeWidth={1.75}
        className={`cursor-help transition-colors duration-150 ${
          open ? "text-accent" : "text-muted/80 hover:text-accent"
        }`}
      />
      {open && (
        <span
          role="tooltip"
          dir={dir}
          className="studio-helptip absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-60 px-3 py-2.5 rounded-lg bg-ink text-paper-cool text-[11px] leading-relaxed shadow-xl pointer-events-none normal-case tracking-normal font-sans font-normal text-start"
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-ink" />
          {text}
        </span>
      )}
    </span>
  );
}

function EditableText({ value, onChange, placeholder, disabled = false, className = "" }) {
  // The native `size` attribute lets the input auto-fit its current value
  // width-wise (in ch units). Useful for inline meta fields like
  // Subject/Grade. Any explicit width class (e.g. w-full) wins over it.
  const ch = Math.max((value || placeholder || "").length || 4, 4);
  // A pencil rides just after the field — invisible until hover/focus —
  // so teachers can tell at a glance that the value is theirs to edit.
  return (
    <span className={`group/edit relative inline-flex items-center gap-1 align-baseline ${className.includes("w-full") ? "w-full" : "max-w-full"}`}>
      <input
        type="text"
        size={ch}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`bg-transparent outline-none border-b border-transparent hover:border-line/60 focus:border-ink focus:bg-paper transition-colors duration-150 placeholder:text-muted disabled:cursor-not-allowed disabled:hover:border-transparent ${className}`}
      />
      {!disabled && (
        <Pencil
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className="flex-shrink-0 text-muted/70 opacity-0 group-hover/edit:opacity-100 group-focus-within/edit:opacity-100 transition-opacity duration-150 pointer-events-none motion-reduce:transition-none"
        />
      )}
    </span>
  );
}

function EditableTextarea({ value, onChange, placeholder, rows = 2, disabled = false, className = "" }) {
  // Auto-grow to fit content so long question prompts don't get clipped and
  // the teacher never has to drag the resize handle. We measure on each
  // value change by zeroing the height then snapping back to scrollHeight.
  // A min-height (derived from `rows`) keeps short prompts from collapsing.
  const ref = useRef(null);
  const isEmpty = !value || !String(value).trim();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  // Empty state shows a dashed border + soft fill + pencil icon so teachers
  // can see at a glance that this is a place they can type. Once they've
  // written anything, the field reverts to the clean editorial look so the
  // saved content reads like a finished document.
  return (
    <div className="group/edit relative -m-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`block bg-transparent outline-none rounded-md p-2 border ${
          isEmpty && !disabled
            ? "border-dashed border-line bg-paper-warm/50 cursor-text"
            : "border-transparent"
        } hover:border-line/60 focus:border-solid focus:border-ink focus:bg-paper resize-none overflow-hidden transition-colors duration-150 placeholder:text-muted whitespace-pre-wrap disabled:cursor-not-allowed disabled:hover:border-transparent ${className}`}
      />
      {/* Empty fields show the pencil permanently (it doubles as a "type
          here" cue); filled fields reveal it only on hover/focus so the
          finished text still reads cleanly. */}
      {!disabled && (
        <Pencil
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={`absolute top-2.5 end-2.5 text-muted/70 pointer-events-none transition-opacity duration-150 motion-reduce:transition-none ${
            isEmpty
              ? "opacity-100"
              : "opacity-0 group-hover/edit:opacity-100 group-focus-within/edit:opacity-100"
          }`}
        />
      )}
    </div>
  );
}

function EditableNumber({ value, onChange, min = 0, disabled = false, className = "" }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      disabled={disabled}
      className={`bg-transparent outline-none border-b border-transparent hover:border-line/60 focus:border-ink focus:bg-paper transition-colors duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed disabled:hover:border-transparent ${className}`}
    />
  );
}

// Read-only meta chip used on the quiz cover. Subject / Grade / etc. were
// locked in pre-generation, so the cover just echoes them as text.
function ReadOnlyMeta({ label, value, suffix }) {
  const display = value === 0 || value ? String(value) : "—";
  const isSet = display !== "—";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-serif italic text-sm text-muted">{label}</span>
      <span className={`text-sm ${isSet ? "text-ink font-medium" : "text-muted italic"}`}>
        {display}
        {isSet && suffix ? <span className="font-serif italic text-muted font-normal not-italic"> </span> : null}
        {isSet && suffix ? <span className="font-serif italic text-sm text-muted">{suffix}</span> : null}
      </span>
    </span>
  );
}

function MetaField({ label, value, onChange, placeholder, suffix, numeric }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-serif italic text-sm text-muted">{label}</span>
      {numeric ? (
        <EditableNumber
          value={value}
          onChange={onChange}
          className="w-12 text-sm text-ink"
        />
      ) : (
        <EditableText
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="text-sm text-ink"
        />
      )}
      {suffix && <span className="font-serif italic text-sm text-muted">{suffix}</span>}
    </span>
  );
}
