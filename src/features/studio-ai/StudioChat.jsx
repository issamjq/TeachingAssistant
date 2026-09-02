"use client";

// =====================================================================
// AI Studio — the chat
//
// The shape every teacher already knows: a thread, a composer, and what
// the model made rendered inside the conversation. What replaced a
// six-field wizard whose result landed on a separate screen.
//
// Three things are deliberate:
//
//   The KIND is a control, not a guess. "Make me something about
//   photosynthesis" could be a lesson, a quiz or a deck, and the shape
//   of the answer is the whole difference — so it is picked before
//   sending rather than inferred and got wrong.
//
//   Artifacts are viewers, not markdown. A deck gets slides with
//   prev/next, a quiz gets options with the answer marked, an attached
//   PDF gets a PDF viewer. Printing all three as text would be simpler
//   and would waste what each one is.
//
//   Saving is real TODAY. Generation needs the model key and therefore
//   the API service, but writing to the library goes browser → Supabase,
//   so anything on screen can be kept. When generation is unavailable
//   the studio says exactly that instead of failing quietly.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Paperclip, X, Sparkles, Square, RotateCcw, Save, Check,
  FileText, GraduationCap, ClipboardList, Layers, Puzzle,
  Plus, Trash2, MessageSquare, PanelLeftOpen, X as XIcon,
  MoreHorizontal, Pencil, Pin, PinOff,
} from "lucide-react";
import { api } from "@/views/_shared";
import { useCredits, CreditEstimate, CreditWarning, chargesRead } from "./CreditMeter";
import { MAJORS } from "@/lib/enums";
import { uploadMaterial, MaterialPicker } from "@/features/materials";
import {
  ArtifactCard, QuizViewer, SlideViewer, SlideFullscreen, DocViewer, KIND_META,
  namedSlides,
  slidesFromMarkdown,
  questionsFromMarkdown,
  isHtmlDeck,
  DeckFrame,
  markSchemeFromMarkdown,
} from "./artifacts";
import { RewritableBody } from "./RewritableBody";
import { FinaliseAndSchedule } from "./FinaliseAndSchedule";
// `declined` still reads "you decide" out of an answer in an old ask
// turn. missingFrom/askFor went with the question that used them.
import { declined } from "./missingDetails";
import {
  isRework, isScheduleOnly, targetedKinds, asksToReschedule, namesNewWork, kindsNamedIn,
} from "./revision";
// Only the LIST and the THREAD keep a skeleton: those stand in for rows
// that genuinely exist and are on their way. The document skeleton is
// gone — it drew a shape the real document then did not match.
import { ConversationListSkeleton, ThreadSkeleton } from "./DocumentSkeleton";
import { renderMarkdown } from "@/lib/markdown";
import { SkillsPicker } from "./SkillsPicker";
import { ClassPicker } from "./ClassPicker";
import ClassSignal from "./ClassSignal";
import { classLabel } from "@/shared/lib/classMatch";
import { navigate } from "@/lib/route";
import {
  listSessions, createSession, appendMessage, loadSession, deleteSession,
  renameSession, setPinned, purgeOld, KEEP_DAYS,
} from "./history";
import { useContextPanelSlot } from "@/shared/shell/ContextPanel";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import s from "./Studio.module.css";

const KINDS = [
  { value: "lesson_plan",  label: "Lesson",       icon: FileText },
  { value: "quiz",         label: "Quiz",         icon: GraduationCap },
  { value: "homework",     label: "Homework",     icon: ClipboardList },
  { value: "presentation", label: "Presentation", icon: Layers },
  { value: "activity",     label: "Activity",     icon: Puzzle },
];

const STARTERS = [
  { kind: "lesson_plan",  text: "A 45-minute Grade 7 lesson on photosynthesis, with a hands-on starter and an exit ticket." },
  { kind: "quiz",         text: "Ten questions on linear equations — word problems, not plug-and-chug." },
  { kind: "presentation", text: "An 8-slide intro deck on the water cycle for Grade 4." },
  { kind: "homework",     text: "Reading-comprehension homework on a short story for Grade 6 English." },
];

// The composer grows with its text up to a slice of the viewport, then
// scrolls: enough to read a pasted paragraph or a template dropped in
// from the library, capped so the thread and send bar stay on screen.
const COMPOSER_MAX_VH = 0.45; // up to 45% of the window height…
const COMPOSER_MAX_H = 520;   // …but never taller than this

/** Pull a usable title out of whatever came back. */
/**
 * One shape for the structured half of a generation, whatever arrived.
 *
 * The viewers look for `.slides` and `.questions` at the top level. A
 * deck that arrives as a bare array, or wrapped as `{quiz:{questions}}`,
 * renders as nothing at all unless it is flattened first — which is
 * exactly how every generated deck once fell through to plain markdown.
 */
/**
 * One question, whatever the model decided to call its fields.
 *
 * The schema asks for `prompt`, `choices` and `correct_answer`; answers have
 * come back as `question`, `question_text`, `options` and `answer` — the same
 * paper described in four vocabularies, none of which the viewer or the quiz
 * builder read. A quiz then rendered as a column of question numbers with no
 * questions in it, and saved to the library in that state.
 *
 * A list of aliases is never finished, so it is applied in ONE place, on the
 * way in, and everything downstream — the chat viewer, the builder, the row
 * in the database — sees a single shape.
 */
function normaliseQuestion(q, i) {
  if (!q || typeof q !== "object") return null;
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  const prompt =
    str(q.prompt) || str(q.question) || str(q.question_text) || str(q.text) || str(q.stem);
  if (!prompt) return null;

  const choices = [q.choices, q.options, q.answers, q.alternatives].find(Array.isArray);
  const answer = str(q.correct_answer) || str(q.answer) || str(q.correct) || str(q.correct_option);

  return {
    ...q,
    position: typeof q.position === "number" ? q.position : i + 1,
    prompt,
    ...(choices ? { choices } : {}),
    ...(answer ? { correct_answer: answer } : {}),
  };
}

function normaliseArtifact(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) return { slides: raw };
  if (raw.quiz) return normaliseArtifact(raw.quiz);
  if (raw.content && typeof raw.content === "object") return normaliseArtifact(raw.content);
  if (Array.isArray(raw.questions)) {
    const questions = raw.questions.map(normaliseQuestion).filter(Boolean);
    // No readable question is not a quiz. Dropping the structured form lets
    // the markdown — which is complete — be what she reads and what is saved.
    return questions.length ? { ...raw, questions } : null;
  }
  if (raw.slides) return raw;
  return null;
}

/**
 * What can take a slot on the timetable, and what to call it.
 *
 * A teaching guide and student notes belong to a lesson and are reached
 * through it, so they never take a slot of their own — but a batch that
 * contains them is still a lesson, and the lesson is what gets finalised.
 */
const SCHEDULABLE_KINDS = ["lesson_plan", "quiz", "homework", "presentation", "activity"];

/**
 * Failures a second press cannot fix.
 *
 * The Retry chip is a promise that trying again might work. For a daily
 * cap, an empty balance or a file that is not hers, it cannot — and
 * offering it sends a teacher round a loop that spends her attention and
 * changes nothing. The service names these; anything unrecognised keeps
 * the chip, because an unknown failure is usually transient.
 */
const NO_RETRY_CODES = new Set([
  "quota_exhausted",
  "insufficient_credits",
  "material_not_found",
  "material_has_no_file",
  "NO_AI_KEY",
  "no_backend",
]);

/** Where each kind is stored — see the note above storeBatch. */
const PATH_FOR_KIND = {
  lesson_plan: "/api/drafts",
  teaching_guide: "/api/teaching-guides",
  student_notes: "/api/student-notes",
  quiz: "/api/quizzes",
  homework: "/api/homework",
  presentation: "/api/presentations",
  activity: "/api/activities",
};

/**
 * Did the batch land anyway? The Goals screen learned this the hard
 * way: the proxy cuts long requests at thirty seconds while the
 * service is still writing, and the service writes its result BEFORE
 * replying — so the row is already correct when the browser gives up.
 * Poll the library for rows carrying this batch id; a minute is long
 * enough to catch a finish and short enough that a real failure is
 * still reported while she is watching. Null when nothing landed —
 * on a service that never saves server-side this simply finds
 * nothing, and the ordinary error (with its Retry) follows.
 */
async function recoverBatch(batchIdVal, kindsGuess, signal) {
  if (!batchIdVal) return null;
  const paths = [
    ...new Set((kindsGuess?.length ? kindsGuess : SCHEDULABLE_KINDS).map(
      (k) => PATH_FOR_KIND[k] || "/api/drafts",
    )),
  ];
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    // Stop has to reach in here. Without it `busy` stayed true for the
    // whole minute and the button did nothing — the teacher watched a
    // poll she had already asked to end.
    if (signal?.aborted) return null;
    await new Promise((r) => setTimeout(r, 5_000));
    if (signal?.aborted) return null;
    try {
      const lists = await Promise.all(paths.map((p) => api(p).catch(() => [])));
      const rows = lists
        .flat()
        .filter((r) => r && String(r.batch_id || "") === String(batchIdVal));
      if (rows.length) return rows;
    } catch {
      /* the service is busy writing; ask again */
    }
  }
  return null;
}

/**
 * The order a lesson's documents are read in.
 *
 * A partial edit regenerates one of them, so the parts arrive out of order and
 * the merged library copy came back with the notes above the plan. This is the
 * same order the generator emits them in.
 */
const DOC_ORDER = ["lesson_plan", "teaching_guide", "student_notes"];
/**
 * What the section holding each kind is called.
 *
 * Adding an "s" to the noun is how "quiz" became "Quizs" in a confirmation
 * line and "Open quizs" on a button. English plurals are not a rule you can
 * derive from three examples, and these are the only five that exist.
 */
const SECTION_FOR_KIND = {
  lesson_plan: "Lessons",
  quiz: "Quizzes",
  homework: "Homework",
  presentation: "Presentations",
  activity: "Activities",
};

const NOUN_FOR_KIND = {
  lesson_plan: "lesson",
  quiz: "quiz",
  homework: "homework",
  presentation: "presentation",
  activity: "activity",
};

/**
 * The facts a generated document states about itself.
 *
 * Every kind opens with a title and then one line of values separated by
 * "·" — "Butterfly · Grade 4 · 45 minutes · Unit 3". The library cards read
 * subject, grade and duration off the stored row, and nothing ever wrote
 * them, so a saved lesson arrived in its section as a title above a row of
 * dashes and she could not tell one from another.
 *
 * Read here rather than asked of a model: the line is already written, and
 * parsing it is exact and free. The subject is only taken when the segment
 * is a subject we know — a lesson plan often leads with its topic
 * ("Butterfly"), and recording that as the subject would be worse than
 * leaving it blank for the scheduler to fill in properly.
 */
