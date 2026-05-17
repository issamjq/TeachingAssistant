import React, { useEffect, useMemo, useRef, useState } from "react";
import { setNavGuard } from "../lib/route";
import {
  Sparkles, FileText, ClipboardList, GraduationCap,
  Layers, Users, Calendar, Save, Copy, Check, X, RotateCcw, FileDown,
  Send, Paperclip, Plus, Wand2, RefreshCw, Zap, Dices, ChevronDown,
  BookOpen, Gauge, Hash, Clock, Globe, HelpCircle, ListChecks,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, DatePicker } from "./_shared";
import { useT } from "../lib/i18n";
import { parseSections, joinSections, renderMarkdown } from "../lib/markdown";
import StudioCard from "./StudioCard";
import SlideBuilder from "./SlideBuilder";
import MudirMascot from "../components/MudirMascot";
import {
  GRADE_LEVELS, MAJORS,
  QUIZ_QUESTION_COUNTS, QUIZ_DURATIONS, QUIZ_DIFFICULTIES,
  QUIZ_LANGUAGES, QUIZ_SECTIONS, QUIZ_QUESTION_MIXES,
} from "../lib/enums";

// Same base URL the rest of the app uses (Vercel rewrites /api → Render in
// prod; same-origin in dev via the Vite middleware).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Each kind has its headline split into three parts so the noun-phrase can
// be rendered as an inline-clickable element inside the Mudir sentence:
//   "{verb} a {inlineLabel}. {suffix}"
// e.g.  Plan  a  [schedule ▾].  Tell Mudir the timeframe.
const KINDS = [
  {
    value: "lesson_plan",  label: "Lesson",     icon: FileText,
    oneliner: "Structured class plan",
    menuBlurb: "Outline + materials",
    verb: "Make", inlineLabel: "lesson plan",   suffix: "Tell Mudir what to teach.",
    sample: "A 45-minute Grade 7 science lesson on photosynthesis with a hands-on starter, two activities, and a quick exit ticket.",
  },
  {
    value: "quiz",         label: "Quiz",       icon: GraduationCap,
    oneliner: "MCQ, T/F, short or essay",
    menuBlurb: "MCQ, T/F, short or essay",
    verb: "Make", inlineLabel: "quiz",          suffix: "Tell Mudir what to test.",
    // The chips above the textarea already carry grade / subject / major
    // / difficulty / count / duration, so the prompt should focus on
    // content only: which sub-topics, real-world hooks, what to emphasise.
    sample: "Linear equations — focus on word problems with real-world scenarios. Avoid pure plug-and-chug.",
  },
  {
    value: "homework",     label: "Homework",   icon: ClipboardList,
    oneliner: "Take-home tasks",
    menuBlurb: "Take-home practice",
    verb: "Make", inlineLabel: "homework",      suffix: "Tell Mudir the focus.",
    sample: "Reading-comprehension homework for Grade 6 English on a short story — students answer 5 questions in writing.",
  },
  {
    value: "activity",     label: "Activity",   icon: Users,
    oneliner: "Pair, group or solo task",
    menuBlurb: "Group or pair task",
    verb: "Plan", inlineLabel: "activity",      suffix: "Tell Mudir what learners explore.",
    sample: "Group activity for Grade 5 history: students roleplay a town hall debating the construction of the railway.",
  },
  {
    value: "presentation", label: "Presentation", icon: Layers,
    oneliner: "Slide-by-slide outline",
    menuBlurb: "Deck for class",
    verb: "Make", inlineLabel: "presentation",  suffix: "Tell Mudir what to cover.",
    sample: "8-slide intro deck on the water cycle for Grade 4.",
  },
  {
    value: "schedule",     label: "Schedule",   icon: Calendar,
    oneliner: "Weekly or term plan",
    menuBlurb: "Pacing & calendar",
    verb: "Plan", inlineLabel: "schedule",      suffix: "Tell Mudir the timeframe.",
    sample: "A weekly schedule for Grade 7 Science covering forces and motion across one week (5 days, ~50 min each).",
  },
];

// Recent prompts live in localStorage so the chips always reflect what
// THIS teacher actually generated. Stored per kind, capped at 8, prepended
// on each successful generation. First-time users see a kind-appropriate
// seed list (so the row is never empty).
const RECENTS_STORAGE_KEY = (kind) => `mudir:studio:recents:${kind}`;
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

// Pre-prompt parameters the teacher can lock in before a quiz is generated.
// Every field is optional — if left empty the AI infers from the prompt.
// Default to empty (not 10 / 30 / Medium) so the chip placeholder reads
// "Pick…" and the teacher sees them as actual choices, not pre-decisions.
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
};

// Activity pre-prompt panel mirrors the quiz settings layout but with
// activity-specific labels. Per the chip rules, activities have NO
// grade or section — only Type, Major, Language, Duration. Same idea:
// every field is optional, Mudir infers from the prompt when blank.
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
// a "Schedule for" date that doubles as the due date.
const HOMEWORK_PARAMS_DEFAULTS = {
  grade: "",
  major: "",
  language: "",
  section: "",
  scheduled_for: "", // YYYY-MM-DD (interpreted as the due date)
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

export default function Studio({ initialKind } = {}) {
  // initialKind comes from the URL (#/studio/<kind>) so the Teaching
  // surfaces can deep-link straight to "Make a quiz", "Make a
  // homework", etc. Falls back to lesson_plan when the route is bare
  // or the value isn't one of the recognised kinds.
  const t = useT();
  const kindLabel = (v) => {
    const s = t(`kind.${v}`);
    return s === `kind.${v}` ? (KINDS.find((k) => k.value === v)?.label || v) : s;
  };
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
    api("/api/me")
      .then((data) => { if (alive) setTeacher(data); })
      .catch(() => { if (alive) setTeacher({}); });
    return () => { alive = false; };
  }, []);

  // Per-chip option lists. Prefer the teacher's curated set; fall back
  // to the global enum so a first-time teacher (empty profile) still
  // gets a usable dropdown.
  const teacherGrades = (teacher?.grade_levels || []).filter(Boolean);
  const teacherMajors = (teacher?.majors || []).filter(Boolean);
  const teacherLanguages = (teacher?.languages || []).filter(Boolean);
  const teacherSections = (teacher?.sections || []).filter(Boolean);
  const gradeOptions = teacherGrades.length ? teacherGrades : GRADE_LEVELS;
  const majorOptions = teacherMajors.length ? teacherMajors : MAJORS;
  const languageOptions = teacherLanguages.length ? teacherLanguages : QUIZ_LANGUAGES;
  const sectionOptions = teacherSections.length ? teacherSections : QUIZ_SECTIONS;

  const [busy, setBusy] = useState(false);
  // Quizzes now stream as markdown text just like every other kind, so
  // the teacher watches each question get written live. The structured
  // quiz object arrives in the final `done` event (backend restructures
  // the finished markdown) and drives the editable cards.
  const [streamingText, setStreamingText] = useState("");
  // Pre-prompt knobs the teacher can lock in before generating a quiz.
  // Every field is optional — left as "" / null the AI infers from prose.
  // Only surfaced when kind === "quiz".
  const [quizParams, setQuizParams] = useState(QUIZ_PARAMS_DEFAULTS);
  const [activityParams, setActivityParams] = useState(ACTIVITY_PARAMS_DEFAULTS);
  const [lessonParams, setLessonParams] = useState(LESSON_PARAMS_DEFAULTS);
  const [homeworkParams, setHomeworkParams] = useState(HOMEWORK_PARAMS_DEFAULTS);
  const [presentationParams, setPresentationParams] = useState(PRESENTATION_PARAMS_DEFAULTS);
  // Optional file attachment (image or PDF) — base64-encoded, sent
  // alongside the prompt so the AI can read a textbook page, photo of
  // the board, scanned exam, etc., and base the output on it.
  //   shape: { name, mediaType, dataBase64, sizeBytes }  | null
  const [attachment, setAttachment] = useState(null);
  const [attachError, setAttachError] = useState(null);
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  // Sections are the editable per-card breakdown of the result. They start
  // as the parsed structure of streamingText and are then mutated as the
  // user edits or regenerates individual cards.
  const [sections, setSections] = useState([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState(null);
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
  // The "Ask Mudir to tweak" input. Submitting it regenerates the current
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
  const suggestions = useMemo(
    () => attachment
      ? pickAttachmentSuggestions(kind, recencyTick + Date.now() % 1000)
      : pickSuggestions(kind, recencyTick + Date.now() % 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, recencyTick, Boolean(attachment)]
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
    if (result?.kind === "quiz" && result.quiz?.title) return result.quiz.title;
    const text = sections.length && sections[0]?.markdown != null
      ? joinSections(sections)
      : streamingText;
    const line = (text || "").split(/\r?\n/).find((l) => /^#{1,3}\s+/.test(l));
    return line ? line.replace(/^#+\s*/, "").trim() : `${active?.label || ""} draft`;
  }, [result, sections, streamingText, active?.label]);

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
      const totalMarks = questions.reduce(
        (s, q) => s + (Number(q.marks) || 0),
        0
      );
      return {
        ...prev,
        quiz: { ...prev.quiz, questions, total_marks: totalMarks },
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
    setAttachment(null);
    setAttachError(null);
    setResult(null);
    setSections([]);
    setError(null);
    setSavedDraftId(null);
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

  const onPickFile = (e) => {
    setAttachError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_ATTACH_MIME.has(file.type)) {
      setAttachError(`Type "${file.type || "unknown"}" isn't supported. Use a PNG, JPEG, WebP, GIF, or PDF.`);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setAttachError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Cap is 4 MB for now.`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      const dataBase64 = comma >= 0 ? result.slice(comma + 1) : "";
      setAttachment({
        name: file.name,
        mediaType: file.type,
        sizeBytes: file.size,
        dataBase64,
      });
    };
    reader.onerror = () => {
      setAttachError("Could not read that file.");
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file later
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachError(null);
  };

  // Consume the SSE stream from the studio endpoint. For kind=quiz we hit
  // the structured /api/studio/quiz path (tool-use → typed Quiz object);
  // every other kind uses the markdown /api/studio/generate path.
  const generate = async () => {
    // Either a typed prompt or an attached file is enough — when the
    // teacher only attaches an image of a worksheet, an empty textarea
    // is a valid signal of "use the whole image".
    if (!prompt.trim() && !attachment) return;
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
    try {
      const body = isQuiz
        ? { kind, prompt: prompt.trim(), params: quizParams, attachment }
        : { kind, prompt: prompt.trim(), params: paramsForKind, attachment };
      const res = await fetch(API_BASE + (isQuiz ? "/api/studio/quiz" : "/api/studio/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
              const aiQuiz = {
                ...payload.quiz,
                ...(quizParams.scheduled_for ? { scheduled_for: quizParams.scheduled_for } : {}),
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
    const hasUnsavedContent = !!result
      ? !savedDraftId || isDirty
      : sections.length > 0;
    if (!hasInflight && !hasUnsavedContent) return;

    const cleanupGuard = setNavGuard((proceed) => {
      setPendingLeave({ proceed });
      return false;
    });
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cleanupGuard();
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
    setSavedDraftId(null);
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
      const res = await fetch(API_BASE + "/api/studio/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const exportPdf = () => window.print();

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

      // Markdown path (lesson plan, homework, etc.) — keeps the existing
      // drafts-table behaviour. Drafts table is structured around lesson
      // plans; everything else still saves there until per-kind tables
      // exist.
      const text = fullText();
      if (!text) return;
      const lines = text.split(/\r?\n/);
      const titleLine = lines.find((l) => /^#{1,2}\s+/.test(l)) || "Untitled lesson";
      const name = titleLine.replace(/^#+\s*/, "").trim().slice(0, 120);
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
      const res = await fetch(API_BASE + "/api/studio/quiz-tweak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            <Button
              variant="secondary"
              onClick={exportPdf}
              disabled={!result}
              className="text-xs px-3 py-1.5"
              title="Open the print dialog and choose Save as PDF"
            >
              <FileDown size={13} className="mr-1.5" /> {t("studio.pdf")}
            </Button>
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
                onSaved={(saved) => { setSavedDraftId(saved.id); setIsDirty(false); }}
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
                              ? "Mudir is rewriting — please wait."
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
                              (isQuiz && s.kind === "quiz_question") || isSlide ? "line-clamp-2" : "truncate"
                            }`}>
                              {primaryLabel}
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
                {sections.length > 0
                  ? renderMarkdown(joinSections(sections))
                  : <pre className="whitespace-pre-wrap font-sans">{streamingText}</pre>}
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
                        <div className="flex flex-col items-center justify-center py-6">
                          <MudirMascot size={140} label={t("studio.thinking")} />
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
                    <h3 className="font-serif text-2xl md:text-3xl font-medium text-ink mb-5 leading-tight">
                      {currentSection?.title}
                    </h3>

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
                            <LiveQuestionCard q={currentSection.question} busy={busy} />
                          ) : (
                            <QuizQuestionCard
                              question={currentSection.question}
                              index={sectionIndex - 1}
                              onUpdate={(patch) => updateQuestion(sectionIndex - 1, patch)}
                              disabled={quizScopeBusy}
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
                                ? "Mudir is rewriting this question…"
                                : "Mudir is rewriting the quiz…"}
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
          <CostFooter usage={result.usage} hadAttachment={Boolean(attachment)} />
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
                <HelpTip text="Type a plain-English instruction and Mudir will rewrite. Examples: 'make this harder', 'replace with a word problem', 'translate the whole quiz to Arabic'. Pick This question or Whole quiz on the left to choose the scope." />
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
                    ? "Mudir is drafting — tweak will be ready when sections appear."
                    : "Ask Mudir to tweak…"
                  : result?.kind === "quiz"
                    ? (currentSection?.kind === "quiz_meta" || tweakScope === "quiz")
                      ? "Tweak the whole quiz — e.g. 'switch every question to Arabic' or 'make it harder'"
                      : `Tweak Question ${(currentSection?.question?.position ?? sectionIndex)} — e.g. 'make this a word problem' or 'replace with True/False'`
                    : `Ask Mudir to tweak — e.g. 'make Part ${currentLetter} harder' or 'add 2 word problems'`
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
            <p className="text-sm font-medium text-accent mb-1">Could not generate</p>
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

      {/* Mudir prompt block — the kind noun-phrase inside the sentence is
          itself the picker. Teachers read the sentence, see one phrase
          styled like a tappable mini-card with an icon + chevron, and
          click it to swap the kind. No "spin" jargon needed. */}
      <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
        <div className="flex-shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-ink text-paper-cool font-serif italic text-base sm:text-lg flex items-center justify-center shadow-sm">
          M
        </div>
        <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 sm:mb-2">Mudir</p>
          <p className="font-serif text-lg sm:text-xl md:text-2xl lg:text-[1.75rem] text-ink leading-[1.4] sm:leading-[1.45]">
            {/* Keep "{verb} a [pill]" as a no-break unit so the kind pill
                never lands on its own line under "Make a". The suffix
                wraps naturally on narrow widths. */}
            <span className="whitespace-nowrap">
              {active?.verb} a{" "}
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
            {active?.suffix}
          </p>
        </div>
      </div>

      {/* Recent chips — backed by localStorage. Show the four most-recent
          prompts (or quiz titles) for this kind. Clicking restores the
          full prompt into the textarea. */}
      {recents.length > 0 && (
        <div className="mb-3 flex items-center gap-3 flex-wrap">
          <p className="font-serif italic text-base text-muted flex-shrink-0">Recent</p>
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
            attachment
              ? "Optional focus — e.g. \"only the formulas\" or \"skip the diagrams\". Leave blank to use the whole file."
              : active?.sample
          }
          className="w-full bg-transparent outline-none px-5 py-3 text-base text-ink placeholder:text-muted resize-none"
        />
        <div className="border-t border-line px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={onPickFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach an image or PDF — Mudir will base the output on it"
              className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                attachment
                  ? "border-accent bg-accent/[0.06] text-accent"
                  : "border-line bg-paper-cool hover:border-ink hover:bg-paper-warm text-ink-soft"
              }`}
            >
              <Paperclip size={14} />
            </button>
            {attachment && (
              <AttachmentChip
                file={attachment}
                onRemove={clearAttachment}
              />
            )}
            {!attachment && kind !== "quiz" && (
              <ParamChip>{active?.oneliner}</ParamChip>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden sm:block text-xs text-muted italic">
              {attachment && !prompt.trim()
                ? "Mudir will use the whole file"
                : "Mudir will fill the rest"}
            </p>
            <Button
              variant="danger"
              onClick={generate}
              disabled={!prompt.trim() && !attachment}
              className="hover:scale-[1.02] active:scale-[0.99] transition-transform duration-200 px-4 py-2 text-sm"
            >
              <Send size={14} className="mr-1.5" />
              Make it
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
            {attachment ? "Do this with it" : "Or try"}
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
          <p className="text-sm font-medium text-accent mb-1">Could not generate</p>
          <p className="text-sm text-ink-soft">{error}</p>
          {error.includes("ai_studio") && (
            <p className="text-xs text-muted mt-2">
              Open Dev console (switch role from Account) → Feature flags → flip <span className="text-ink">ai_studio</span> to On.
            </p>
          )}
        </div>
      )}

    </div>
  );
}

// --- helper components -----------------------------------------------------

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

// The kind word inside the Mudir headline, rendered as a tappable mini-card
// that hosts a keyboard-first popover menu. Affordance is the icon + chevron;
// the popover is anchored directly under the pill.
function InlineKindPicker({
  active, pulseKey,
  open, cursor, onOpen, onClose, onPick, onCursor,
}) {
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
        title="Tap to choose what Mudir makes — or press K"
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
          {kindLabel(active.value)}
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
        aria-label="What Mudir makes"
        onClick={(e) => e.stopPropagation()}
        className="studio-menu-rise absolute left-0 top-full mt-2 z-50 w-[26rem] sm:w-[28rem] max-w-[calc(100vw-2rem)] origin-top-left rounded-2xl border border-line bg-paper-cool shadow-xl ring-1 ring-ink/5 overflow-hidden"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted px-4 pt-3.5 pb-2">
          Switch to
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
                  className={`group w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors duration-100 ${
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
                        {kindLabel(k.value)}
                      </span>
                    </span>
                    <span className="block mt-1 text-[11px] text-muted leading-snug truncate">
                      {k.menuBlurb || k.oneliner}
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
            <span className="font-serif italic text-base text-ink-soft">browse</span>
          </span>
          <span className="text-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] text-ink-soft leading-none">↵</kbd>
            <span className="font-serif italic text-base text-ink-soft">pick</span>
          </span>
          <span className="text-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] text-ink-soft leading-none">Esc</kbd>
            <span className="font-serif italic text-base text-ink-soft">close</span>
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
          Mudir is structuring your quiz
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
            Picking subject, grade, marks…
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
        Mudir is drafting the rest — flip through the sidebar to watch each question land.
      </p>
    </div>
  );
}

function LiveQuestionCard({ q, busy }) {
  const inflight = !q.complete && busy;
  const typeLabel = QUIZ_TYPE_LABELS[q.type] || (q.type ? q.type : null);
  const correctLetter =
    typeof q.correct_answer === "string" && q.correct_answer.length === 1
      ? q.correct_answer.toUpperCase()
      : null;
  return (
    <div
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
          writing prompt…
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

// Pre-prompt panel that sits ABOVE the input card. Big, clearly chunked
// settings block with a header so it doesn't read as decoration. Each
// field is a dropdown chip with an icon, an uppercase label, and a value
// area; the chip is sized big enough that an empty state ("Pick a grade")
// is impossible to miss. Every chip is optional — leave any blank and
// the AI infers from the prompt.
function QuizParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section,
    params.difficulty, params.questions, params.duration, params.types,
  ].filter((v) => v !== "" && v != null).length;

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
            Quiz settings
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            Pick the basics first <span className="italic text-muted">— or leave them blank and Mudir will figure it out.</span>
          </p>
        </div>
        {setCount > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent flex-shrink-0">
            {setCount} of 8 set
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label="Grade"
          slot="grade"
          emptyHint="Any grade"
          help="Which year group the quiz is for. The list shows the grades you teach (set in My students → Teaching profile). Type to add a one-off."
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
          warning={CHIP_VALIDATORS.grade(params.grade)}
          onMoveTo={(target) => moveTo("grade", target)}
        />
        <DropdownChip
          icon={BookOpen}
          label="Major"
          slot="major"
          emptyHint="Any major"
          help="The school subject the quiz tests. The list shows the majors you teach (set in My students → Teaching profile). Type to add a one-off."
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
          warning={CHIP_VALIDATORS.major(params.major)}
          onMoveTo={(target) => moveTo("major", target)}
        />
        <DropdownChip
          icon={Globe}
          label="Language"
          slot="language"
          emptyHint="Auto"
          help="The language the quiz will be written in (questions, choices, answer key). The list shows the languages you teach (set in My students → Teaching profile). Type to add a one-off."
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label="Section"
          slot="section"
          emptyHint="All sections"
          help="Which class section(s) the quiz is for. Pick one OR several (Grade 6 A AND B for the same quiz). The list shows the sections you teach (My students → Teaching profile). Type to add a one-off."
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Gauge}
          label="Difficulty"
          slot="difficulty"
          emptyHint="Any level"
          help="How hard the questions should be. Easy = recall + simple application; Medium = grade-appropriate problem solving; Hard = stretches the strongest students."
          value={params.difficulty}
          options={QUIZ_DIFFICULTIES}
          onChange={(v) => set({ difficulty: v })}
          warning={CHIP_VALIDATORS.difficulty(params.difficulty)}
          onMoveTo={(target) => moveTo("difficulty", target)}
        />
        <DropdownChip
          icon={Hash}
          label="Questions"
          slot="questions"
          emptyHint="Any count"
          help="Exact number of questions to produce. This is a hard constraint — Mudir will fit the scope to this count."
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
          label="Duration"
          slot="duration"
          emptyHint="Any length"
          help="How long, in minutes, a student should take to finish. Mudir uses this to calibrate question depth (a 15-min quiz is mostly recall; 60 min allows essay-style)."
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
          label="Types"
          slot="types"
          emptyHint="Mudir picks"
          help="Which question formats Mudir is allowed to use. 'MCQ only' = every question is multiple choice. 'Identification only' = every question is short recall. 'MCQ + Identification' = mix those two. 'Mixed' = anything goes, including True/False."
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
      />
    </div>
  );
}

// Activity settings panel — same shape as QuizParamsPanel (eyebrow,
// chip grid, schedule-for date row) but with activity-specific labels.
// Per the chip rules, no Grade and no Section. Type sits in the slot
// Grade would normally occupy so the grid stays balanced.
function ActivityParamsPanel({ params, onChange, majorOptions, languageOptions }) {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.type, params.major, params.language, params.duration,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">
            Activity settings
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            Pick the basics first <span className="italic text-muted">— or leave them blank and Mudir will figure it out.</span>
          </p>
        </div>
        {setCount > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent flex-shrink-0">
            {setCount} of 4 set
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DropdownChip
          icon={Users}
          label="Type"
          slot="type"
          emptyHint="Mudir picks"
          help="How students work on this activity — solo, in pairs, or in groups."
          value={params.type}
          options={ACTIVITY_TYPES}
          onChange={(v) => set({ type: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label="Major"
          slot="major"
          emptyHint="Any major"
          help="The school subject the activity supports. The list shows the majors you teach (set in My students → Teaching profile). Type to add a one-off."
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label="Language"
          slot="language"
          emptyHint="Auto"
          help="The language the activity instructions will be written in. The list shows the languages you teach (set in My students → Teaching profile). Type to add a one-off."
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Clock}
          label="Duration"
          slot="duration"
          emptyHint="Any length"
          help="How long, in minutes, the activity should run. Mudir uses this to calibrate the depth and number of stages."
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
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section, params.duration,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">Lesson settings</p>
          <p className="font-serif text-base text-ink leading-snug">
            Pick the basics first <span className="italic text-muted">— or leave them blank and Mudir will figure it out.</span>
          </p>
        </div>
        {setCount > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent flex-shrink-0">
            {setCount} of 5 set
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label="Grade"
          slot="grade"
          emptyHint="Any grade"
          help="Which year group this lesson is for. The list shows the grades you teach (set in My students → Teaching profile). Type to add a one-off."
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label="Major"
          slot="major"
          emptyHint="Any major"
          help="The school subject this lesson covers. The list shows the majors you teach (My students → Teaching profile)."
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label="Language"
          slot="language"
          emptyHint="Auto"
          help="The language the lesson plan will be written in."
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label="Section"
          slot="section"
          emptyHint="All sections"
          help="Which class section(s) this lesson is for. Pick one or several. The list shows the sections you teach."
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Clock}
          label="Duration"
          slot="duration"
          emptyHint="Any length"
          help="How long, in minutes, the lesson should run. Mudir uses this to pace the warm-up, main activity, and exit ticket."
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
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">Homework settings</p>
          <p className="font-serif text-base text-ink leading-snug">
            Pick the basics first <span className="italic text-muted">— or leave them blank and Mudir will figure it out.</span>
          </p>
        </div>
        {setCount > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent flex-shrink-0">
            {setCount} of 4 set
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label="Grade"
          slot="grade"
          emptyHint="Any grade"
          help="Which year group this homework is for. The list shows the grades you teach (set in My students → Teaching profile)."
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label="Major"
          slot="major"
          emptyHint="Any major"
          help="The school subject this homework covers. The list shows the majors you teach."
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label="Language"
          slot="language"
          emptyHint="Auto"
          help="The language the homework instructions will be written in."
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label="Section"
          slot="section"
          emptyHint="All sections"
          help="Which class section(s) this homework is for. Pick one or several."
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// Presentation settings — Grade + Major + Language + Section + Slides.
// Schedule-for anchors the deck on the calendar.
function PresentationParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section, params.slides,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">Presentation settings</p>
          <p className="font-serif text-base text-ink leading-snug">
            Pick the basics first <span className="italic text-muted">— or leave them blank and Mudir will figure it out.</span>
          </p>
        </div>
        {setCount > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent flex-shrink-0">
            {setCount} of 5 set
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label="Grade"
          slot="grade"
          emptyHint="Any grade"
          help="Which year group this deck is for. The list shows the grades you teach."
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label="Major"
          slot="major"
          emptyHint="Any major"
          help="The school subject this deck covers. The list shows the majors you teach."
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label="Language"
          slot="language"
          emptyHint="Auto"
          help="The language the slides will be written in."
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label="Section"
          slot="section"
          emptyHint="All sections"
          help="Which class section(s) this deck is for. Pick one or several."
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Hash}
          label="Slides"
          slot="slides"
          emptyHint="Mudir picks"
          help="Roughly how many slides the deck should have. Mudir will fit the scope to this count."
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

function ScheduledDateRow({ value, onChange }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        <Calendar size={11} strokeWidth={1.75} />
        Schedule for
        <HelpTip text="When students should sit this quiz. Saved with the quiz so it shows up in Schedule and Quizzes & Exams. Leave blank to decide later." />
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
          Clear
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onChange(todayISO)}
          className="font-serif italic text-xs text-muted hover:text-accent transition-colors duration-150"
        >
          Today
        </button>
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
  const clearMulti = () => {
    onChange("");
    setDraft("");
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
    : emptyHint || "Pick or type…";

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
                ? currentMulti.length > 0 ? "Add another…" : (emptyHint || "Pick or type…")
                : (emptyHint || "Pick or type…")
            }
            className="w-full bg-transparent outline-none text-sm text-ink leading-tight placeholder:text-muted placeholder:italic placeholder:font-normal"
          />
        </div>
      )}

      {open && (
        <ComboboxMenu
          value={value}
          draft={draft}
          options={filteredOptions}
          allOptions={options}
          suffix={suffix}
          multi={multi}
          currentMulti={currentMulti}
          onPick={commit}
          onToggle={toggleMulti}
          onClear={clearMulti}
          onAddCustom={addCustomMulti}
          onClose={() => (multi ? setOpen(false) : commit(draft))}
        />
      )}
    </span>
  );
}

// Filtered menu that opens under a DropdownChip. Shows three regions:
//   1. "Use \"<draft>\" (custom)" — when the draft text doesn't match
//      any preset; lets the teacher commit (single) or append (multi)
//      a free-form value.
//   2. "Any — let Mudir choose" — clears the field.
//   3. The filtered preset options.
// In multi mode, clicking an option toggles it in the joined value
// without closing the menu; "Done" at the bottom closes.
function ComboboxMenu({
  value, draft, options, allOptions, suffix,
  onPick, onClose,
  multi, currentMulti = [], onToggle, onClear, onAddCustom,
}) {
  const trimmed = String(draft || "").trim();
  const isCustom =
    trimmed.length > 0 &&
    !allOptions.some((o) => String(o).toLowerCase() === trimmed.toLowerCase());
  const isSelected = (opt) =>
    multi
      ? currentMulti.some((x) => String(x).toLowerCase() === String(opt).toLowerCase())
      : String(opt) === String(value);
  const noneSelected = multi ? currentMulti.length === 0 : !value;

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
                    {multi ? "Add " : "Use "}
                    <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
                    <span className="text-muted ml-1.5 text-[11px] italic">custom</span>
                  </span>
                  <Plus size={13} className="text-accent flex-shrink-0" />
                </button>
              </li>
              <li className="border-t border-line/60 my-1" />
            </>
          )}

          <li>
            <button
              type="button"
              onClick={() => multi ? onClear() : onPick("")}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                noneSelected
                  ? "bg-paper-warm text-ink font-medium"
                  : "text-ink-soft hover:bg-paper-warm/60"
              }`}
            >
              <span className="italic">
                {multi ? "Clear all — let Mudir choose" : "Any — let Mudir choose"}
              </span>
              {noneSelected && <Check size={13} className="text-accent" />}
            </button>
          </li>
          <li className="border-t border-line/60 my-1" />

          {options.length === 0 && !isCustom && (
            <li className="px-3 py-2 text-sm text-muted italic">No matches</li>
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
        </ul>
        {multi && (
          <div className="border-t border-line/60 px-2 py-2 flex items-center justify-between gap-2 bg-paper">
            <span className="font-serif italic text-xs text-muted px-1">
              {currentMulti.length === 0
                ? "Click to pick — multiple allowed"
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
    </>
  );
}

// Save-time confirmation. Surfaced only when the teacher edited at least
// one correct_answer pre-save. Lists each changed question (was → now)
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
    ? "Mudir is still generating. Leaving now cancels the draft — nothing is saved to your library."
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
          {busy ? "Mudir is still working" : "Before you go"}
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
  if (!quiz) return null;
  const totalQ = (quiz.questions || []).length;
  // The meta chips (Subject, Grade, Language, Section, Difficulty, Duration)
  // and the scheduled date were all set on the picker view before generation.
  // Re-editing them mid-draft makes no sense (the body wouldn't match) so
  // they render read-only here. Only title and instructions stay editable.
  return (
    <div className="rounded-2xl border border-line bg-paper-cool p-5 md:p-6 studio-card-stagger">
      <p className="font-serif italic text-base text-muted mb-2">Cover</p>
      <EditableText
        value={quiz.title || ""}
        onChange={(v) => onUpdate({ title: v })}
        placeholder="Quiz title"
        disabled={disabled}
        className="font-serif text-2xl md:text-3xl font-medium text-ink leading-tight mb-4 w-full"
      />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-ink-soft mb-5">
        <ReadOnlyMeta label="Subject" value={quiz.subject} />
        <ReadOnlyMeta label="Grade" value={quiz.grade} />
        <ReadOnlyMeta label="Language" value={quiz.language} />
        <ReadOnlyMeta label="Section" value={quiz.section} />
        <ReadOnlyMeta label="Difficulty" value={quiz.difficulty} />
        <ReadOnlyMeta
          label="Duration"
          value={quiz.duration_minutes}
          suffix={quiz.duration_minutes ? "min" : null}
        />
        <ReadOnlyMeta
          label="Scheduled"
          value={quiz.scheduled_for ? formatScheduledDate(quiz.scheduled_for) : null}
        />
        <span className="font-serif italic text-muted">
          · {totalQ} question{totalQ === 1 ? "" : "s"} · <span className="text-ink not-italic font-medium">{quiz.total_marks ?? 0} marks</span>
        </span>
      </div>

      <div>
        <p className="font-serif italic text-base text-muted mb-1.5">Instructions</p>
        <EditableTextarea
          value={quiz.instructions || ""}
          onChange={(v) => onUpdate({ instructions: v })}
          placeholder="Add instructions for students…"
          rows={2}
          disabled={disabled}
          className="text-sm text-ink-soft leading-relaxed w-full"
        />
      </div>
    </div>
  );
}

function QuizQuestionCard({ question, index, onUpdate, disabled = false }) {
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
    <div className="rounded-2xl border border-line bg-paper-cool p-5 md:p-6 studio-card-stagger">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-serif italic text-base text-muted">
          Question {question.position ?? index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full border border-line bg-paper text-[11px] text-ink-soft">
            {typeLabel}
          </span>
          <span className="font-mono text-[11px] text-muted inline-flex items-center gap-1">
            <EditableNumber
              value={question.marks ?? 1}
              onChange={(v) => safeUpdate({ marks: Math.max(1, Number(v) || 1) })}
              min={1}
              disabled={disabled}
              className="w-8 text-right"
            />
            <span>mark{question.marks === 1 ? "" : "s"}</span>
          </span>
        </div>
      </div>

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
                  title={isCorrect ? "This is the correct answer" : "Mark as correct"}
                  className={`flex-shrink-0 h-6 w-6 rounded-md font-mono text-[11px] flex items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed ${
                    isCorrect
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
            { label: "True", value: true },
            { label: "False", value: false },
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
                  isCorrect
                    ? showHighlight
                      ? "border-accent bg-accent/[0.06] text-accent font-medium"
                      : "border-ink bg-paper text-ink font-medium"
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
          className="studio-helptip absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-60 px-3 py-2.5 rounded-lg bg-ink text-paper-cool text-[11px] leading-relaxed shadow-xl pointer-events-none normal-case tracking-normal font-sans font-normal"
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
  return (
    <input
      type="text"
      size={ch}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`bg-transparent outline-none border-b border-transparent hover:border-line/60 focus:border-ink focus:bg-paper transition-colors duration-150 placeholder:text-muted disabled:cursor-not-allowed disabled:hover:border-transparent ${className}`}
    />
  );
}

function EditableTextarea({ value, onChange, placeholder, rows = 2, disabled = false, className = "" }) {
  // Auto-grow to fit content so long question prompts don't get clipped and
  // the teacher never has to drag the resize handle. We measure on each
  // value change by zeroing the height then snapping back to scrollHeight.
  // A min-height (derived from `rows`) keeps short prompts from collapsing.
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`bg-transparent outline-none rounded-md p-2 -m-2 border border-transparent hover:border-line/60 focus:border-ink focus:bg-paper resize-none overflow-hidden transition-colors duration-150 placeholder:text-muted whitespace-pre-wrap disabled:cursor-not-allowed disabled:hover:border-transparent ${className}`}
    />
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