function statedFacts(text) {
  const line = (text || "")
    .split(/\r?\n/)
    .slice(0, 8)
    .find((l) => l.includes("·") && !/^#/.test(l));
  if (!line) return {};

  const parts = line.replace(/\*\*/g, "").split("·").map((p) => p.trim()).filter(Boolean);
  const out = {};

  for (const part of parts) {
    const grade = part.match(/^grade\s+(.+)$/i);
    if (grade) { out.grade = grade[1].trim(); continue; }
    const mins = part.match(/^(\d{1,3})\s*min/i);
    if (mins) { out.duration_minutes = Number(mins[1]); out.duration = Number(mins[1]); continue; }
    if (!out.subject && KNOWN_SUBJECTS.has(part.toLowerCase())) out.subject = part;
  }
  return out;
}

const KNOWN_SUBJECTS = new Set(MAJORS.map((m) => m.toLowerCase()));

/**
 * The class a batch is for, best answer first: the teacher's own pick
 * (carried on the turn), then the service's `scope` frame — its own
 * decision, streamed with every generation and never rendered until
 * now — then the title-line scrape. Null when nothing names one.
 */
function plannedAudienceOf(batchTurns) {
  const picked = batchTurns.find((t) => t.audience)?.audience;
  if (picked) return picked;
  const sc = batchTurns.find((t) => t.scope)?.scope;
  if (sc && (sc.grade || sc.subject)) {
    return { grade: sc.grade || "", subject: sc.subject || "", section: sc.section || sc.class || "" };
  }
  const head = batchTurns.find((t) => SCHEDULABLE_KINDS.includes(t.kind)) || batchTurns[0];
  const facts = head ? statedFacts(head.text) : {};
  return facts.grade || facts.subject
    ? { grade: facts.grade || "", subject: facts.subject || "", section: "" }
    : null;
}

/**
 * Should this turn carry the finalise offer, and over which documents?
 *
 * Returns null unless `turn` is the LAST finished assistant turn of its
 * batch AND that batch contains something schedulable. A batch is whatever
 * one request produced: three documents for a lesson, one for a quiz, and
 * whatever a rework happened to regenerate.
 *
 * Turns restored from history have no batch id, so they fall back to standing
 * alone — an old thread still offers to finalise the document she is looking
 * at rather than silently offering nothing.
 */
function batchOffer(turns, turn, index) {
  /**
   * A generation she has not kept is still hers to keep.
   *
   * Reopening a thread used to withdraw every save button in it, on the
   * reasoning that history is a record rather than an open decision. In
   * practice that lost work: generate a lesson, click into another
   * conversation, come back — and the only way to file it was to generate it
   * again, paying for it twice.
   *
   * What made that rule necessary was not knowing whether a restored batch
   * had already been saved. openSession() now asks the library, so the
   * question is answered properly and the offer can turn on the real
   * condition: kept or not kept.
   */
  if (turn.saved) return null;
  const inBatch = turn.batchId
    ? turns.filter((x) => x.role === "assistant" && x.batchId === turn.batchId)
    : [turn];

  /**
   * Not until the whole batch has landed.
   *
   * A lesson streams as three documents one after another. Offering as soon
   * as the FIRST one finished put the button under the lesson plan while the
   * guide and the notes were still arriving — it then jumped down the thread
   * as each one completed, and pressing it early would have kept a third of
   * a lesson.
   */
  if (inBatch.some((x) => !x.done)) return null;

  // Under the last document of the batch, which is where she finishes reading.
  if (turns.indexOf(inBatch[inBatch.length - 1]) !== index) return null;

  /**
   * Every generation carries its own offer.
   *
   * This used to allow only the newest, so that reworking without saving
   * first could not leave two buttons in the thread. But a thread is often
   * several separate pieces of work — a lesson, then a quiz on another
   * topic, then an activity — and hiding the earlier ones meant the only
   * one she could file was the last thing she happened to ask for.
   *
   * One button per BATCH, not per document: a lesson is a plan and a set of
   * notes and it is filed once. Pressing one saves that generation and
   * nothing else; the others keep their own buttons until they are kept
   * too.
   */

  /**
   * Nothing is offered while anything is still arriving.
   *
   * Without this the previous batch keeps its button through the whole of the
   * next generation — the one moment it is certainly not what she wants to
   * keep — and it disappears from under her the instant the new documents
   * land. Buttons that move while she is reaching for them are worse than
   * buttons that wait.
   */
  if (turns.some((x) => x.streaming)) return null;

  /**
   * A partial edit is still a lesson.
   *
   * Reworking only the student notes produces a batch with nothing schedulable
   * in it, and the offer disappeared entirely — she was left with a rewritten
   * document and no way to keep it. The parts that were deliberately left
   * alone count towards what this batch adds up to.
   */
  const carried = inBatch.find((x) => x.carryOver)?.carryOver || [];
  const present = [...inBatch.map((x) => x.kind), ...carried.map((c) => c.kind)];
  const primaryKind = SCHEDULABLE_KINDS.find((k) => present.includes(k));
  if (!primaryKind) return null;

  return {
    turns: inBatch,
    primaryKind,
    label: NOUN_FOR_KIND[primaryKind] || "work",
    section: SECTION_FOR_KIND[primaryKind] || "your library",
  };
}

/** Is this document covered by a batch offer somewhere in the thread? */
function inBatchOffer(turns, turn) {
  if (!turn.batchId) return false;
  // Deliberately not waiting for `done`: a Save that appears on each document
  // as it streams and then vanishes when the batch finishes is three buttons
  // she was never meant to press.
  const inBatch = turns.filter((x) => x.role === "assistant" && x.batchId === turn.batchId);
  return inBatch.length > 0 && SCHEDULABLE_KINDS.some((k) => inBatch.some((x) => x.kind === k));
}

/**
 * A heading as a name, with the markdown taken off.
 *
 * Generators emphasise their own titles — "## **Fraction Bazaar**" — and the
 * stars went into the library as part of the name, so a card was filed under
 * `**Fraction Bazaar**` and sorted under an asterisk.
 */
function cleanTitle(raw) {
  return String(raw || "")
    .replace(/\*\*/g, "")
    .replace(/[*_`]/g, "")
    .replace(/[\s—–-]+$/, "")
    .trim();
}

/**
 * The studio is working.
 *
 * Eight circles going round, unequal in size, each swelling a beat after
 * the one before it. No words: "Writing the quiz" was a sentence a
 * teacher read once and then had to keep reading for the rest of the
 * wait, and it told her nothing the spinner does not.
 *
 * The sizes and the colours are listed rather than computed — the whole
 * point is that they are UNEVEN, and an even ring reads as a machine
 * part rather than as something alive.
 */
const SPIN_DOTS = [
  { a: "0deg",   size: 5,   c: "var(--p-accent)",  d: "0s" },
  { a: "45deg",  size: 7,   c: "var(--p-accent)",  d: "-0.2s" },
  { a: "90deg",  size: 4,   c: "var(--p-accent)",  d: "-0.4s" },
  { a: "135deg", size: 8,   c: "#4a7fe0",          d: "-0.6s" },
  { a: "180deg", size: 5.5, c: "#4a7fe0",          d: "-0.8s" },
  { a: "225deg", size: 7,   c: "#4a7fe0",          d: "-1.0s" },
  { a: "270deg", size: 4.5, c: "var(--p-accent)",  d: "-1.2s" },
  { a: "315deg", size: 6,   c: "var(--p-accent)",  d: "-1.4s" },
];

function Working({ label }) {
  return (
    <div className={s.spinner} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {SPIN_DOTS.map((dot, i) => (
        <span
          key={i}
          className={s.spinnerDot}
          style={{
            "--a": dot.a,
            "--d": dot.d,
            width: dot.size,
            height: dot.size,
            marginTop: -dot.size / 2,
            marginLeft: -dot.size / 2,
            background: dot.c,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Which studio the composer talks to.
 *
 * `true` is the agent: one model reads the conversation and decides
 * whether the turn wants an answer, a question or a document, then calls
 * a tool that writes one. `false` is the original pipeline, where this
 * component decided the kind from a row of toggles and the route always
 * generated — which is why "hello" used to produce a lesson plan.
 *
 * Both backends are mounted, so this is a one-character rollback rather
 * than a revert.
 */
/**
 * A steady reveal, decoupled from how the network delivered the text.
 *
 * The model's tokens do not arrive evenly. Anthropic sends them in
 * bursts — a few characters, then nothing for 300ms, then two hundred at
 * once — and writing each burst straight into the DOM reproduces that
 * unevenness exactly: the document lurches. Gemini looks smooth not
 * because its stream is smooth but because the page paces the reveal
 * itself, and that is the whole of the difference.
 *
 * So arriving text goes into a buffer, and a frame loop walks the
 * visible end towards it. The step is proportional to how far behind it
 * is, which self-corrects: a long burst is caught up quickly without a
 * jump, and a trickle is revealed gently rather than one character every
 * few frames. It can never overtake what has actually arrived, so
 * nothing is ever invented — only delayed, by at most a few frames.
 */
function makeReveal(onFrame) {
  let target = "";
  let shown = 0;
  let raf = null;
  let ended = false;

  const tick = () => {
    raf = null;
    const behind = target.length - shown;
    if (behind > 0) {
      // A sixth of the backlog per frame: ~60fps means a burst is
      // absorbed in a handful of frames, which reads as fast rather
      // than as a jump.
      shown = Math.min(target.length, shown + Math.max(2, Math.ceil(behind / 6)));
      onFrame(target.slice(0, shown));
    }
    if (shown < target.length) raf = requestAnimationFrame(tick);
    else if (ended) onFrame(target);
  };

  return {
    push(text) {
      target += text;
      if (raf == null) raf = requestAnimationFrame(tick);
    },
    /** Let the remainder catch up, then settle on the complete text. */
    end() {
      ended = true;
      if (raf == null && shown < target.length) raf = requestAnimationFrame(tick);
      else if (shown >= target.length) onFrame(target);
    },
    /** Abandon the animation and show everything that arrived. */
    flush() {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      shown = target.length;
      onFrame(target);
    },
    get text() {
      return target;
    },
  };
}

const USE_AGENT = true;

/**
 * The slide list, before a deck exists.
 *
 * A deck is the longest thing the studio writes and the most expensive
 * thing to get wrong, and what is usually wrong with it is which ideas
 * got a slide at all. That is visible here in ten seconds and only in
 * two minutes from the finished deck — so it is shown first, she edits
 * it, and nothing is drawn until she presses Generate.
 *
 * Editing is deliberately small: strike a slide, add one, retitle one.
 * A full slide editor here would be a second product, and the thing she
 * actually needs is to remove the two slides that do not belong and add
 * the one that does.
 */
function OutlinePlan({ turn, busy, onGenerate }) {
  const [slides, setSlides] = useState(turn.slides || []);
  const [sent, setSent] = useState(false);

  const drop = (at) => setSlides((v) => v.filter((_, i) => i !== at));
  const rename = (at, title) =>
    setSlides((v) => v.map((x, i) => (i === at ? { ...x, title } : x)));
  const add = () =>
    setSlides((v) => [...v, { title: "", description: "", layout: "split" }]);

  const usable = slides.filter((x) => (x.title || "").trim());

  return (
    <div className={s.outline}>
      <div className={s.outlineHead}>
        <span className={s.outlineKicker}>Outline</span>
        <h4 className={s.outlineTitle}>{turn.title}</h4>
        <p className={s.outlineMeta}>
          {[turn.subject, turn.grade, `${usable.length} slides`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <ol className={s.outlineList}>
        {slides.map((slide, i) => (
          <li key={i} className={s.outlineItem} style={{ "--i": i }}>
            <span className={s.outlineNum}>{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <input
                className={s.outlineName}
                value={slide.title}
                placeholder="What is this slide called?"
                aria-label={`Slide ${i + 1} title`}
                onChange={(e) => rename(i, e.target.value)}
                disabled={sent}
              />
              {slide.description ? (
                <p className={s.outlineDesc}>{slide.description}</p>
              ) : null}
            </div>
            {!sent && (
              <button
                type="button"
                className={s.outlineDrop}
                onClick={() => drop(i)}
                aria-label={`Remove slide ${i + 1}`}
              >
                <XIcon size={13} />
              </button>
            )}
          </li>
        ))}
      </ol>

      {!sent && (
        <div className={s.outlineBar}>
          <button type="button" className={s.chipBtn} onClick={add}>
            <Plus size={13} /> Add slide
          </button>
          <button
            type="button"
            className={s.chipBtn}
            data-primary
            disabled={busy || usable.length < 2}
            onClick={() => {
              setSent(true);
              onGenerate(usable);
            }}
          >
            <Sparkles size={13} /> Generate the deck
          </button>
        </div>
      )}
    </div>
  );
}

function titleOf(kind, text, structured) {
  if (structured?.title) return cleanTitle(structured.title);
  const heading = (text || "").split(/\r?\n/).find((l) => /^#{1,3}\s+/.test(l));
  if (heading) {
    /**
     * The name, not the whole header line.
     *
     * A quiz opens with "Cyber Security · Grade 10 · 15 marks · 45 minutes",
     * and taking the heading whole put that entire string on the library card
     * where a title goes — beside a card already showing the grade, the marks
     * and the duration in its own fields. The part before the first "·" is
     * what the thing is called; the rest is the metadata the card reads off
     * the row.
     */
    return cleanTitle(heading.replace(/^#+\s*/, "").split("·")[0]);
  }
  const first = cleanTitle((text || "").trim().split(/\r?\n/)[0]);
  return first?.slice(0, 80) || KIND_META[kind]?.label || "Untitled";
}

export default function StudioChat({ initialKind = "lesson_plan" }) {
  const [turns, setTurns] = useState([]);

  const [draft, setDraft] = useState("");
  // Multi-select: one prompt can come back as a lesson AND its quiz AND
  // the homework — the service plans the batch and streams each artifact
  // in canonical order. At least one kind stays on; the last one refuses
  // to toggle off rather than leaving the send button aimed at nothing.
  const [kinds, setKinds] = useState([initialKind]);
  /**
   * What she has and what things cost.
   *
   * Refreshed after every generation rather than polled: the balance only
   * moves when she spends, and a number that lags behind her own action
   * is the one thing worse than no number at all.
   */
  const { credits, refresh: refreshCredits } = useCredits();
  /**
   * Has she TOUCHED the kind row, or is it just sitting where it loaded?
   *
   * The distinction is the whole reason the row can be trusted. It resets to
   * "Lesson" on every page load, so obeying it blindly turned "give question 9
   * more marks" on a reopened quiz into a lesson plan. But a row she has just
   * clicked is the clearest statement of intent in the composer, and ignoring
   * THAT is how "now a homework for the same topic", typed with Homework lit
   * and nothing else, came back as the lesson, the notes and the quiz again.
   *
   * Cleared after every send: the next message is a follow-up to what was
   * just written unless she says otherwise.
   */
  const kindsTouched = useRef(false);
  const toggleKind = (v) =>
    setKinds((prev) => {
      kindsTouched.current = true;
      if (prev.includes(v)) return prev.length > 1 ? prev.filter((x) => x !== v) : prev;
      const on = new Set([...prev, v]);
      return KINDS.map((k) => k.value).filter((x) => on.has(x)); // canonical order
    });
  // Which skill profiles ground generation. The picker reports here;
  // send() reads it. Saving a new approach bumps the version so the
  // picker refetches and the new skill appears selected.
  const skillSel = useRef(null);
  /**
   * The class this generation is for — the teacher's pick from her real
   * roster classes, or null when Murchid reads the brief alone. Read at
   * send time; the pick travels on the TURN (finalizeTurn) so a save
   * made later still files under the class the work was written for.
   */
  const classSel = useRef(null);
  const goalDayRef = useRef(null);
  // A ref carries the pick into send(); this mirrors it so the signal
  // above the composer can re-render when she changes class.
  const [pickedClass, setPickedClass] = useState(null);
  // Nothing on this screen writes a skill any more, so there is nothing
  // to tell the picker to refetch for. Kept as a constant so the picker's
  // contract is unchanged for the places that still bump it.
  const skillsVersion = 0;
  const [busy, setBusy] = useState(false);
  /**
   * Files she has attached but not yet sent.
   *
   * These lived only in component state, so a reload — or following a link
   * and coming back — dropped them. The upload itself had already happened
   * and the row was sitting in `materials`; only the studio had forgotten,
   * which reads as the upload having failed. They are kept where a refresh
   * cannot reach, and cleared the moment the message that carries them is
   * sent.
   */
  const ATTACH_KEY = "murchid.studio.pendingAttachments";
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ATTACH_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) setAttachments(saved);
    } catch {
      /* nothing worth reporting: an unreadable list is an empty one */
    }
  }, []);

  useEffect(() => {
    try {
      if (attachments.length) localStorage.setItem(ATTACH_KEY, JSON.stringify(attachments));
      else localStorage.removeItem(ATTACH_KEY);
    } catch {
      /* a full or blocked store must not stop her attaching a file */
    }
  }, [attachments]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [presenting, setPresenting] = useState(null);
  /** What she is typing into an unanswered "before I write it" question. */
  const [askDraft, setAskDraft] = useState({});
  /**
   * The last batch she kept in this conversation.
   *
   * What makes "make it grade 5" update the lesson she already saved instead
   * of filing a second, near-identical card beside it.
   */
  const [lastKept, setLastKept] = useState(null);
  /** The last request actually generated in this thread. */
  const lastPrompt = useRef("");
  /**
   * The primary document of the last generation, kept so a rework can be told
   * what it is reworking.
   */
  const lastDoc = useRef(null);
  /**
   * Every document of the last complete generation, by kind.
   *
   * A lesson is three documents and a teacher usually wants one of them
   * changed — clearer notes, a stronger guide — not all three rewritten. To
   * regenerate one and still save a whole lesson, the other two have to be
   * held somewhere; this is where. Filled while generating and again when a
   * thread is reopened, so an old conversation supports the same edit.
   */
  const lastBatch = useRef(null);
  /**
   * The row waiting for a new slot, while the scheduler's question is on
   * screen. Cleared the moment it is booked or the thread moves on.
   */
  const awaitingSlot = useRef(null);

  // ── conversation history ───────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  // Desktop history lives in the shell's context panel — the second left
  // column — so its open/closed state and its width are the shell's, not
  // this screen's. What stays local is the phone drawer, which the shell
  // has no equivalent of.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  /** Which row's ⋯ menu is open, and which row is being renamed in place. */
  const [menuFor, setMenuFor] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  /** The conversation waiting on a yes before it is deleted. */
  const [confirmDelete, setConfirmDelete] = useState(null);
  // The id the CURRENT send belongs to. State would be a render behind:
  // a thread is created and its first two turns saved inside one call,
  // and setSessionId has not committed by the time they are written.
  const sessionRef = useRef(null);

  // Distinct from `sessions.length === 0`: an empty array is both "she has
  // none" and "the query has not answered", and showing the empty copy for
  // the second one tells a teacher with twenty conversations that she has
  // nothing. Only the FIRST load shows a skeleton — a background refresh
  // after saving or deleting must not blank a list she is reading.
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const refreshSessions = useCallback(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    refreshSessions();
    purgeOld();
  }, [refreshSessions]);

  /**
   * The ⋯ menu closes on the next click anywhere, and on Escape.
   *
   * Listening on the document rather than on a backdrop element: a
   * backdrop would have to sit over the rail, and then the click that
   * dismisses the menu could not also be the click that opens another
   * row — which is what anyone with three menus in a list actually does.
   */
  useEffect(() => {
    if (!confirmDelete) return;
    const key = (e) => { if (e.key === "Escape") setConfirmDelete(null); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [confirmDelete]);

  useEffect(() => {
    if (!menuFor) return;
    const away = () => setMenuFor(null);
    const key = (e) => { if (e.key === "Escape") setMenuFor(null); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", key);
    };
  }, [menuFor]);

  // Grow the composer with what's in it, then scroll. The ceiling is a
  // slice of the viewport (not a fixed 240px) so a small paragraph takes
  // a few lines while a whole template dropped in from the library — or a
  // big paste — opens tall enough to actually read, capped so the thread
  // and send bar are never pushed off screen.
  const autosize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const max = Math.min(window.innerHeight * COMPOSER_MAX_VH, COMPOSER_MAX_H);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  // Driven off `draft` rather than the keystroke so it's right for every
  // way the text arrives — typing, a starter chip, an assistant or
  // template hand-off, a paste, and the shrink back after a send.
  useEffect(() => { autosize(); }, [draft, autosize]);
  // Keep the ceiling honest when the window is resized.
  useEffect(() => {
    window.addEventListener("resize", autosize);
    return () => window.removeEventListener("resize", autosize);
  }, [autosize]);

  // A "make me a …" hand-off: seed the composer with the payload so the
  // teacher lands mid-thought rather than at a blank box.
  //
  // Whether it also RUNS depends on who is handing over. The assistant
  // proposes — "shall I make you a quiz on this?" — and a proposal has
  // to be agreed to, so its payload arrives without `autostart` and
  // waits at the send button. The dashboard's composer is the teacher's
  // own sentence, typed by her and sent by her; making her press send
  // again on arrival would be asking her to confirm something she
  // already said.
  useEffect(() => {
    import("@/shared/lib/assistantPrefill").then(({ takePrefill }) => {
      const pre = takePrefill("create_work");
      if (!pre) return;
      const text = [pre.prompt, pre.topic, pre.title, pre.description]
        .find((v) => typeof v === "string" && v.trim());
      const kind = typeof pre.kind === "string" && KIND_META[pre.kind] ? pre.kind : null;
      // A day of a placed term. Carried through the send so the service
      // can mark that day drafted; it survives exactly one generation,
      // because the second lesson she writes is not that Tuesday.
      if (typeof pre.goal_day_id === "string") goalDayRef.current = pre.goal_day_id;
      if (text) setDraft(String(text).trim());
      if (kind) setKinds([kind]);
      // send() takes the text as an argument rather than reading `draft`,
      // which has not committed yet on this tick.
      if (pre.autostart && text) send(String(text).trim(), kind || undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A narrow window opens with the rail closed: the studio is already
  // tight there, and a list of last week's work is not what a teacher
  // came for.
  // Nothing to do on mount any more. The panel's width is the shell's
  // business and it persists the teacher's choice across sections; the
  // phone drawer starts closed. What used to live here force-closed the
  // rail below 1100px on every visit, overriding that choice.

  const openSession = async (id) => {
    if (id === sessionId) return;
    setLoadingThread(true);
    try {
      const turns_ = await loadSession(id);
      /**
       * An approach is taken from a conversation, not from a turn.
       *
       * The offer used to hang on `saved`, which only exists for a document
       * kept in the current page — so closing the chat took the offer with it
       * and a teacher could never come back to a thread and keep the method
       * from it. It stands until it is taken, and what marks it taken is a
       * skill recorded against this session.
       */

      /**
       * Which generations in this thread were already kept.
       *
       * Reopening a conversation used to remove every save button in it —
       * `restored` turns were treated as read-only on the grounds that a
       * restored turn "cannot know whether it was ever kept". It can: the
       * library row carries the same batch id the transcript does, which is
       * what savedForBatch() reads. So a teacher who generated a lesson,
       * navigated away and came back had no way to file it at all, and the
       * work was only recoverable by generating it again.
       *
       * Asked once per batch on open, not per turn — a lesson is two turns
       * and a full batch four.
       */
      const batchIds = [...new Set(
        turns_.filter((t) => t.role === "assistant" && t.batchId).map((t) => t.batchId),
      )];
      const keptBatches = new Set(
        (await Promise.all(
          batchIds.map((b) =>
            // `drafts` is the route root for ai_studio; savedForBatch matches on
            // batch_id alone, so it answers for a batch of any kind.
            api(`/api/drafts/saved-for-batch/${b}`)
              .then((r) => (r ? b : null))
              .catch(() => null),
          ),
        )).filter(Boolean),
      );

      setSessionId(id);
      sessionRef.current = id;
      setTurns(
        turns_.map((t) => ({
          ...t,
          // Already in her library: show it as kept, not as offerable.
          ...(t.batchId && keptBatches.has(t.batchId) ? { saved: true } : {}),
        })),
      );
      setNotice(null);
      setDrawerOpen(false);

      /**
       * Reconnect the thread to the card it already produced.
       *
       * A teacher opens yesterday's conversation and asks for a change. The
       * component's memory of what it saved died with the page, so the rework
       * would have been filed as a brand-new lesson beside the one she is
       * looking at. The batch id survives on both sides, so the link is
       * simply looked up again.
       */
      /**
       * The document a later rework will be reworking.
       *
       * Only ever set while generating, so a reopened thread had none — and a
       * rework then went to the model carrying nothing but "add a hands-on
       * activity". With no topic in the request it invented one, and a
       * conversation about the solar system came back as cellular
       * respiration. Restored from the transcript for the same reason it is
       * kept live.
       */
      const lastPrimary = [...turns_]
        .reverse()
        .find((t) => t.role === "assistant" && SCHEDULABLE_KINDS.includes(t.kind));
      lastDoc.current = lastPrimary
        ? { title: titleOf(lastPrimary.kind, lastPrimary.text, lastPrimary.structured), text: lastPrimary.text }
        : null;

      lastPrompt.current = [...turns_].reverse().find((t) => t.role === "user")?.text || "";

      /**
       * The newest version of each document in the thread.
       *
       * Walked newest-first so a part she already reworked wins over the
       * original it replaced — otherwise reworking the notes twice would save
       * the second set of notes beside the FIRST guide and plan.
       */
      lastBatch.current = null;
      // A reopened thread is not mid-question.
      awaitingSlot.current = null;
      for (const t of [...turns_].reverse()) {
        if (t.role !== "assistant" || !t.kind || !t.text) continue;
        lastBatch.current = lastBatch.current || {};
        if (!lastBatch.current[t.kind]) {
          lastBatch.current[t.kind] = { kind: t.kind, text: t.text, structured: t.structured ?? null };
        }
      }

      /**
       * Try every batch in the thread, newest first.
       *
       * Only one of them owns the library card: a rework moves the rows onto
       * its own batch, and an abandoned generation leaves a batch behind that
       * was never kept. Asking only about the newest found nothing whenever
       * the last thing she did was regenerate without saving — and the thread
       * then behaved as if it had never produced a lesson at all.
       */
      const batches = [
        ...new Set([...turns_].reverse().map((t) => t.batchId).filter(Boolean)),
      ];
      setLastKept(null);
      (async () => {
        for (const b of batches) {
          try {
            const found = await api(`/api/drafts/saved-for-batch/${b}`);
            if (found) return setLastKept(found);
          } catch {
            /* try the next one */
          }
        }
      })();
    } catch (e) {
      setNotice(`Couldn't open that conversation: ${e.message}`);
    } finally {
      setLoadingThread(false);
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setSessionId(null);
    sessionRef.current = null;
    setTurns([]);
    setDraft("");
    setAttachments([]);
    setNotice(null);
    setDrawerOpen(false);
    lastBatch.current = null;
    lastDoc.current = null;
    lastPrompt.current = "";
    awaitingSlot.current = null;
    setLastKept(null);
  };

  /**
   * The rail's own order, applied locally.
   *
   * Pinning has to move the row NOW — a pin that only takes effect on the
   * next load is a pin the teacher does not believe worked. Same two keys
   * the query uses, so the optimistic order and the fetched one agree.
   */
  const sortSessions = (list) =>
    [...list].sort((a, b) => {
      if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
      if (a.pinned_at && b.pinned_at) return b.pinned_at.localeCompare(a.pinned_at);
      return String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));
    });

  const togglePin = async (x) => {
    setMenuFor(null);
    const pinned_at = x.pinned_at ? null : new Date().toISOString();
    const prev = sessions;
    setSessions((list) =>
      sortSessions(list.map((y) => (y.session_id === x.session_id ? { ...y, pinned_at } : y))),
    );
    try {
      await setPinned(x.session_id, !!pinned_at);
    } catch (err) {
      setSessions(prev);
      setNotice(`Couldn't ${pinned_at ? "pin" : "unpin"} that: ${err.message}`);
    }
  };

  const startRename = (x) => {
    setMenuFor(null);
    setRenameDraft(x.title || "");
    setRenamingId(x.session_id);
  };

  const commitRename = async (id) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    const row = sessions.find((y) => y.session_id === id);
    // Nothing typed, or nothing changed: not a failure, just not an edit.
    if (!name || name === (row?.title || "")) return;
    const prev = sessions;
    setSessions((list) => list.map((y) => (y.session_id === id ? { ...y, title: name } : y)));
    try {
      await renameSession(id, name);
    } catch (err) {
      setSessions(prev);
      setNotice(`Couldn't rename that: ${err.message}`);
    }
  };

  /** Runs only after the dialog has been answered. */
  const removeSession = async (id) => {
    setMenuFor(null);
    const prev = sessions;
    setSessions((x) => x.filter((y) => y.session_id !== id));
    if (id === sessionId) newChat();
    try {
      await deleteSession(id);
    } catch (err) {
      setSessions(prev);                       // the delete failed; put it back
      setNotice(`Couldn't delete that: ${err.message}`);
    }
  };

  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  /** A written deck shown full screen, as its own document. */
  const [presentingHtml, setPresentingHtml] = useState(null);
  const abortRef = useRef(null);
  /** Distinguishes one agent turn's ids from the next one's. */
  const runSeq = useRef(0);
  /** Finished documents, read back outside the updater that closed them. */
  const finishedDocs = useRef(new Map());
  /**
   * The palette the agent chose when it planned the deck.
   *
   * It picks the colour in plan_presentation — teal for water, sage for
   * biology — and the writer is asked to repeat it on the deck's first
   * slide. It does not always remember to, and when it forgets the deck
   * falls back to a colour hashed from its title, which is how a deck
   * the agent deliberately made teal arrived olive. The decision is
   * already here; carrying it is more reliable than asking twice.
   */
  const deckTheme = useRef(null);

  // Two different rules, because sending and streaming are different
  // acts. Pressing send ALWAYS scrolls — the teacher just spoke and
  // should see it land, however far up they had scrolled. Streaming
  // only follows if they are already near the bottom: yanking the view
  // down while they read an earlier answer is the most irritating thing
  // a chat can do.
  const forceScroll = useRef(false);
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    // Nothing said yet means the opening screen, and on a phone that is
    // just tall enough to land inside the "near the bottom" window — so
    // the studio opened already scrolled past its own heading.
    if (!turns.length) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (forceScroll.current || near) {
      el.scrollTop = el.scrollHeight;
      forceScroll.current = false;
    }
  }, [turns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const attach = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setNotice(null);
    try {
      for (const f of files) {
        // One upload path for the studio, the goal planner and the
        // shelf — see features/materials/api.ts. It also stamps the
        // class, so a file attached while teaching 6B is filed as 6B's.
        const att = await uploadMaterial(f, {
          where: "studio",
          audience: classSel.current,
        });
        setAttachments((a) => [...a, att]);
      }
    } catch (err) {
      setNotice(err.message);
    } finally {
      setUploading(false);
    }
  };

  /**
   * The library row for a document, found by what it is called.
   *
   * A fallback for the batch link, not a replacement: titles are not unique
   * and the newest match is the best guess available. Only ever used to MOVE
   * a lesson, where the worst case is the wrong row changing time — recoverable
   * in one sentence — against regenerating three documents, which is not.
   */
  const keptIdByTitle = async (title) => {
    const wanted = String(title || "").trim().toLowerCase();
    if (!wanted) return null;
    try {
      const rows = await api("/api/drafts");
      const list = Array.isArray(rows) ? rows : rows?.items || [];
      const hit = list.find(
        (r) => String(r.name || r.title || "").trim().toLowerCase() === wanted,
      );
      return hit?.id || null;
    } catch {
      return null;
    }
  };


  /**
   * One turn of the conversation, run by the agent.
   *
   * What is NOT here is the whole point. There is no kind to work out,
   * no thread inheritance, no partial-edit detection and no prompt
   * stitched together from the last three turns — every one of those
   * heuristics existed because the old route had exactly one
   * destination and this component had to guess what to send it. The
   * agent reads the conversation itself, so all this does is carry
   * frames onto the screen.
   */
  const runAgentTurn = useCallback(async (prompt, atts, hint, display, forClass = null, goalDay = null) => {
    const controller = new AbortController();
    abortRef.current = controller;

    let sid = sessionRef.current;
    if (!sid) {
      try {
        const row = await createSession(prompt);
        sid = row.session_id;
        sessionRef.current = sid;
        setSessions((list) => [row, ...list]);
      } catch {
        // A conversation that cannot be filed is still a conversation
        // worth having. She loses the history entry, not the answer.
      }
    }
    /**
     * What she sees and what the model reads are not always the same.
     *
     * Approving a deck outline sends eleven numbered rows so the writer
     * follows the plan exactly — and posting that into the thread as her
     * message put a wall of text where a click had been. `display` is
     * the short form: it is what the bubble shows and what the
     * transcript keeps, so reopening the conversation does not bring the
     * wall back either.
     */
    if (sid) appendMessage(sid, { role: "user", text: display || prompt });

    /**
     * The toggle is a hint, not an instruction.
     *
     * She may have tapped Quiz, and if she did that outranks the
     * agent's own reading. But an untouched row of toggles means
     * nothing at all — it resets to "Lesson" on every page load, which
     * is how asking for homework in a thread holding a lesson used to
     * rewrite the lesson.
     */
    const hinted = hint?.length
      ? `${prompt}\n\n(She has the ${hint.map((k) => KIND_META[k]?.label || k).join(" and ")} tool selected.)`
      : prompt;
    /**
     * Her class, in the same parenthetical register as the tool hint.
     * Last, where a model weights it most — the codebase's own rule for
     * instructions. The agent reads the whole conversation, so on a
     * rework this restates the class the thread is already for.
     */
    const message = forClass
      ? `${hinted}\n\n(This is for her class ${classLabel(forClass)} — ${forClass.count} student${forClass.count === 1 ? "" : "s"} on her roster. Write for exactly that grade and subject, and state both in the title line.)`
      : hinted;

    /**
     * Turns are addressed by id, and the id is decided OUT HERE.
     *
     * This was written to remember a turn's index by assigning it inside
     * the setTurns updater, which is a bug React only shows you in
     * development: it invokes an updater twice to catch impure ones, so
     * the second pass saw the index already set, took the "append to
     * existing" branch against the ORIGINAL array, found nothing at that
     * index and returned the array untouched. The appended turn was
     * dropped every time. The words still reached `said` and were still
     * filed, which is why the reply appeared only after leaving the
     * conversation and coming back to it.
     *
     * So nothing is decided inside an updater any more. Ids are made
     * here, the "have I opened this one yet" flags live here, and the
     * updaters do one pure thing: map over turns and replace by id.
     */
    const turnId = (suffix) => `agent-${runSeq.current}-${suffix}`;
    runSeq.current += 1;

    const docId = new Map();
    const docKind = new Map();         // turn id → its kind, for filing a stopped one
    const filed = new Set();           // turn ids already written to the transcript
    const reveal = new Map();          // turn id → its paced reveal
    const sayKey = turnId('say');
    let batchId = null;

    /** Everything a document actually received, for filing it complete. */
    const fullText = new Map();

    let speechFiled = false;
    const fileSpeech = () => {
      if (speechFiled) return;
      speechFiled = true;
      const spoken = (reveal.get(sayKey)?.text || "").trim();
      if (sid && spoken) appendMessage(sid, { role: "assistant", text: spoken, kind: "say" });
    };

    const revealFor = (id) => {
      let r = reveal.get(id);
      if (!r) {
        r = makeReveal((visible) =>
          setTurns((t) => t.map((x) => (x.id === id ? { ...x, text: visible } : x))),
        );
        reveal.set(id, r);
      }
      return r;
    };

    /**
     * The reply turn opens now, empty, not on the first token.
     *
     * Waiting for the model to speak before putting anything on screen
     * left the thread showing her own message and nothing else for as
     * long as the round trip took — which reads as a message that went
     * nowhere. An empty reply turn renders the working indicator, and
     * the first token replaces it in place.
     */
    setTurns((t) => [...t, { role: "say", id: sayKey, text: "", streaming: true }]);

    // Loaded on use, as the batch path does: the streaming reader is only
    // needed once she actually sends something.
    const { streamSSE, AI_FIRST_BYTE_MS, AI_IDLE_MS } = await import("@/shared/lib/apiStream");

    try {
      await streamSSE("/api/studio/agent", {
        signal: controller.signal,
        // Generous, because a cold Render instance needs seconds to wake —
        // but bounded, because "forever" was the previous timeout.
        firstByteMs: AI_FIRST_BYTE_MS,
        idleMs: AI_IDLE_MS,
        body: {
          message,
          ...(sid ? { sessionId: sid } : {}),
          ...(atts.length ? { materials: atts.map((a) => ({ id: a.id, name: a.name })) } : {}),
          // The parameter, not the ref: send() spends the marker before
          // calling this, so the ref is already null by now.
          ...(goalDay ? { goal_day_id: goalDay } : {}),
          ...(skillSel.current && !skillSel.current.all ? { skill_ids: skillSel.current.ids } : {}),
        },
        onEvent: (ev) => {
          switch (ev.type) {
            /* The agent's own words, streamed as it speaks them. */
            case "say": {
              revealFor(sayKey).push(ev.text);
              break;
            }

            case "artifact_start": {
              batchId = ev.batch_id || batchId;
              /**
               * File the spoken line before the first document, because
               * that is the order she heard it in.
               *
               * Speech was filed in the `finally` block, which runs after
               * every document has already been written — so the
               * transcript recorded the agent's "Grade 7, 40 minutes"
               * AFTER the lesson it introduces, and reopening the
               * conversation showed the line underneath the document
               * explaining what was about to be written. The agent always
               * speaks before it calls a tool, so by the time a document
               * opens the speech is complete and safe to store.
               */
              fileSpeech();
              const id = turnId(ev.kind);
              docId.set(ev.kind, id);
              docKind.set(id, ev.kind);
              setTurns((t) => [
                ...t,
                {
                  role: "assistant", id, kind: ev.kind, text: "", streaming: true, batchId,
                  ...(ev.kind === "presentation" && deckTheme.current
                    ? { theme: deckTheme.current }
                    : {}),
                },
              ]);
              if (ev.kind === "presentation") deckTheme.current = null;
              break;
            }

            case "delta": {
              const id = docId.get(ev.kind);
              if (!id) break;
              fullText.set(id, (fullText.get(id) || "") + ev.text);
              revealFor(id).push(ev.text);
              break;
            }

            case "artifact": {
              const id = docId.get(ev.kind);
              if (!id) break;
              const content = ev.content;
              setTurns((t) => t.map((x) => (x.id === id ? { ...x, structured: content } : x)));
              break;
            }

            case "artifact_end": {
              const id = docId.get(ev.kind);
              if (!id) break;
              const kind = ev.kind;
              /**
               * Filed from a ref, not from inside the updater.
               *
               * Saving the row inside setTurns meant the row was written
               * once per invocation of the updater — twice in
               * development — so every document was filed to the library
               * in duplicate.
               */
              /**
               * Let the reveal finish, but file what ARRIVED.
               *
               * The visible text can be a few frames behind when the
               * stream closes, and saving that prefix would file a
               * lesson with its last paragraph missing — the teacher
               * would see a complete document and open a truncated one.
               */
              revealFor(id).end();
              const complete = fullText.get(id) || "";
              setTurns((t) => {
                const finished = t.find((x) => x.id === id);
                if (finished) {
                  finishedDocs.current.set(id, {
                    ...finished, text: complete, ...(ev.id ? { serverId: ev.id } : {}),
                  });
                }
                // The class this was written for rides on the turn, so the
                // save files it under the same class (see storeBatch).
                return t.map((x) =>
                  x.id === id
                    ? {
                        ...x, streaming: false, done: true,
                        ...(forClass ? { audience: forClass } : {}),
                        // The service writes the row now and tells us which
                        // one. Its ABSENCE is meaningful — never a null —
                        // and means the insert failed there, so the browser
                        // must still save. See storeBatch.
                        ...(ev.id ? { serverId: ev.id } : {}),
                      }
                    : x,
                );
              });
              const doc = finishedDocs.current.get(id);
              if (sid && doc) {
                appendMessage(sid, {
                  role: "assistant",
                  text: complete,
                  kind,
                  structured: doc.structured,
                  batchId,
                });
                filed.add(id);
              }
              lastDoc.current = { kind, title: ev.title || "" };
              break;
            }

            /*
               The plan, before anything is drawn. It is a turn like any
               other so it survives a reload and sits in the thread where
               she left it — but nothing has been generated yet.
            */
            case "outline": {
              const id = turnId("outline");
              setTurns((t) => [
                ...t,
                {
                  role: "outline",
                  id,
                  kind: "presentation",
                  batchId: ev.batch_id || batchId,
                  title: ev.title || "Presentation",
                  topic: ev.topic || "",
                  grade: ev.grade || "",
                  subject: ev.subject || "",
                  theme: ev.theme || "",
                  slides: Array.isArray(ev.slides) ? ev.slides : [],
                  done: true,
                },
              ]);
              break;
            }

            case "unread": {
              if (ev.unread_materials?.length) {
                setNotice(`Could not read: ${ev.unread_materials.join(", ")}`);
              }
              break;
            }

            case "error": {
              setTurns((t) => [...t, {
                role: "error",
                text: ev.message,
                code: ev.code || null,
                // The same brief, one press away — a teacher should never
                // have to retype what she already wrote because a proxy
                // hiccuped. Materials and the full kind set travel with
                // it: a retry that quietly dropped her chapter would
                // answer a different question than the one that failed.
                retry: { text: prompt, kinds: hint || [], attachments: atts },
              }]);
              break;
            }

            case "done": {
              if (ev.batch_id) batchId = ev.batch_id;
              revealFor(sayKey).end();
              setTurns((t) =>
                t.map((x) => (x.id === sayKey ? { ...x, streaming: false } : x)),
              );
              break;
            }

            default:
              break;
          }
        },
      });
    } catch (error) {
      if (!controller.signal.aborted || error?.code === "stream_timeout") {
        /**
         * The Goals screen's poll-after-proxy-cut pattern, extended here.
         * A proxy that cuts at thirty seconds kills the STREAM, not the
         * work — when the service finishes anyway it saves the batch
         * itself, and the rows are already in her library by the time the
         * browser gives up. So the library is asked before this is called
         * a failure.
         */
        const rescued = batchId
          ? await recoverBatch(batchId, hint?.length ? hint : null, controller.signal)
          : null;
        if (rescued) {
          applyRescuedRows(rescued, batchId);
        } else {
          setTurns((t) => [...t, {
            role: "error",
            text: error?.message || "Something went wrong. Try again.",
            code: error?.code || null,
            retry: { text: prompt, kinds: hint || [], attachments: atts },
          }]);
        }
      }
    } finally {
      // Already done if a document followed; this covers the turns that
      // were only ever an answer.
      fileSpeech();
      // An abandoned turn should not keep animating; show what arrived.
      for (const r of reveal.values()) r.flush();

      /**
       * A document she stopped is still a document she has.
       *
       * Only `artifact_end` filed anything, and pressing Stop means that
       * frame never arrives — so half a lesson lived in React state and
       * nothing else. It looked saved, because it was on screen; leaving
       * the conversation and coming back showed it had never existed.
       * Whatever arrived is written now, under the same batch, so the
       * transcript matches what she was actually looking at.
       */
      if (sid) {
        for (const [id, text] of fullText) {
          if (filed.has(id) || !text.trim()) continue;
          appendMessage(sid, {
            role: "assistant",
            text,
            kind: docKind.get(id),
            structured: finishedDocs.current.get(id)?.structured ?? null,
            batchId,
          });
          filed.add(id);
        }
      }
      setTurns((t) =>
        t
          // A turn that opened and was never spoken into is not a reply.
          // It happens when the agent goes straight to writing.
          .filter((x) => !(x.id === sayKey && !x.text.trim()))
          .map((x) =>
            x.streaming
              ? // `done` as well as `streaming: false`: the artifact card
                // is gated on `done`, so a stopped document that only had
                // its streaming flag cleared would keep the bare streaming
                // view and lose its Save button.
                { ...x, streaming: false, ...(x.kind ? { done: true } : {}) }
              : x,
          ),
      );
      abortRef.current = null;
      setBusy(false);
    }
  }, []);

  const send = useCallback(async (text, useKind, opts = {}) => {
    const prompt = (text ?? draft).trim();
    /**
     * A file on its own is a request.
     *
     * The service asks for a prompt, materials, or both — this guard asked for
     * words, so a teacher who attached a chapter, pressed Lesson and pressed
     * send got nothing at all, with no error to explain it.
     */
    if ((!prompt && !attachments.length) || busy) return;

    /**
     * Ask before writing, not after.
     *
     * A prompt like "a lesson on volcanoes" names a topic and nothing else,
     * and the generator fills the rest in silently — it produced "Science ·
     * Grade 9 · 45 minutes" for exactly that. The grade decides the reading
     * level and the difficulty of every question, so a wrong guess means
     * regenerating the whole lesson. One short question here costs her a
     * sentence and saves that.
     *
     * `opts.skipAsk` is set when this call IS the answer coming back.
     */
    /**
     * Only ask on a genuinely new request.
     *
     * A rework — "make it simpler for grade 3" — is answered by the
     * conversation it sits in: the subject and the length were settled when
     * the first version was written. Asking again reads as the studio having
     * forgotten what she just told it, which is exactly the nagging this
     * question was added to avoid.
     */
    /**
     * Moving a lesson is not rewriting it.
     *
     * "Move it to Thursday at 2pm" asks for a different slot and nothing
     * else. Running it through the generator rewrote three documents she had
     * already approved — a wait, a chunk of the day's quota, and new wording
     * nobody asked for. The timetable row is the only thing that changes, so
     * it is the only thing touched.
     */
    /**
     * She is answering "when should it run?" — so this is a slot, not a brief.
     *
     * Set when the scheduler asked for a new time and nothing else. Without it
     * "thursday 8 to 9" is a prompt with no topic in it, and the generator
     * wrote whatever it liked.
     */
    // A pending slot question does not outrank her asking for something new:
    // "actually make me a quiz on fractions" is a brief, not a time.
    const movingId = namesNewWork(prompt) ? null : awaitingSlot.current;
    const wantsMove =
      !opts.skipAsk && (isScheduleOnly(prompt) || asksToReschedule(prompt));

    if (movingId || (wantsMove && (lastKept?.id || lastDoc.current))) {
      /**
       * Which row is being moved.
       *
       * Normally the batch link answers that — but it is looked up
       * asynchronously when a thread is reopened, and it comes back empty
       * whenever the batch id did not survive the transcript. Falling through
       * to the generator at that point rewrites three documents to change a
       * time, which is the one outcome this whole branch exists to prevent.
       * So when the link is missing the lesson is found by the title it is
       * filed under instead.
       */
      const keptId =
        movingId || lastKept?.id || (await keptIdByTitle(lastDoc.current?.title));
      if (!keptId) {
        setNotice("I couldn't find that in your library to move it.");
        return;
      }
      /**
       * What to call it in the reply. "The lesson itself is unchanged" was
       * printed over a quiz, which reads as the studio having moved something
       * else entirely.
       */
      const movedNoun =
        NOUN_FOR_KIND[
          SCHEDULABLE_KINDS.find((kind) => lastBatch.current?.[kind]) || "lesson_plan"
        ] || "work";

      setDraft("");
      setTurns((t) => [...t, { role: "user", text: prompt }, { role: "note", text: "Moving it…" }]);

      /**
       * A move is part of the conversation, so it has to survive being closed.
       *
       * These turns were only ever pushed into React state. Reopening the
       * thread showed the documents with no sign she had ever moved them —
       * the question, her answer and the confirmation all gone, and the
       * timetable disagreeing with a transcript that never mentioned a change.
       */
      const remember = (text) => {
        if (!sessionRef.current) return;
        appendMessage(sessionRef.current, { role: "assistant", text, kind: "note" });
      };
      if (sessionRef.current) appendMessage(sessionRef.current, { role: "user", text: prompt });

      try {
        const reply = await api("/api/studio/schedule", {
          method: "POST",
          // `must_move` so a request with no time in it comes back as a
          // question about the new slot rather than as "nothing changed".
          body: { draft_id: keptId, answer: prompt, confirm: true, must_move: true },
        });

        /**
         * It needs a time it does not have.
         *
         * A quiz is booked between two hours and she may have given neither,
         * so the scheduler asks. Her next message is the answer — remembered
         * here, because on its own "thursday 8 to 9" looks like a request to
         * write something rather than a slot for something already written.
         */
        if (reply?.status === "needs_input") {
          awaitingSlot.current = keptId;
          const asked = reply.question || "When should it run?";
          setTurns((t) =>
            t.map((x, i) => (i === t.length - 1 ? { ...x, text: asked } : x)),
          );
          remember(asked);
          return;
        }
        awaitingSlot.current = null;
        const entry = reply?.entry;
        const movedDay = entry
          ? new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long",
            })
          : "";
        // Homework carries a date and no hours, so there is nothing to append.
        const movedAt = entry?.start_time
          ? `, ${String(entry.start_time).slice(0, 5)}${
              entry.end_time ? `\u2013${String(entry.end_time).slice(0, 5)}` : ""
            }`
          : "";
        const said = entry
          ? `Moved to ${movedDay}${movedAt}. The ${movedNoun} itself is unchanged.`
          : "That could not be moved.";
        setTurns((t) =>
          t.map((x, i) => (i === t.length - 1 ? { ...x, text: said } : x)),
        );
        remember(said);

        /**
         * The card has to move with the timetable.
         *
         * Rescheduling from the chat wrote the new slot to `schedule_entries`
         * and stopped there, so the library card went on showing the day it
         * was first booked for. Two screens, two answers, and the one she
         * looks at most was the wrong one.
         */
        if (entry) {
          const movedKind =
            SCHEDULABLE_KINDS.find((kind) => lastBatch.current?.[kind]) || "lesson_plan";
          await stampCardFields(movedKind, keptId, entry);
        }
        refreshSessions();
      } catch (e) {
        setTurns((t) =>
          t.map((x, i) => (i === t.length - 1 ? { ...x, text: `Could not move it: ${e.message}` } : x)),
        );
      }
      return;
    }

    /**
     * Is this thread already carrying work?
     *
     * The rework test used to hang on `lastPrompt`, which is the text of the
     * last request — and a thread reopened, or one whose last message was a
     * reschedule, can have documents on screen and nothing in that variable.
     * The studio then treated an edit as a cold start and asked her for the
     * grade, the subject and the length of a quiz she was looking at.
     *
     * What actually settles it is whether anything has been generated here.
     * If it has, a follow-up belongs to it unless she names new work.
     */
    const priorWork = !!(lastDoc.current || lastBatch.current);
    const reworking =
      priorWork || lastPrompt.current
        ? isRework({
            previous: { title: "", prompt: lastPrompt.current || "" },
            prompt,
            title: "",
          })
        : false;

    /**
     * What she asked for, when she said it in the request itself.
     *
     * Outranks the composer's kind row, which resets to "Lesson" on every page
     * load: a teacher who types "now a quiz on photosynthesis" has named the
     * kind more clearly than a chip she never touched.
     */
    const spoken = opts.skipAsk ? [] : kindsNamedIn(prompt);

    /**
     * Nothing is asked before writing.
     *
     * There used to be a gate here: missingFrom() read the brief for a grade,
     * a subject, a duration and a day, and anything absent became a question
     * — "Before I write it, how long does it run and when are you teaching
     * it?" — with Generate and "You decide" beneath it.
     *
     * Removed on the owner's call, and the reasoning it was built on was
     * sound but backwards. A teacher who types "a lesson on the water cycle
     * for Grade 6" has said enough; stopping to interrogate her makes the
     * fastest path through the product a form. The model already handles an
     * unstated duration the way an experienced colleague would — it picks a
     * period and says so — and every question here was one she could have
     * answered by editing the draft in less time than it took to read.
     *
     * The timetable questions went with them: scheduling is now only ever
     * inferred from words she volunteered, never solicited. See
     * FinaliseAndSchedule.tsx.
     *
     * missingFrom/askFor/declined stay in missingDetails.js — the "ask" turn
     * still renders for threads that already contain one, so old
     * conversations keep reading correctly.
     */
    /**
     * Rewrite only what she asked about.
     *
     * "Make the student notes simpler" names one of the three documents. Sending
     * that as a full lesson request rewrote the plan and the guide too — minutes
     * of waiting for two documents she had already approved, and new wording in
     * both that she then had to re-read to check nothing had drifted.
     *
     * Only kinds this thread has actually produced qualify; a request for the
     * guide in a conversation that only ever made notes falls back to a normal
     * generation rather than an edit of something that does not exist. And
     * naming ALL of them is not a partial edit — that is the whole lesson,
     * which the existing path already handles.
     */
    const named = reworking ? targetedKinds(prompt) : [];
    const held = lastBatch.current;
    const partial = held
      ? named.filter((kind) => held[kind])
      : [];
    const untouched = partial.length
      ? Object.values(held).filter((d) => !partial.includes(d.kind))
      : [];
    const isPartial = partial.length > 0 && untouched.length > 0;

    /**
     * A part edit belongs to the card that part came from.
     *
     * Editing one document of a lesson is never the creation of a lesson, so
     * the save that follows has to replace the row already in the library —
     * with its subject, its grade, its length and the slot it holds on the
     * timetable all intact. That only happens when the widget is told which
     * card it is updating, and in a reopened thread that link is looked up in
     * the background and may not have arrived yet. Waiting for it here is the
     * difference between updating her lesson and filing a duplicate beside it.
     */
    if (isPartial && !lastKept?.id) {
      const keptId = await keptIdByTitle(lastDoc.current?.title);
      if (keptId) {
        setLastKept({ batchId: null, id: keptId, title: lastDoc.current?.title || "", prompt: "" });
      }
    }

    /**
     * A rework rewrites what the thread already holds.
     *
     * The composer's kind row resets to "Lesson" on every page load, so
     * reopening a quiz and asking for a better question 9 came back as a
     * lesson plan about cyber security — the right topic in entirely the
     * wrong document. What she is editing decides the format; the composer
     * only decides it for genuinely new work.
     */
    const heldKinds = held ? Object.keys(held) : [];
    /**
     * Read in order of how plainly she said it.
     *
     * Inheriting the thread's kinds used to sit at the top of this chain, so
     * it beat every explicit signal underneath it: a starter chip, the kind
     * named in the sentence, and the row she had just set. That is why asking
     * for homework in a thread holding a lesson, notes and a quiet quiz
     * rewrote all three and produced no homework at all — and it could not be
     * escaped by rewording, because naming the kind was outranked too.
     *
     * Inheritance is the FALLBACK now: it applies when she has said nothing
     * about format, which is exactly the case it was written for ("give
     * question 9 more marks"), and never when she has.
     */
    /**
     * The agent decides the rest.
     *
     * Everything below this branch — the kind chain, the carried
     * context, the partial-edit bookkeeping — exists to compensate for a
     * route that could only generate. The agent reads the thread itself,
     * so the only thing worth passing on is an EXPLICIT pick: a starter
     * chip, or a toggle she has just moved. An untouched toggle row says
     * nothing, because it resets to "Lesson" on every page load.
     */
    if (USE_AGENT) {
      // A retry replays what the failed turn actually sent. Reading the
      // live state instead would rebuild the brief WITHOUT her materials,
      // because send() clears them — she would get a quietly worse
      // document rather than an error.
      const hint = opts.kinds?.length
        ? opts.kinds
        : useKind
          ? [useKind]
          : kindsTouched.current
            ? kinds
            : [];
      kindsTouched.current = false;
      const atts = opts.attachments ?? attachments;
      // Spent here: the day is marked drafted by THIS turn, and the next
      // thing she writes is not that Tuesday.
      const goalDay = goalDayRef.current;
      goalDayRef.current = null;
      setDraft("");
      setAttachments([]);
      setNotice(null);
      setBusy(true);
      forceScroll.current = true;
      lastPrompt.current = prompt;
      if (!opts.skipAsk || opts.display) {
        setTurns((t) => [
          ...t,
          { role: "user", text: opts.display || prompt, attachments: atts },
        ]);
      }
      // The class pick travels with the turn; a slot answer is not a
      // brief, so it carries none.
      return runAgentTurn(prompt, atts, hint, opts.display, opts.skipAsk ? null : classSel.current, goalDay);
    }

    const ks = opts.kinds?.length
      ? opts.kinds
      : isPartial
        ? partial
        : useKind
          ? [useKind]
          : spoken.length
            ? spoken
            : kindsTouched.current
              ? kinds
              : reworking && heldKinds.length
                ? heldKinds
                : kinds;
    kindsTouched.current = false;
    const k = ks[0];
    const atts = opts.attachments ?? attachments;
    // Spent here, for the same reason as the agent path above.
    const goalDay = goalDayRef.current;
    goalDayRef.current = null;

    setDraft("");
    setAttachments([]);
    setNotice(null);
    setBusy(true);
    forceScroll.current = true;
    setTurns((t) => [
      ...t,
      // Her message is already in the thread when this call is the answer to
      // a "before I write it" question — posting it again would show the same
      // request twice, once bare and once with the details bolted on.
      ...(opts.skipAsk ? [] : [{ role: "user", text: prompt, attachments: atts }]),
      { role: "assistant", kind: k, text: "", streaming: true },
    ]);

    // Remembered so the next message can be recognised as a rework of it.
    lastPrompt.current = prompt;
    // A fresh generation replaces the set; a partial edit adds to it. Without
    // this, a quiz written after a lesson kept the lesson's three documents
    // around and "improve the notes" edited a lesson no longer on screen.
    if (!isPartial) lastBatch.current = null;

    /**
     * A rework has to carry what it is reworking.
     *
     * `/api/studio/generate` is stateless — it holds no history and is handed
     * one prompt. "Make it simpler for grade 3" on its own names no topic at
     * all, so the model filled the gap and produced a Grade 3 MATHS lesson in
     * the middle of a conversation about magnets. The teacher sees a thread
     * and reasonably assumes the studio can see it too.
     *
     * So the previous document goes with the instruction: the topic to keep,
     * and the version to change.
     */
    /**
     * A partial edit carries the part being edited, not the lesson plan.
     *
     * The generator is handed one prompt per document it writes, and for these
     * it must see the version it is replacing — handing it the plan instead
     * produced a second lesson plan under the heading "student notes".
     *
     * The rest of the lesson is described but not sent to be rewritten: it is
     * what keeps the new version consistent with the documents staying put.
     */
    /**
     * A DIFFERENT document is new work, not a revision.
     *
     * "Now a homework for the same topic" is a follow-up, so it classified as
     * a rework — and the rework prompt says "here is the existing version,
     * rewrite it changing only what she asked". Handed a quiz and asked for
     * homework, the model did as it was told and returned the quiz again,
     * with a homework label on the card.
     *
     * So the thread's work is carried two different ways. Same kind: this is
     * the version to change. Different kind: this is the lesson it belongs
     * to — take the topic, the grade and the scope from it, and write
     * something else.
     */
    const newKind = !isPartial && ks.some((x) => !heldKinds.includes(x));
    /** The plan is the better source when the batch holds one; the last
     *  document is whatever she happened to look at most recently. */
    const source = held?.lesson_plan ?? lastDoc.current;

    /**
     * The class she picked in the composer, captured for this run.
     *
     * Fresh briefs only: a rework pins its own grade ("keep the same
     * topic, subject, grade…"), and a slot answer is not a brief. The
     * pick becomes ground truth twice over — it steers the writing
     * here, and it is stamped onto the saved row (see storeBatch), so
     * grade and subject are no longer whatever the regex could scrape
     * back out of the model's own title line.
     */
    const forClass = opts.skipAsk ? null : classSel.current;
    const classWrapped =
      forClass
        ? [
            `This is for the teacher's own class: ${classLabel(forClass)} (${forClass.count} student${forClass.count === 1 ? "" : "s"} on her roster).`,
            "Write for exactly that grade and subject, and state both in the title line.",
            "",
            prompt,
          ].join("\n")
        : prompt;

    const carried = isPartial
      ? [
          `This is a revision of one part of an existing lesson on "${lastDoc.current?.title || ""}".`,
          "Keep that exact topic, subject, grade and length.",
          `The rest of the lesson (${untouched.map((d) => KIND_META[d.kind]?.label || d.kind).join(", ")}) is NOT being changed, so this must stay consistent with it.`,
          "",
          "The existing version of the part to change:",
          partial.map((kind) => held[kind].text).join("\n\n").slice(0, 6000),
          "",
          `Now rewrite ONLY this part, applying this change: ${prompt}`,
        ].join("\n")
      : newKind && source
      ? [
          `The teacher is already working on a lesson: "${source.title || lastDoc.current?.title || ""}".`,
          "Keep its exact topic, subject and grade. Stay inside what it teaches — do not examine or practise anything it never covers.",
          "",
          `What the lesson already contains, as REFERENCE ONLY. Do not reproduce it and do not reshape it into a ${NOUN_FOR_KIND[ks[0]] || "document"}:`,
          source.text.slice(0, 6000),
          "",
          `Now write a NEW ${NOUN_FOR_KIND[ks[0]] || "document"} on that same topic. Her request: ${prompt}`,
        ].join("\n")
      : reworking && lastDoc.current
      ? [
          `This is a revision of an existing ${NOUN_FOR_KIND[ks[0]] || "document"} on "${lastDoc.current.title}".`,
          /**
           * Everything she did not ask to change, stays.
           *
           * This pinned the topic and the subject and said nothing about the
           * grade — so "make it more hands-on" came back as a Grade 9 activity
           * for a Grade 5 class. The card kept the right grade and the document
           * inside it disagreed, which is worse than either being wrong.
           */
          "Keep the same topic, subject, grade, section and length.",
          "Change ONLY what the instruction at the end asks for.",
          "",
          "The existing version:",
          lastDoc.current.text.slice(0, 6000),
          "",
          // The instruction goes LAST, where a model weights it most, and is
          // stated as a requirement rather than as context. Buried above the
          // document, "make it simpler for grade 3" was read as a description
          // of the old version and the header came back still saying Grade 5.
          `Now rewrite the whole lesson applying this change: ${prompt}`,
          "Every part must reflect the change, including the title line stating subject, grade and duration.",
        ].join("\n")
      : classWrapped;

    const controller = new AbortController();
    abortRef.current = controller;

    // Open a thread on the first message and save the teacher's words
    // straight away — before the generator is even called, so a prompt
    // survives a failure, a refresh or a closed tab.
    let sid = sessionRef.current;
    try {
      if (!sid) {
        const row = await createSession(prompt);
        sid = row.session_id;
        sessionRef.current = sid;
        setSessionId(sid);
        setSessions((x) => [row, ...x]);
      }
      appendMessage(sid, { role: "user", text: prompt });
    } catch (e) {
      // History is a convenience; losing it must never stop the work.
      console.warn("[studio] history unavailable:", e.message);
    }

    // Hoisted out of the try so the catch can ask the library whether
    // this batch landed despite the cut (recoverBatch).
    let curBatch = null;
    try {
      // The shared SSE reader, not a hand-rolled one: it scans frames for
      // the `data:` line (a keep-alive comment or an `event:` line used
      // to make this parser drop the whole frame), separates a refusal
      // from a failure, and turns a code-less 404 into "not built yet".
      const { streamSSE, AI_FIRST_BYTE_MS, AI_IDLE_MS } = await import("@/shared/lib/apiStream");

      // Generate is a batch protocol: `batch → status → scope →
      // artifact_start → delta(kind) → artifact → artifact_end → done`,
      // one start/end pair per requested kind. The composer's kind row
      // is a multi-select, so this is often a real batch — the handling
      // below rolls a new bubble per artifact, and each renders as its
      // own reply with its own viewer and Save.
      let acc = "", structured = null, savedId = null;
      // Every artifact in one request shares this (curBatch, hoisted
      // above the try). Without it the three documents of a lesson are
      // three unrelated rows, and nothing can find the guide and the
      // notes that belong to a plan.
      let curKind = k;
      let open = true; // the placeholder bubble pushed at send time

      const patchLast = (fields) => setTurns((t) => {
        const n = [...t];
        n[n.length - 1] = { ...n[n.length - 1], ...fields };
        return n;
      });
      const finalizeTurn = () => {
        // The plan (or the quiz, or whatever takes the slot) is what a later
        // rework needs to see; the guide and the notes follow from it.
        if (SCHEDULABLE_KINDS.includes(curKind)) {
          lastDoc.current = { title: titleOf(curKind, acc, structured), text: acc };
        }
        // The set this thread now holds, so the NEXT edit can be partial too.
        lastBatch.current = { ...(lastBatch.current || {}), [curKind]: { kind: curKind, text: acc, structured } };
        /**
         * The documents this run deliberately did not rewrite.
         *
         * Carried on the turn rather than looked up at save time: by then the
         * ref has moved on, and a lesson would be filed with only the part she
         * edited — the other two silently dropped from the card.
         */
        patchLast({
          text: acc, structured, streaming: false, done: true, stage: null,
          batchId: curBatch, prompt,
          // The class this was written for rides on the turn, so the
          // save that happens later files it under the same class.
          ...(forClass ? { audience: forClass } : {}),
          ...(isPartial ? { carryOver: untouched } : {}),
        });
        // The batch id travels with the turn, so reopening this thread
        // tomorrow can still find the library card it produced.
        appendMessage(sid, { role: "assistant", text: acc, kind: curKind, structured, batchId: curBatch });
        open = false;
      };
      const startTurn = (kindNext) => {
        curKind = kindNext || curKind;
        acc = "";
        structured = null;
        setTurns((t) => [...t, { role: "assistant", kind: curKind, text: "", streaming: true, batchId: curBatch }]);
        open = true;
      };

      await streamSSE("/api/studio/generate", {
        signal: controller.signal,
        firstByteMs: AI_FIRST_BYTE_MS,
        idleMs: AI_IDLE_MS,
        refusalAsAnswer: true,
        body: {
          kinds: ks,
          prompt: carried,
          materials: atts.map((a) => ({ id: a.id, name: a.name })),
        ...(goalDay ? { goal_day_id: goalDay } : {}),
          // Explicit only when the teacher narrowed the pick — "all
          // selected" omits the field so the service's assignment-aware
          // defaults decide. See todo/backend/08-skills-refinement.md.
          ...(skillSel.current && !skillSel.current.all ? { skill_ids: skillSel.current.ids } : {}),
        },
        onEvent: (ev) => {
          switch (ev.type) {
            case "batch":
            case "unread": {
              if (ev.batch_id) {
                curBatch = ev.batch_id;
                patchLast({ batchId: curBatch });
              }
              // Files the service could not read did not shape the
              // answer. Say so now, not after the teacher wonders why
              // the chapter was ignored.
              const names = (ev.unread_materials || []).join(", ");
              if (names) setNotice(`Couldn't read: ${names} — the reply was written without ${ev.unread_materials.length === 1 ? "it" : "them"}.`);
              break;
            }
            case "status":
              // The service says what it is doing before any prose
              // exists ("planning"). Shown in place of the empty bubble,
              // so a slow cold start reads as work rather than as a hang.
              patchLast({ stage: ev.stage || null });
              break;
            case "scope":
              // What the request resolved to (subject, grade, class).
              // Metadata rather than prose — kept on the turn so a
              // future header can show it; not rendered today.
              patchLast({ scope: ev.scope ?? ev });
              break;
            case "artifact_start":
              // Each artifact gets its own bubble; the first one reuses
              // the placeholder pushed at send time.
              if (!open) startTurn(ev.kind);
              else if (ev.kind && ev.kind !== curKind) { curKind = ev.kind; patchLast({ kind: ev.kind }); }
              break;
            case "delta":
              // Defensive rollover: a delta for a new kind with no
              // artifact_start between (older protocol variants).
              if (!open || (ev.kind && ev.kind !== curKind && !acc)) {
                if (!open) startTurn(ev.kind);
              }
              acc += ev.text || "";
              patchLast({ text: acc, stage: null });
              break;
            case "artifact":
              // The structured form of what was just written in prose —
              // a deck as slides, a quiz as questions. The viewers
              // prefer it over markdown when present.
              structured = normaliseArtifact(ev.content ?? ev.artifact ?? ev);
              break;
            case "artifact_end":
              // The service wrote this document's row and is naming it.
              // Stamped on the turn so storeBatch does not insert a
              // second one. Absent means its own insert failed and the
              // browser is still the writer — which is the old path.
              if (ev.id) patchLast({ serverId: ev.id });
              finalizeTurn();
              break;
            case "done":
              // Normalise to ONE shape. The generator sends a quiz as
              // { quiz: { questions } } but a deck as { slides: [...] } —
              // storing whichever arrived raw meant the deck was an
              // array where the renderer looked for `.slides`, and every
              // deck silently fell through to plain markdown.
              structured = structured || normaliseArtifact(
                ev.quiz ? ev.quiz : ev.slides ? { slides: ev.slides } : ev.structured,
              );
              if (ev.id) savedId = ev.id;
              break;
            case "error":
              // Only refusals reach here (refusalAsAnswer) — the model
              // declining on purpose is a complete answer, not a failure
              // banner suggesting the teacher retry the same thing.
              acc = ev.message || "The studio can only make teaching material.";
              patchLast({ text: acc, stage: null });
              break;
          }
        },
      });

      // Close whatever is still open: the whole answer on the pre-batch
      // protocol (no artifact_end), a refusal, or a batch whose last end
      // frame never arrived.
      if (open) finalizeTurn();
      // A row the service saved itself needs no second copy from here.
      if (savedId) setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, saved: true, artifactId: savedId } : x)));
      refreshSessions();
    } catch (err) {
      if (err.name === "AbortError") {
        setTurns((t) => {
          const n = [...t];
          const last = n[n.length - 1];
          if (last?.role === "assistant") n[n.length - 1] = { ...last, streaming: false, stopped: true };
          return n;
        });
      } else {
        /**
         * Ask the library before declaring failure — the Goals pattern.
         * The service saves a finished batch itself; a cut stream does
         * not unwrite those rows.
         */
        let rescued = null;
        if (curBatch) {
          setTurns((t) => {
            const n = [...t];
            const last = n[n.length - 1];
            if (last?.role === "assistant" && !last.done) {
              n[n.length - 1] = { ...last, stage: "connection dropped — checking whether it finished" };
            }
            return n;
          });
          rescued = await recoverBatch(curBatch, ks, controller.signal);
        }
        if (rescued) {
          applyRescuedRows(rescued, curBatch);
        } else {
          setTurns((t) => {
            const n = [...t];
            // Drop the empty placeholder rather than leaving a blank reply
            // above the error.
            if (n[n.length - 1]?.role === "assistant" && !n[n.length - 1].text) n.pop();
            return [...n, {
              role: "error",
              text: err.message,
              code: err.code || null,
              // ks, not useKind: a lesson+quiz+homework batch must retry
              // as all three, not narrow itself to the first.
              retry: { text: prompt, kinds: ks, attachments: atts },
            }];
          });
        }
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      // The balance only moves when she spends, so this is the moment —
      // polling would be a request a minute to watch a number that is
      // still for hours at a time.
      refreshCredits();
    }
  }, [draft, busy, kinds, attachments, refreshSessions, refreshCredits]);

  /** Rescued rows become finished, already-saved turns — which they are. */
  const applyRescuedRows = (rows, batchIdVal) =>
    setTurns((t) =>
      t.map((x) => {
        if (x.role !== "assistant" || x.done || !x.kind) return x;
        if (batchIdVal && x.batchId && x.batchId !== batchIdVal) return x;
        const row = rows.find((r) => r.type === x.kind);
        if (!row) return x;
        const text = row.body_md || row.main_activity || row.instructions || x.text || "";
        return {
          ...x, text, streaming: false, done: true, stage: null,
          saved: true, artifactId: row.id, batchId: batchIdVal || x.batchId,
        };
      }),
    );

  /**
   * Keep a whole generation as ONE library row.
   *
   * A lesson arrives as three documents, and storing three rows put three
   * near-identical entries in her Lessons list where one lesson belonged —
   * and the editor, opening the first, showed a third of what she made. The
   * import path already merges the family into a single `body_md` under its
   * part headings; the studio writes the same shape, so a lesson looks the
   * same however it got there.
   *
   * `replaceId` rewrites the row she already has instead of adding another —
   * that is what makes a rework update her card rather than duplicate it.
   */
  const stripH1 = (md) => String(md || "").replace(/^\s*#\s+.*(\r?\n)+/, "");

  /**
   * Put what the scheduler worked out back onto the row.
   *
   * The lesson editor and the library card read subject, grade, duration and
   * the planned date straight off the row. The document states some of it and
   * the scheduler reads the rest out of her words, so once a slot exists the
   * same values are written where the screens look — otherwise a scheduled
   * lesson opens with an empty Subject and no date on it.
   *
   * Fields the scheduler could not determine are left alone, never blanked.
   */
  const stampCardFields = async (kind, artifactId, entry) => {
    const path = PATH_FOR_KIND[SCHEDULABLE_KINDS.includes(kind) ? kind : "lesson_plan"];
    if (!path || !artifactId || !entry) return;

    const mins = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
    const span = mins(entry.end_time) - mins(entry.start_time);

    /**
     * Homework is filed by when it is DUE.
     *
     * Its card and the day rail both read `due_date`; writing `scheduled_for`
     * put the date on the row where nothing looks for it, so a piece of
     * homework booked for Friday showed no date at all in the library.
     */
    const dated = kind === "homework"
      ? { due_date: entry.date }
      : { scheduled_for: entry.date, planned_date: entry.date };

    const body = {
      ...(entry.date ? dated : {}),
      ...(entry.start_time ? { start_time: entry.start_time.slice(0, 5) } : {}),
      ...(entry.end_time ? { end_time: entry.end_time.slice(0, 5) } : {}),
      ...(entry.subject ? { subject: entry.subject } : {}),
      ...(entry.grade ? { grade: entry.grade } : {}),
      ...(entry.section ? { section: entry.section } : {}),
      ...(span > 0 ? { duration_minutes: span, duration: span } : {}),
    };
    if (!Object.keys(body).length) return;

    try {
      await api(`${path}/${artifactId}`, { method: "PATCH", body });
    } catch (e) {
      // The booking itself succeeded; the card catching up is cosmetic.
      console.warn("[studio] could not stamp the schedule onto the card:", e.message);
    }
  };

  const storeBatch = async (batchTurns, replaceId) => {
    /**
     * The whole lesson, not just the parts this run rewrote.
     *
     * A partial edit regenerates one document and leaves the others exactly as
     * they were — but the library holds a lesson as one merged row, so saving
     * only what changed would replace a three-part lesson with a single page.
     * The parts that were left alone are folded back in here, in the order the
     * documents are meant to be read.
     */
    const carried = batchTurns.find((t) => t.carryOver)?.carryOver || [];
    /**
     * The class the batch was written for — her composer pick, carried
     * on the turn. It outranks the title-line scrape below: the scrape
     * reads what the model happened to write, this is what she chose,
     * and delivery (db/tune.sql §48) keys on these exact values.
     */
    const pickedAud = batchTurns.find((t) => t.audience)?.audience || null;
    const byKind = new Map();
    for (const d of carried) byKind.set(d.kind, d);
    // The regenerated version wins wherever both exist.
    for (const t of batchTurns) byKind.set(t.kind, t);
    const parts = [
      ...DOC_ORDER.filter((k) => byKind.has(k)).map((k) => byKind.get(k)),
      ...[...byKind.values()].filter((d) => !DOC_ORDER.includes(d.kind)),
    ];

    const primary =
      SCHEDULABLE_KINDS.map((k) => parts.find((t) => t.kind === k)).find(Boolean) || parts[0];
    if (!primary) return null;

    /**
     * One row per DELIVERABLE, not one row per batch.
     *
     * A lesson's three documents genuinely are one lesson, and merging them
     * is right — but a quiz and a homework sheet are not parts of a lesson,
     * they are separate things with their own sections, their own marks and
     * their own due dates. Saving the whole batch under the primary kind
     * filed all of it as a single lesson-plan row: the quiz and the homework
     * were folded into that row's body and never appeared in Quizzes or
     * Homework at all, while their cards in the thread showed "Saved" and
     * offered an "Open quizzes" link that led to a section without them.
     * Four documents out of five were reported saved and were not there.
     *
     * So: the lesson trio stays merged, and everything else is kept in its
     * own section under its own path.
     */
    const groups = (() => {
      const trio = DOC_ORDER.filter((k) => byKind.has(k)).map((k) => byKind.get(k));
      const out = [];
      if (trio.length) {
        // Keep the previous choice of kind for the merged row, so a partial
        // edit of just the notes still files where it always did.
        const trioKind =
          SCHEDULABLE_KINDS.find((k) => trio.some((t) => t.kind === k)) || trio[0].kind;
        out.push({ kind: trioKind, parts: trio });
      }
      for (const part of parts) {
        if (DOC_ORDER.includes(part.kind)) continue;
        out.push({ kind: part.kind, parts: [part] });
      }
      return out;
    })();

    /** Build the row body for one deliverable. */
    const bodyFor = (gParts, head) =>
      gParts.length > 1
        ? gParts
            .map((t) => `## ${KIND_META[t.kind]?.label || t.kind}\n\n${stripH1(t.text)}`)
            .join("\n\n")
        : head.text;

    /**
     * Save one deliverable, and hand back its row.
     *
     * `replaceId` only ever belongs to the PRIMARY deliverable — a rework
     * replaces the lesson it reworked, not the quiz that happened to be in
     * the same batch — so the others are always written fresh.
     */
    const storeOne = async (group, replaceForThis, inherit) => {
      const head =
        SCHEDULABLE_KINDS.map((k) => group.parts.find((t) => t.kind === k)).find(Boolean) ||
        group.parts[0];
      if (!head) return null;

      /**
       * The service saved this one already.
       *
       * It writes one row per DELIVERABLE — the lesson trio merged under
       * the same `##` headings this file builds — and returns that row's
       * id on the `artifact_end` of every document in it. So one id on
       * any part means the row exists, and writing our own would make a
       * second copy of a lesson she only asked for once.
       *
       * Any part, not the head: a partial insert still leaves the row
       * there, and the id can arrive on whichever document landed.
       *
       * The merge below is NOT dead. When the service's own insert fails
       * it sends no id at all — never a null — and the browser saving
       * the merged row is what keeps her lesson.
       *
       * A rework goes through the PATCH below regardless: that is an
       * update, not an insert, so it cannot duplicate anything.
       */
      const serverId = group.parts.find((p) => p.serverId)?.serverId;
      if (!replaceForThis && serverId) {
        return { id: serverId };
      }

      const title = titleOf(head.kind, head.text, head.structured);
      const path = PATH_FOR_KIND[head.kind] || "/api/drafts";
      const body_md = bodyFor(group.parts, head);
      const payload = buildPayload({ head, title, body_md });

      /**
       * A quiz written for a Grade 6 Science lesson is Grade 6 Science.
       *
       * `statedFacts` reads what a document says about itself, and a quiz
       * paper often says only its title and its marks — so the row went in
       * with no subject and no grade while the lesson beside it had both.
       * Student visibility is keyed on those two, so an unlabelled quiz
       * reaches nobody. The batch it came from knows, and only fills what
       * the document itself left blank.
       */
      if (inherit) {
        if (!payload.subject && inherit.subject) payload.subject = inherit.subject;
        if (!payload.grade && inherit.grade) payload.grade = inherit.grade;
        if (!payload.section && inherit.section) payload.section = inherit.section;
      }

      return writeRow({ head, path, payload, replaceId: replaceForThis });
    };

    const buildPayload = ({ head: primary, title, body_md }) => ({
      name: title,
      title,
      body_md,
      main_activity: body_md,
      instructions: body_md,
      /**
       * A deck is saved as slides, however it was rendered.
       *
       * The structured pass is a second model call and it is sometimes
       * refused or comes back hollow — the chat copes, because it reads the
       * markdown instead. The library did not: the row went in with no slides
       * on it, so a deck that looked right in the conversation opened empty
       * from Presentations. Read from the markdown here for the same reason
       * and by the same rule.
       */
      slides:
        namedSlides(primary.structured?.slides) ??
        (primary.kind === "presentation" ? slidesFromMarkdown(primary.text) : undefined),
      // What the document says about itself, so the card has something to
      // show the moment it is saved.
      ...statedFacts(primary.text),
      // …and what she actually chose, which wins. Roster spellings can
      // never lose the delivery text-match; a scraped title line can.
      ...(pickedAud?.subject ? { subject: pickedAud.subject } : {}),
      ...(pickedAud?.grade ? { grade: pickedAud.grade } : {}),
      ...(pickedAud?.section ? { section: pickedAud.section } : {}),
      // From a live turn, never from a carried-forward document: those are
      // copies of earlier text and hold neither the batch that produced this
      // save nor the words that asked for it.
      ...(batchTurns[0]?.batchId ? { batch_id: batchTurns[0].batchId } : {}),
      ...(batchTurns[0]?.prompt ? { prompt_text: batchTurns[0].prompt } : {}),
    });

    const writeRow = async ({ head: primary, path, payload, replaceId }) => {
      let saved;
      /**
       * A quiz's questions, from the structured payload when one came back
       * and from the paper itself when one did not.
       *
       * The service no longer buys a second reading of a document it just
       * wrote — `questionsFromMarkdown` does the same job in the browser for
       * nothing. Both shapes are accepted so rows saved before this still work.
       */
      const quizQuestions =
        primary.kind === "quiz"
          ? primary.structured?.questions ?? questionsFromMarkdown(primary.text)
          : null;

      if (replaceId) {
        saved = await api(`${path}/${replaceId}`, { method: "PATCH", body: payload });
        saved = saved ?? { id: replaceId };
        /**
         * A quiz is its questions, and they are stored beside the body.
         *
         * The PATCH above rewrites the text; without this the row kept the
         * ORIGINAL question list, so a teacher who asked for harder questions
         * got a card that said harder and still asked the easy ones.
         */
        if (quizQuestions?.length) {
          await api(`${path}/${replaceId}/sync`, {
            method: "POST",
            body: { questions: quizQuestions },
          }).catch((e) => console.warn("[studio] questions not replaced:", e.message));
        }
      } else if (quizQuestions?.length) {
        const totalMarks = quizQuestions.reduce((sum, q) => sum + (Number(q?.marks) || 0), 0);
        saved = await api("/api/quizzes/bulk", {
          method: "POST",
          body: {
            ...payload,
            ...(totalMarks > 0 ? { total_marks: totalMarks } : {}),
            questions: quizQuestions,
          },
        });
      } else {
        saved = await api(path, { method: "POST", body: payload });
      }

      return saved;
    };

    try {
      /**
       * The primary first, so its id is what schedules.
       *
       * FinaliseAndSchedule takes the returned row as the thing to put on
       * the timetable, and that has to be the lesson — not whichever
       * deliverable happened to be saved last.
       */
      const primaryGroup =
        groups.find((g) => g.parts.some((t) => t.kind === primary.kind)) || groups[0];
      const savedPrimary = await storeOne(primaryGroup, replaceId);

      /**
       * What the lesson knows, for the deliverables that do not.
       *
       * Read off the primary group's own head document rather than the saved
       * row, so this works whether the write returned the row or not.
       */
      const inherit = (() => {
        const head =
          SCHEDULABLE_KINDS.map((k) => primaryGroup.parts.find((t) => t.kind === k)).find(
            Boolean,
          ) || primaryGroup.parts[0];
        const facts = head ? statedFacts(head.text) : {};
        return {
          subject: pickedAud?.subject || facts.subject,
          grade: pickedAud?.grade || facts.grade,
          section: pickedAud?.section || facts.section,
        };
      })();

      /**
       * The rest, each into its own section.
       *
       * One failing must not lose the others or the lesson that already
       * saved, so each is caught on its own and reported rather than thrown.
       */
      const others = groups.filter((g) => g !== primaryGroup);
      const alsoSaved = [];
      for (const g of others) {
        try {
          const row = await storeOne(g, undefined, inherit);
          if (row) {
            const h = g.parts[0];
            alsoSaved.push({
              kind: h.kind,
              id: row.id,
              title: titleOf(h.kind, h.text, h.structured),
            });
          }
        } catch (e) {
          setNotice(`Saved the lesson, but the ${KIND_META[g.parts[0].kind]?.label || g.parts[0].kind} could not be kept: ${e.message}`);
        }
      }

      // Each card carries the id of the row it actually became, so "Open
      // quizzes" points at the quiz rather than at the lesson it came with.
      const byTurn = new Map();
      for (const { kind, id } of alsoSaved) byTurn.set(kind, id);
      const ids = new Set(batchTurns);
      setTurns((t) =>
        t.map((x) =>
          ids.has(x)
            ? { ...x, saved: true, artifactId: byTurn.get(x.kind) ?? savedPrimary?.id }
            : x,
        ),
      );
      /**
       * The other deliverables travel back with the primary.
       *
       * `schedule_entries` IS the assignment mechanism — a student sees work
       * by matching their grade and subject against a timetable row, and the
       * `assignments` table is empty and unused. So a quiz with no slot is a
       * quiz no student can ever open: saving it into the Quizzes section
       * fixed the teacher's half and left the class's half exactly as
       * broken. The caller schedules these once the lesson has its day.
       */
      return savedPrimary ? { ...savedPrimary, also: alsoSaved } : savedPrimary;
    } catch (e) {
      setNotice(`Couldn't save that: ${e.message}`);
      return null;
    }
  };

  // The teacher just kept something they liked — capture HOW it was made
  // as a reusable teaching skill. The service distils prompt + output
  // into a method profile; without it, a deterministic note (instruction
  // + reference excerpt) is still worth saving. Either way the row goes
  // browser→Supabase and future generations can be grounded in it.
  const empty = turns.length === 0;

  const when = (iso) => {
    const d = new Date(iso);
    /**
     * Never a negative age.
     *
     * The row is stamped by the database and read by a browser whose clock
     * is its own: a few seconds of skew made the difference negative, which
     * fell straight through to the `days < 7` branch and printed
     * "-1 days ago" on a conversation created moments earlier. A timestamp
     * that appears to be in the future is simply now.
     */
    const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 864e5));
    if (days === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  // Which home the conversation list gets. Below md the shell's context
  // panel is not rendered at all, so the same list opens as a drawer.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const historySlot = useContextPanelSlot("Conversations", sessions.length);

  // ONE list, rendered into whichever home applies. Extracting it is what
  // lets the panel and the drawer stay honestly identical rather than two
  // copies that drift.
  const conversationList = (
    <>
      <button type="button" className={s.newChat} onClick={newChat}>
        <Plus size={15} className="text-accent flex-shrink-0" /> New conversation
      </button>
      <div className={s.railList}>
        {sessionsLoading ? (
          <ConversationListSkeleton />
        ) : sessions.length === 0 ? (
          <p className={s.railEmpty}>
            Nothing yet. Unpinned conversations are kept for {KEEP_DAYS} days — anything
            you save goes to your library and stays, and a pinned thread is kept until
            you delete it.
          </p>
        ) : (
          sessions.map((x) => (
            // Sibling buttons in a plain row, not a button inside a
            // role="button". Nesting them made the row's accessible name
            // swallow the second label, so a screen reader announced one
            // control offering both actions.
            <div
              key={x.session_id}
              className={s.railItem}
              data-on={x.session_id === sessionId}
              data-menu={menuFor === x.session_id || undefined}
            >
              {renamingId === x.session_id ? (
                /* Renamed in place. A dialog for one field is a dialog
                   for its own sake, and the row is where she is looking. */
                <input
                  className={s.railRename}
                  value={renameDraft}
                  autoFocus
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => commitRename(x.session_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    // Escape abandons: clear the id first so the blur that
                    // follows has nothing left to commit.
                    if (e.key === "Escape") { setRenamingId(null); e.currentTarget.blur(); }
                  }}
                  aria-label={`Rename conversation: ${x.title || "Untitled"}`}
                />
              ) : (
                <button
                  type="button"
                  className={s.railOpen}
                  onClick={() => { openSession(x.session_id); setDrawerOpen(false); }}
                  aria-current={x.session_id === sessionId ? "true" : undefined}
                >
                  {x.pinned_at
                    ? <Pin size={12} className="text-accent flex-shrink-0 mt-1 self-start" />
                    : <MessageSquare size={13} className="text-muted flex-shrink-0 mt-0.5 self-start" />}
                  <span className={s.railItemText}>
                    <span className={s.railItemTitle}>{x.title || "Untitled"}</span>
                    <span className={s.railItemWhen}>{when(x.updated_at || x.created_at)}</span>
                  </span>
                </button>
              )}

              <div className={s.railMenuWrap}>
                <button
                  type="button"
                  className={s.railDel}
                  /* Stops the document listener that closes menus from
                     seeing this click and shutting the one being opened. */
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor((cur) => (cur === x.session_id ? null : x.session_id));
                  }}
                  aria-haspopup="menu"
                  aria-expanded={menuFor === x.session_id}
                  aria-label={`More for: ${x.title || "Untitled"}`}
                >
                  <MoreHorizontal size={14} />
                </button>

                {menuFor === x.session_id && (
                  <div className={s.railMenu} role="menu" onClick={(e) => e.stopPropagation()}>
                    <button type="button" role="menuitem" className={s.railMenuItem}
                            onClick={() => togglePin(x)}>
                      {x.pinned_at ? <PinOff size={13} /> : <Pin size={13} />}
                      {x.pinned_at ? "Unpin" : "Pin to top"}
                    </button>
                    <button type="button" role="menuitem" className={s.railMenuItem}
                            onClick={() => startRename(x)}>
                      <Pencil size={13} /> Rename
                    </button>
                    <button type="button" role="menuitem" className={s.railMenuItem} data-danger
                            onClick={() => { setMenuFor(null); setConfirmDelete(x); }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {/* The retention rule, where the threads actually are. It used to
            live only on the empty state — the one screen a teacher with
            conversations never sees — so the 30-day deletion was a
            surprise. Pinning is the way out, and this is where it says so. */}
        {sessions.length > 0 && (
          <p className={s.railEmpty}>
            Unpinned conversations are kept for {KEEP_DAYS} days. Pin one to keep it;
            saved work stays in your library either way.
          </p>
        )}
      </div>
    </>
  );

  /**
   * A yes before a delete that cannot be taken back.
   *
   * The bin used to remove the conversation on the click. It is one press
   * next to the row she opens every day, the messages cascade with it,
   * and there is no undo — so the only protection was hoping she did not
   * miss. Asking costs one keystroke and saves the case that cannot be
   * repaired.
   *
   * The window.confirm() used elsewhere in the app was the other option.
   * It is a browser chrome dialog that names the site rather than the
   * thing, cannot show WHICH conversation is about to go, and looks like
   * a phishing prompt in the middle of a teacher's own work.
   */
  const deleteDialog = confirmDelete && (
    <>
      <div
        className={s.confirmScrim}
        /* Closes on a press that STARTS here — the click that opened the
           dialog ends on a scrim that did not exist when it began. */
        onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        aria-hidden="true"
      />
      <div className={s.confirmBox} role="alertdialog" aria-modal="true"
           aria-labelledby="del-title" aria-describedby="del-body">
        <h2 id="del-title" className={s.confirmTitle}>Delete conversation</h2>
        <p id="del-body" className={s.confirmBody}>
          Are you sure you want to delete{" "}
          <strong className="text-ink font-medium">{confirmDelete.title || "Untitled"}</strong>?
          {" "}The documents you saved from it stay in your library; the conversation does not.
        </p>
        <div className={s.confirmRow}>
          {/* Cancel takes the focus, not Delete: a dialog that answers
              itself on Enter is not a question. */}
          <button type="button" autoFocus className={s.confirmCancel}
                  onClick={() => setConfirmDelete(null)}>
            Cancel
          </button>
          <button type="button" className={s.confirmGo}
                  onClick={() => { const id = confirmDelete.session_id; setConfirmDelete(null); removeSession(id); }}>
            Delete
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className={s.shell}>
      {deleteDialog}
      {presentingHtml && (
        <div className={s.present} role="dialog" aria-label="Presentation">
          <button
            type="button"
            className={s.presentClose}
            onClick={() => setPresentingHtml(null)}
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
          <iframe
            className={s.presentFrame}
            title="Presentation"
            srcDoc={presentingHtml}
            sandbox=""
          />
        </div>
      )}
      {/* Only once it is worth interrupting for: nothing above 20% left,
          because a banner she sees every day is one she stops reading. */}
      <div className="px-4 pt-3 max-w-[760px] mx-auto w-full">
        <CreditWarning credits={credits} />
      </div>
      <div className={s.thread} ref={threadRef}>
        {loadingThread ? (
          // `loadingThread` was set on both edges of openSession and then
          // never read, so reopening a conversation left the previous one on
          // screen until the new turns replaced it.
          <ThreadSkeleton />
        ) : empty ? (
          <div className={s.hero}>
            <h1 className={s.heroTitle}>
              What are we making, <em>today?</em>
            </h1>
            <p className="text-sm text-ink-soft mt-3">
              Describe it in your own words. Attach a chapter or a syllabus and it will be used.
            </p>
            <div className={s.starters}>
              {STARTERS.map((x) => (
                <button
                  key={x.text}
                  type="button"
                  className={s.starter}
                  onClick={() => { setKinds([x.kind]); send(x.text, x.kind); }}
                >
                  <span className={s.starterKind}>{KIND_META[x.kind].label}</span>
                  <span className={s.starterText}>{x.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={s.threadInner}>
            {turns.map((turn, i) => {
              /**
               * One offer per conversation, at the end of it.
               *
               * (An earlier version offered to distil the conversation into
               * a teaching skill here. Teaching skills are written in one
               * place now — the interview — so nothing reads a thread for
               * them any more.)
               */
              /**
               * The one question asked before writing anything.
               *
               * Rendered as a turn rather than a modal so it reads as the
               * studio talking back, which is what the rest of this screen
               * is. Answering it replaces the turn with the real generation.
               */
              /** A short statement from the studio — no document attached. */
              if (turn.role === "note") {
                return (
                  <div key={i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <p className="flex-1 min-w-0 text-[13px] text-ink">{turn.text}</p>
                  </div>
                );
              }

              if (turn.role === "ask") {
                return (
                  <div key={i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-ink">{turn.question}</p>
                      {turn.answered ? (
                        <p className="text-[12px] text-muted mt-1">{turn.answered}</p>
                      ) : (
                        <form
                          className="flex flex-wrap gap-2 mt-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const value = (askDraft[i] || "").trim();
                            if (!value) return;
                            setTurns((t) => t.map((x, j) => (j === i ? { ...x, answered: value } : x)));
                            // Her answer is folded into the request, so the
                            // generator sees one brief rather than a
                            // conversation it has no memory of.
                            const merged = declined(value)
                              ? turn.pending
                              : `${turn.pending} (${value})`;
                            send(merged, turn.kind || undefined, { skipAsk: true });
                          }}
                        >
                          <input
                            autoFocus
                            value={askDraft[i] || ""}
                            onChange={(e) => setAskDraft((d) => ({ ...d, [i]: e.target.value }))}
                            placeholder="Grade 5 science, one period"
                            aria-label="The details for this request"
                            className="flex-1 min-w-[200px] rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink"
                          />
                          <button type="submit" className={s.chipBtn} data-primary>
                            Generate
                          </button>
                          <button
                            type="button"
                            className={s.chipBtn}
                            onClick={() => {
                              setTurns((t) => t.map((x, j) => (j === i ? { ...x, answered: "You decide" } : x)));
                              send(turn.pending, turn.kind || undefined, { skipAsk: true });
                            }}
                          >
                            You decide
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              }

              if (turn.role === "user") {
                return (
                  <div key={i} className={s.turn} data-role="user">
                    <div>
                      {turn.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end mb-1.5">
                          {turn.attachments.map((a) => (
                            <span key={a.path} className={s.attach}>
                              <FileText size={12} className="text-accent flex-shrink-0" />
                              <span className="truncate">{a.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={s.userBubble}>{turn.text}</div>
                    </div>
                  </div>
                );
              }

              /**
               * The agent talking.
               *
               * Prose beside the avatar, not a card: this is the half of
               * the conversation that is an answer rather than a
               * document, and putting it in an artifact card with a Save
               * button under it was how a one-line reply used to end up
               * looking like something she had to file.
               */
              if (turn.role === "say") {
                return (
                  <div key={i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <div className="flex-1 min-w-0">
                      {turn.text ? (
                        <p className={s.said}>{turn.text}</p>
                      ) : (
                        <Working label="Thinking" />
                      )}
                    </div>
                  </div>
                );
              }

              /* The plan, waiting on her. */
              if (turn.role === "outline") {
                return (
                  <div key={turn.id || i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <OutlinePlan
                        turn={turn}
                        busy={busy}
                        onGenerate={(slides) => {
                          /*
                             Her approved plan goes back as the request. The
                             agent reads it as the brief and writes the deck
                             from exactly these slides, in this order — which
                             is why the list is sent in full rather than as
                             "the outline above": the agent's next turn does
                             not see this component's state.
                          */
                          const plan = slides
                            .map((x, n) => `${n + 1}. ${x.title}${x.description ? ` — ${x.description}` : ""}${x.layout ? ` [${x.layout}]` : ""}`)
                            .join("\n");
                          /* A written deck styles itself from the design
                             direction above; the six-tone palette only
                             applied to slides we drew ourselves. */
                          deckTheme.current = null;
                          send(
                            `Write the presentation now, from this approved outline. ` +
                              (turn.theme
                                ? `\n\nDesign direction for this deck — follow it: ${turn.theme}\n\n`
                                : "") +
                              `Follow it exactly: EXACTLY ${slides.length} slides, one for each ` +
                              `numbered row below, in that order, with that title. Do not add a ` +
                              `slide, do not merge two, do not split one. Count them before you ` +
                              `finish.` +
                              `${turn.theme ? ` Theme: ${turn.theme}.` : ""}` +
                              `${turn.grade ? ` ${turn.subject || ""} ${turn.grade}.` : ""}` +
                              `\n\n${plan}`,
                            "presentation",
                            { skipAsk: true, display: "Generate the deck" },
                          );
                        }}
                      />
                    </div>
                  </div>
                );
              }

              if (turn.role === "error") {
                return (
                  <div key={i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <div className={s.notice}>{turn.text}</div>
                      {/* The same brief goes back out — she never retypes
                          what a dropped connection cost her. Only on the
                          LAST error, so an old failure mid-thread does not
                          offer to redo work that has moved on since. */}
                      {turn.retry && i === turns.length - 1 && !NO_RETRY_CODES.has(turn.code) && (
                        <button
                          type="button"
                          className={`${s.chipBtn} mt-2`}
                          data-primary
                          disabled={busy}
                          onClick={() =>
                            send(turn.retry.text, undefined, {
                              kinds: turn.retry.kinds,
                              attachments: turn.retry.attachments,
                            })
                          }
                        >
                          <RotateCcw size={13} /> Try again
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              const meta = KIND_META[turn.kind] || {};
              /**
               * The structured deck when there is one, the markdown read as a
               * deck when there is not — a presentation should never render as
               * a wall of blockquotes just because a second model call came
               * back thin.
               */
              /**
               * A deck is a document the model wrote, not slides we draw.
               *
               * Described slides poured into our own components produced
               * the same composition every time and varied only the
               * accent colour. The presentation kind now emits its own
               * HTML — its palette, its layouts, its SVG diagrams — and
               * is rendered as written. Anything older, or anything that
               * came back as prose, still parses as before.
               */
              const htmlDeck =
                turn.kind === "presentation" && turn.done && isHtmlDeck(turn.text);
              const slides =
                htmlDeck
                  ? undefined
                  : namedSlides(turn.structured?.slides) ??
                    (turn.kind === "presentation" && turn.done
                      ? slidesFromMarkdown(turn.text)
                      : undefined);
              /** The same reading for a quiz: its own paper, parsed. */
              const questions =
                turn.structured?.questions ??
                (turn.kind === "quiz" && turn.done
                  ? questionsFromMarkdown(turn.text)
                  : undefined);
              /**
               * Show it while it is being written, not after.
               *
               * This was `turn.done && …`, so for the whole of a
               * generation the teacher saw a spinner and nothing else,
               * and the document appeared all at once at the end. The
               * words are arriving a token at a time and there is no
               * reason to hide them — watching it write is the single
               * clearest signal that anything is happening at all, and
               * it is worth more than any spinner.
               *
               * The structured viewers still wait for `done`: half a
               * deck is not a deck, and re-parsing markdown into slides
               * on every token would fight the text as it arrives.
               */
              /* The teacher's copy, shown under the paper rather than
                 discarded with the rest of the markdown. */
              const markScheme =
                turn.kind === "quiz" && turn.done ? markSchemeFromMarkdown(turn.text) : "";
              /**
               * A deck in progress shows a slide, not its source.
               *
               * The presentation kind writes an HTML document now, so
               * streaming it into the card put "<!doctype html>" and a
               * stylesheet on screen — the one document whose raw form
               * is meaningless to a teacher. Every other kind still
               * streams, because watching a lesson plan arrive is worth
               * more than any placeholder.
               */
              const deckPending = turn.kind === "presentation" && !turn.done;
              const showArtifact =
                !deckPending && Boolean(htmlDeck || slides || questions || turn.text);

              return (
                <div key={i} className={s.turn}>
                  <span className={s.avatar}><Sparkles size={15} /></span>
                  <div className="flex-1 min-w-0">
                    {/* The studio is working, and that is all it says.
                        A sentence naming the document was something a
                        teacher read once and then had to keep reading for
                        the rest of the wait. */}
                    {/* A deck being written: a slide-shaped placeholder,
                        because its source is not something to read. */}
                    {deckPending && (
                      <div className={s.deckPending} role="status" aria-live="polite">
                        <div className={s.deckPendingBar} />
                        <div className={s.deckPendingBar} data-w="short" />
                        <Working label="Designing the deck" />
                      </div>
                    )}

                    {/* Only for the gap before the first token. Once words
                        are arriving they are the progress indicator, and
                        showing both reads as two things happening. */}
                    {!deckPending && turn.streaming && !turn.text && (
                      <Working
                        label={`Writing the ${(KIND_META[turn.kind]?.label || "document").toLowerCase()}`}
                      />
                    )}

                    {showArtifact && (
                      <ArtifactCard
                        kind={turn.kind}
                        title={
                          /* A written deck's first line is "<!doctype html>",
                             which is not what a teacher should read on the
                             card. Its own <title> or first heading is. */
                          htmlDeck
                            ? (turn.text.match(/<title>([^<]{2,90})<\/title>/i)?.[1] ||
                               turn.text.match(/<h1[^>]*>([^<]{2,90})<\/h1>/i)?.[1] ||
                               "Presentation").trim()
                            : titleOf(turn.kind, turn.text, turn.structured)
                        }
                        actions={
                          /* One generation, one action. A lesson arrives as
                             three documents and a Save on each read as three
                             separate things to keep — she had to press all
                             three and could still end up with two thirds of a
                             lesson. The batch's own "Verify and finalise"
                             below keeps everything at once, so the per-card
                             button only appears where there is no batch
                             offer to replace it. */
                          inBatchOffer(turns, turn) ? (
                            turn.saved ? (
                              <span className={s.chipBtn} aria-disabled="true">
                                <Check size={13} /> Saved
                              </span>
                            ) : null
                          ) : (
                            <button
                              type="button"
                              className={s.chipBtn}
                              data-primary={!turn.saved}
                              disabled={turn.saved}
                              onClick={() =>
                                storeBatch(
                                  turn.batchId
                                    ? turns.filter(
                                        (x) => x.role === "assistant" && x.done && x.batchId === turn.batchId,
                                      )
                                    : [turn],
                                )
                              }
                            >
                              {turn.saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
                            </button>
                          )
                        }
                      >
                        {htmlDeck ? (
                          <DeckFrame
                            html={turn.text}
                            onFullscreen={(doc) => setPresentingHtml(doc)}
                          />
                        ) : slides ? (
                          /* The deck's own palette rides on its first slide,
                             which is where deckToneIndex() looks for it. */
                          <SlideViewer
                            slides={
                              turn.theme
                                ? slides.map((sl, n) => (n === 0 ? { ...sl, theme: turn.theme } : sl))
                                : slides
                            }
                            onFullscreen={(at) => setPresenting({ slides, at })}
                          />
                        ) : questions ? (
                          <>
                            <QuizViewer questions={questions} />
                            {markScheme && (
                              <details className={s.scheme}>
                                <summary>Mark scheme and what the marks tell you</summary>
                                <div className={s.reply}>{renderMarkdown(markScheme)}</div>
                              </details>
                            )}
                          </>
                        ) : (
                          // Prose artifacts can be rewritten a section at a
                          // time (/api/studio/regenerate). A rewrite makes
                          // the turn saveable again — the library copy
                          // would otherwise be the stale text.
                          /*
                             While it writes, the plain reading. Finished,
                             the rewritable one.

                             RewritableBody splits the document into
                             editable sections on every render, and during
                             a stream that runs on every animation frame
                             over a document that is still growing — the
                             section boundaries move as headings arrive,
                             so React rebuilds the subtree instead of
                             extending it, and the text visibly jumps.
                             Nothing on it is usable mid-stream anyway:
                             there is no point offering to rewrite a
                             paragraph that is still being written.
                          */
                          turn.done ? (
                            <RewritableBody
                              markdown={turn.text}
                              kind={turn.kind}
                              onChange={(next) =>
                                setTurns((t) => t.map((x, j) => (j === i ? { ...x, text: next, saved: false } : x)))
                              }
                            />
                          ) : (
                            <div className={`${s.reply} ${s.streamingBody}`}>
                              {renderMarkdown(turn.text)}
                            </div>
                          )
                        )}
                      </ArtifactCard>
                    )}

                    {/* Offered on the LAST finished document of a batch, so a
                        lesson is finalised once — after all three have
                        arrived — rather than on whichever card she happens to
                        be looking at.

                        Keyed off the batch rather than off a particular kind:
                        asking for a change regenerates a batch that may be
                        one document or three, and pinning the offer to
                        `student_notes` meant a reworked draft finished with
                        no way to keep or schedule it at all. */}
                    {turn.done && batchOffer(turns, turn, i) && (
                      <FinaliseAndSchedule
                        primaryKind={batchOffer(turns, turn, i).primaryKind}
                        label={batchOffer(turns, turn, i).label}
                        section={batchOffer(turns, turn, i).section}
                        turns={batchOffer(turns, turn, i).turns}
                        planned={plannedAudienceOf(batchOffer(turns, turn, i).turns)}
                        replaces={
                          lastKept &&
                          /**
                           * Never a rework of itself.
                           *
                           * Saving a batch records it as the last kept work.
                           * Its own widget then re-rendered, compared the
                           * batch against itself, scored a perfect match and
                           * offered to "update" the lesson it had just
                           * written — so a finished card sprouted a live
                           * button again, above whatever she generated next.
                           */
                          lastKept.batchId !== turn.batchId &&
                          isRework({
                            previous: lastKept,
                            prompt: turn.prompt,
                            title: titleOf(turn.kind, turn.text, turn.structured),
                          })
                            ? lastKept
                            : null
                        }
                        onKept={({ primaryId: keptId }) => {
                          const offer = batchOffer(turns, turn, i);
                          const primary =
                            offer.turns.find((x) => x.kind === offer.primaryKind) || turn;
                          setLastKept({
                            batchId: turn.batchId ?? null,
                            // Short enough to read inside a button. The raw
                            // heading can run to the whole metadata line.
                            title: titleOf(primary.kind, primary.text, primary.structured)
                              .replace(/\s*·.*$/, "")
                              .slice(0, 48),
                            prompt: turn.prompt || "",
                            id: keptId,
                          });
                        }}
                        save={(batchTurns, replaceId) => storeBatch(batchTurns, replaceId)}
                        onScheduled={(artifactId, entry) => stampCardFields(turn.kind, artifactId, entry)}
                      />
                    )}

                    {turn.stopped && (
                      <p className="text-[12px] text-muted mt-2">Stopped.</p>
                    )}

                    {turn.done && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <button
                          type="button" className={s.chipBtn}
                          /* Puts the request in the composer instead of
                             firing it. It used to send "Rework that:" the
                             instant she clicked, so there was no moment at
                             which she could say WHAT to change — the model
                             got a bare instruction and guessed. */
                          onClick={() => {
                            setDraft("Rework that: ");
                            document.querySelector("textarea")?.focus();
                          }}
                        >
                          <RotateCcw size={13} /> Ask for a change
                        </button>
                        {/*
                          The offer stands until it is taken.
                          
                          It used to appear only on a document kept in this
                          page, so closing the chat removed it — and a teacher
                          who came back to a thread she liked had no way to
                          keep the method from it. It shows on any finished
                          document, in a new thread or an old one, and goes
                          only once a skill has been made from the conversation.
                        */}
                        {meta.section && (
                          <button
                            type="button" className={s.chipBtn}
                            // Client navigation, not a location change: a
                            // full page load threw away the composer draft
                            // and every unsaved turn on screen.
                            onClick={() => navigate([meta.section])}
                          >
                            Open {(SECTION_FOR_KIND[turn.kind] || `${meta.label}s`).toLowerCase()}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={s.composerWrap}>
        {/* What this class found hard last time, from marks already in
            the table. Above the composer because it is context for what
            she is about to write, not a verdict on what she wrote. */}
        <ClassSignal
          cls={pickedClass}
          onUse={(lead) => setDraft((d) => (d ? `${lead}${d}` : lead))}
        />
        <div className={s.composer}>
          {notice && (
            <p className="text-[12.5px] text-crit px-4 pt-3">{notice}</p>
          )}

          {attachments.length > 0 && (
            <div className={s.attachRow}>
              {attachments.map((a) => (
                <span key={a.path} className={s.attach}>
                  <FileText size={12} className="text-accent flex-shrink-0" />
                  <span className="truncate flex-1">{a.name}</span>
                  <button type="button" aria-label={`Remove ${a.name}`}
                          onClick={() => setAttachments((x) => x.filter((y) => y.path !== a.path))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            className={s.input}
            rows={1}
            value={draft}
            placeholder={
              kinds.length === 1
                ? `Describe the ${KIND_META[kinds[0]]?.label.toLowerCase() || "thing"} you need…`
                : `Describe it once — you'll get ${kinds.map((v) => KIND_META[v]?.label.toLowerCase()).join(" + ")}…`
            }
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks — on a desktop. On a
              // phone Enter is a newline, because there is a send button
              // and no keyboard-shortcut habit.
              if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 640) {
                e.preventDefault();
                send();
              }
            }}
          />

          <div className={s.composerBar}>
            <button
              type="button" className={s.iconBtn} onClick={() => fileRef.current?.click()}
              disabled={uploading} aria-label="Attach a syllabus or chapter" title="Attach"
            >
              <Paperclip size={17} />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              /* A scheme of work is usually a Word file and a reading is often
                 a .txt; both upload fine and both were unselectable. */
              accept="application/pdf,.pdf,.doc,.docx,.txt,.md,.csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,image/*"
                   className="hidden" onChange={attach} />

            <div className={s.kindRow}>
              {KINDS.map((k) => (
                <button
                  key={k.value} type="button" className={s.kindBtn}
                  data-on={kinds.includes(k.value)} onClick={() => toggleKind(k.value)}
                  aria-pressed={kinds.includes(k.value)}
                  title={kinds.includes(k.value) && kinds.length === 1 ? `${k.label} — at least one format stays on` : `Toggle ${k.label.toLowerCase()}`}
                >
                  <k.icon size={13} /> {k.label}
                </button>
              ))}
            </div>

            <ClassPicker
              onSelection={(cls) => { classSel.current = cls; setPickedClass(cls); }}
            />
            {/* The paperclip uploads; this attaches what she already has.
                Without it the same textbook was re-uploaded — and its
                read re-charged — for every lesson of the term. */}
            <MaterialPicker
              attached={attachments}
              audience={classSel.current}
              onPick={(att) =>
                setAttachments((a) => (a.some((x) => x.id === att.id) ? a : [...a, att]))
              }
            />
            <SkillsPicker version={skillsVersion} onSelection={(sel) => { skillSel.current = sel; }} />

            <span className="flex-1" />

            {/* Before she presses anything, and it moves as she ticks a
                format or attaches a file. */}
            <CreditEstimate
              credits={credits}
              kinds={kinds}
              hasMaterials={attachments.some(chargesRead)}
            />

            {busy ? (
              <button type="button" className={s.send} onClick={() => abortRef.current?.abort()} aria-label="Stop">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              // A file IS a request. The service accepts a prompt, materials or
              // both — this button required typed words, so a teacher who
              // attached a chapter and picked "Quiz" had nothing to press.
              <button
                type="button"
                className={s.send}
                disabled={!draft.trim() && !attachments.length}
                onClick={() => send()}
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted text-center mt-2 max-w-[760px] mx-auto">
          Murchid drafts; you decide. Check anything before it reaches a class.
        </p>
      </div>

      {/* ── conversations ───────────────────────────────────────────
          One list, two homes. On a laptop it is portalled into the
          shell's context panel so it sits beside the nav, in the same
          place on every visit and at a width this screen does not
          control. On a phone there is no room for a second column, so the
          same component opens as a drawer over the thread. */}
      {isDesktop ? (
        historySlot.render(conversationList)
      ) : (
        <>
          <button
            type="button"
            className={s.drawerBtn}
            onClick={() => setDrawerOpen(true)}
            aria-label="Show conversations"
          >
            <PanelLeftOpen size={16} />
            <span>{sessions.length || ""}</span>
          </button>
          {drawerOpen && (
            <div className={s.drawerScrim} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          )}
          <aside className={s.drawer} data-open={drawerOpen} aria-label="Conversations" aria-hidden={!drawerOpen}>
            <div className={s.drawerHead}>
              <span className={s.drawerTitle}>Conversations</span>
              <button
                type="button"
                className={s.iconBtn}
                onClick={() => setDrawerOpen(false)}
                aria-label="Hide conversations"
              >
                <XIcon size={16} />
              </button>
            </div>
            {conversationList}
          </aside>
        </>
      )}

      {presenting && (
        <SlideFullscreen
          slides={presenting.slides}
          start={presenting.at}
          onClose={() => setPresenting(null)}
        />
      )}
    </div>
  );
}
