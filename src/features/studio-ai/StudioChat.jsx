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
} from "lucide-react";
import { api } from "@/views/_shared";
import { useCredits, CreditEstimate, CreditWarning } from "./CreditMeter";
import { supabase } from "@/lib/supabaseClient";
import { facultyId } from "@/lib/data/session";
import { parseSections, renderMarkdown } from "@/lib/markdown";
import { MAJORS } from "@/lib/enums";
import {
  ArtifactCard, QuizViewer, SlideViewer, SlideFullscreen, DocViewer, KIND_META,
  slidesFromMarkdown,
  questionsFromMarkdown,
} from "./artifacts";
import { RewritableBody } from "./RewritableBody";
import { FinaliseAndSchedule } from "./FinaliseAndSchedule";
import { missingFrom, askFor, declined } from "./missingDetails";
import {
  isRework, isScheduleOnly, targetedKinds, asksToReschedule, namesNewWork, kindsNamedIn,
} from "./revision";
import { SkillsPicker } from "./SkillsPicker";
import {
  listSessions, createSession, appendMessage, loadSession, deleteSession, purgeOld, KEEP_DAYS,
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

const safeName = (name) =>
  name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";

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
  // History is a record, not an open decision. Anything reopened from a past
  // conversation is read-only as far as saving goes.
  if (turn.restored) return null;
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
   * Only the newest generation is on offer.
   *
   * Reworking without saving first left the superseded batch still showing
   * its own button, so the thread had two "save lesson & schedule" — one for
   * the version she had just replaced. Whichever she pressed, the other stayed
   * there inviting her to file the old one beside it.
   */
  const newest = [...turns].reverse().find((x) => x.role === "assistant" && x.done && !x.restored);
  if (newest && turns.indexOf(newest) !== index) return null;

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
  const toggleKind = (v) =>
    setKinds((prev) => {
      if (prev.includes(v)) return prev.length > 1 ? prev.filter((x) => x !== v) : prev;
      const on = new Set([...prev, v]);
      return KINDS.map((k) => k.value).filter((x) => on.has(x)); // canonical order
    });
  // Which skill profiles ground generation. The picker reports here;
  // send() reads it. Saving a new approach bumps the version so the
  // picker refetches and the new skill appears selected.
  const skillSel = useRef(null);
  const [skillsVersion, setSkillsVersion] = useState(0);
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
  // The id the CURRENT send belongs to. State would be a render behind:
  // a thread is created and its first two turns saved inside one call,
  // and setSessionId has not committed by the time they are written.
  const sessionRef = useRef(null);

  const refreshSessions = useCallback(() => {
    listSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    refreshSessions();
    purgeOld();
  }, [refreshSessions]);

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

  // The assistant's "make me a …" hand-off: seed the composer with the
  // action's payload so the teacher lands mid-thought rather than at a
  // blank box. Nothing is generated until they press send.
  useEffect(() => {
    import("@/shared/lib/assistantPrefill").then(({ takePrefill }) => {
      const pre = takePrefill("create_work");
      if (!pre) return;
      const text = [pre.prompt, pre.topic, pre.title, pre.description]
        .find((v) => typeof v === "string" && v.trim());
      if (text) setDraft(String(text).trim());
      if (typeof pre.kind === "string" && KIND_META[pre.kind]) setKinds([pre.kind]);
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

  /** Has this conversation already been turned into a skill? */
  const skillExistsForSession = async (id) => {
    if (!id) return false;
    try {
      const rows = await api("/api/skills");
      const list = Array.isArray(rows) ? rows : rows?.skills ?? [];
      return list.some((sk) => sk?.source_session_id === id);
    } catch {
      // Unknown is treated as "not taken": offering twice is a smaller harm
      // than never offering at all.
      return false;
    }
  };

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
      const taken = await skillExistsForSession(id);
      setSessionId(id);
      sessionRef.current = id;
      setTurns(taken ? turns_.map((t) => ({ ...t, skillSaved: true })) : turns_);
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

  const removeSession = async (id, e) => {
    e.stopPropagation();
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
  const abortRef = useRef(null);

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
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      const fid = await facultyId();
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) throw new Error(`"${f.name}" is over 25 MB.`);
        // Browser → Storage under the teacher's own session. A
        // server-side upload would need a service-role key, and nothing
        // in this system holds one.
        const path = `${uid}/studio/${Date.now()}-${safeName(f.name)}`;
        const { error } = await supabase.storage.from("imports").upload(path, f, {
          contentType: f.type || "application/octet-stream", upsert: false,
        });
        if (error) throw error;
        const { data: row } = await supabase
          .from("materials")
          .insert({ faculty_id: fid, file_name: f.name, file_path: path, mime_type: f.type, status: "uploaded" })
          .select("id").single();
        setAttachments((a) => [...a, { id: row?.id, name: f.name, path, mime: f.type }]);
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
     * A document answers what it is. It does not answer when she teaches it.
     *
     * Attaching a chapter used to silence every question, which was right for
     * the grade and the subject — they are on its first page — and wrong for
     * the calendar: no syllabus knows which Tuesday she has that class. So the
     * questions about the class are dropped when a file is attached, and the
     * questions about the timetable are always asked.
     */
    const CONTENT_QUESTIONS = new Set(["grade", "subject"]);

    if (!opts.skipAsk && !reworking) {
      // What is missing depends on what she is making: a quiz is booked
      // between two times, a lesson takes a period.
      const missing = missingFrom(prompt, spoken.length ? spoken : useKind ? [useKind] : kinds)
        .filter((m) => !(attachments.length && CONTENT_QUESTIONS.has(m)));
      if (missing.length) {
        setDraft("");
        setTurns((t) => [
          ...t,
          { role: "user", text: prompt, attachments },
          { role: "ask", question: askFor(missing), pending: prompt, kind: useKind || (spoken.length === 1 ? spoken[0] : null) },
        ]);
        return;
      }
    }
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
    const ks = isPartial
      ? partial
      : reworking && heldKinds.length && !useKind
        ? heldKinds
        : useKind
          ? [useKind]
          : spoken.length
            ? spoken
            : kinds;
    const k = ks[0];
    const atts = attachments;

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
      : prompt;

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

    try {
      // The shared SSE reader, not a hand-rolled one: it scans frames for
      // the `data:` line (a keep-alive comment or an `event:` line used
      // to make this parser drop the whole frame), separates a refusal
      // from a failure, and turns a code-less 404 into "not built yet".
      const { streamSSE } = await import("@/shared/lib/apiStream");

      // Generate is a batch protocol: `batch → status → scope →
      // artifact_start → delta(kind) → artifact → artifact_end → done`,
      // one start/end pair per requested kind. The composer's kind row
      // is a multi-select, so this is often a real batch — the handling
      // below rolls a new bubble per artifact, and each renders as its
      // own reply with its own viewer and Save.
      let acc = "", structured = null, savedId = null;
      // Every artifact in one request shares this. Without it the three
      // documents of a lesson are three unrelated rows, and nothing can find
      // the guide and the notes that belong to a plan.
      let curBatch = null;
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
        refusalAsAnswer: true,
        body: {
          kinds: ks,
          prompt: carried,
          materials: atts.map((a) => ({ id: a.id, name: a.name })),
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
        setTurns((t) => {
          const n = [...t];
          // Drop the empty placeholder rather than leaving a blank reply
          // above the error.
          if (n[n.length - 1]?.role === "assistant" && !n[n.length - 1].text) n.pop();
          return [...n, { role: "error", text: err.message }];
        });
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

  /**
   * Where each kind is stored.
   *
   * The guide and the notes used to fall through to `/api/drafts`, which
   * filed them as lesson plans — one lesson became three near-identical
   * entries in the library, none of them labelled for what it was.
   */
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
        primary.structured?.slides ??
        (primary.kind === "presentation" ? slidesFromMarkdown(primary.text) : undefined),
      // What the document says about itself, so the card has something to
      // show the moment it is saved.
      ...statedFacts(primary.text),
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
        return { subject: facts.subject, grade: facts.grade, section: facts.section };
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
  const captureSkill = async (turn, index) => {
    if (turn.skillSaving || turn.skillSaved) return;
    const promptText = (() => {
      for (let j = index - 1; j >= 0; j--) if (turns[j]?.role === "user") return turns[j].text;
      return "";
    })();
    /**
     * The corrections are the method.
     *
     * Only the kept document and the prompt beside it were ever sent, so
     * everything the teacher actually taught the studio was thrown away: she
     * asks for homework, reads it, says "make the questions come from their own
     * kitchen", reads it again, says "and one sentence of reasoning each" — and
     * the third version is the one she keeps. What she asked to change, and
     * what she stopped changing, states her standard far more plainly than the
     * final document does on its own.
     *
     * The service already asks for this ("read them as the strongest signal in
     * the input"); nothing was sending it. Earlier versions of the SAME kind in
     * this conversation now go too, each under the instruction that produced
     * it, oldest first, so the distillation can see the direction of travel.
     */
    const history = (() => {
      const rounds = [];
      for (let j = 0; j < index; j++) {
        const t = turns[j];
        // Every document in the thread, not only the same kind: a teacher who
        // fixed her homework and then made a quiz taught the studio the same
        // standard twice, and the quiz was being thrown away.
        if (t?.role !== "assistant" || !t.text) continue;
        let asked = "";
        for (let k = j - 1; k >= 0; k--) if (turns[k]?.role === "user") { asked = turns[k].text; break; }
        rounds.push(
          `### Earlier draft ${rounds.length + 1}\nShe asked: ${asked || "(the opening request)"}\n\n${t.text.slice(0, 2500)}`,
        );
      }
      // The last three: the direction is what matters, and a long thread
      // would crowd out the version she actually kept.
      return rounds.slice(-3).join("\n\n");
    })();

    const title = titleOf(turn.kind, turn.text, turn.structured);
    const label = (KIND_META[turn.kind]?.label || "material").toLowerCase();
    setTurns((t) => t.map((x, i) => (i === index ? { ...x, skillSaving: true } : x)));
    let name = `Approach: ${title}`.slice(0, 40);
    let profile = "";
    try {
      const { streamSSE } = await import("@/shared/lib/apiStream");
      let acc = "", done = null;
      await streamSSE("/api/studio/skill-profile", {
        body: {
          source: "artifact",
          artifact: {
            kind: turn.kind,
            prompt: promptText,
            content: [
              history &&
                `## What came before, and what she asked to change\n\n${history}`,
              `## The version she kept\nShe asked: ${promptText || "(not recorded)"}\n\n${(turn.text || "").slice(0, 6000)}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        },
        onEvent: (ev) => {
          if (ev.type === "delta" && typeof ev.text === "string") acc += ev.text;
          else if (ev.type === "done") done = ev;
        },
      });
      profile = String(done?.skill_profile || acc).trim();
      if (done?.name) name = String(done.name).slice(0, 60);
    } catch {
      /* distillation unavailable — fall through to the deterministic note */
    }
    if (!profile) {
      profile =
        `# Approach — ${title}\n\n` +
        `_Saved from an AI Studio ${label} the teacher wanted to reuse._\n\n` +
        `## The instruction that produced it\n\n${promptText || "(not recorded)"}\n\n` +
        `## How to reproduce it\n\nMatch the structure, difficulty and tone of the reference below when making similar ${label}s.\n\n` +
        `## Reference\n\n${(turn.text || "").slice(0, 2000)}`;
    }
    try {
      await api("/api/skills", {
        method: "POST",
        body: {
          name,
          source_type: "generation",
          skill_profile: profile,
          // Which conversation this came from, so the offer is not made twice.
          ...(sessionRef.current ? { source_session_id: sessionRef.current } : {}),
        },
      });
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, skillSaving: false, skillSaved: true } : x)));
      setSkillsVersion((v) => v + 1); // the picker refetches; new skill arrives selected
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, skillSaving: false } : x)));
      setNotice(`Couldn't save the approach: ${e.message}`);
    }
  };

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
        {sessions.length === 0 ? (
          <p className={s.railEmpty}>
            Nothing yet. Conversations you have here are kept for {KEEP_DAYS} days — anything
            you save goes to your library and stays.
          </p>
        ) : (
          sessions.map((x) => (
            // Two sibling buttons in a plain row, not a button inside a
            // role="button". Nesting them made the row's accessible name
            // swallow the delete label, so a screen reader announced one
            // control offering both actions.
            <div
              key={x.session_id}
              className={s.railItem}
              data-on={x.session_id === sessionId}
            >
              <button
                type="button"
                className={s.railOpen}
                onClick={() => { openSession(x.session_id); setDrawerOpen(false); }}
                aria-current={x.session_id === sessionId ? "true" : undefined}
              >
                <MessageSquare size={13} className="text-muted flex-shrink-0 mt-0.5 self-start" />
                <span className={s.railItemText}>
                  <span className={s.railItemTitle}>{x.title || "Untitled"}</span>
                  <span className={s.railItemWhen}>{when(x.updated_at || x.created_at)}</span>
                </span>
              </button>
              <button
                type="button"
                className={s.railDel}
                onClick={(e) => removeSession(x.session_id, e)}
                aria-label={`Delete conversation: ${x.title || "Untitled"}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className={s.shell}>
      {/* Only once it is worth interrupting for: nothing above 20% left,
          because a banner she sees every day is one she stops reading. */}
      <div className="px-4 pt-3 max-w-[760px] mx-auto w-full">
        <CreditWarning credits={credits} />
      </div>
      <div className={s.thread} ref={threadRef}>
        {empty ? (
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
            {turns.map((turn, i, all) => {
              /**
               * One offer per conversation, at the end of it.
               *
               * It was rendered under every document, so a thread with a
               * lesson, a quiz and an activity in it carried three buttons
               * that all did the same thing — and what they distil is the
               * whole conversation, not the document above them. It sits
               * under the last one, and once the approach has been taken
               * from this thread there is no button anywhere in it.
               */
              const takenAlready = all.some((t) => t.skillSaved);
              let lastDocIndex = -1;
              for (let j = all.length - 1; j >= 0; j--) {
                const t = all[j];
                if (t?.role === "assistant" && t.done && t.text) { lastDocIndex = j; break; }
              }
              const skillSlotHere = i === lastDocIndex;
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

              if (turn.role === "error") {
                return (
                  <div key={i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <div className={s.notice}>{turn.text}</div>
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
              const slides =
                turn.structured?.slides ??
                (turn.kind === "presentation" && turn.done
                  ? slidesFromMarkdown(turn.text)
                  : undefined);
              /** The same reading for a quiz: its own paper, parsed. */
              const questions =
                turn.structured?.questions ??
                (turn.kind === "quiz" && turn.done
                  ? questionsFromMarkdown(turn.text)
                  : undefined);
              const showArtifact = turn.done && (slides || questions || turn.text);

              return (
                <div key={i} className={s.turn}>
                  <span className={s.avatar}><Sparkles size={15} /></span>
                  <div className="flex-1 min-w-0">
                    {turn.streaming && !turn.text && (
                      <div className={s.thinking} aria-label="Working">
                        <span className={s.thinkDot} /><span className={s.thinkDot} /><span className={s.thinkDot} />
                        {turn.stage && (
                          <span className="text-[12px] text-muted ms-1">
                            {turn.stage === "planning" ? "planning the material" : turn.stage}
                          </span>
                        )}
                      </div>
                    )}

                    {/* While streaming, the text IS the answer. Once it
                        finishes, it becomes an artifact with the viewer
                        its kind deserves. */}
                    {turn.streaming && turn.text && (
                      <div className={s.reply}>
                        {renderMarkdown(turn.text)}
                        <span className={s.caret} aria-hidden="true" />
                      </div>
                    )}

                    {showArtifact && (
                      <ArtifactCard
                        kind={turn.kind}
                        title={titleOf(turn.kind, turn.text, turn.structured)}
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
                        {slides ? (
                          <SlideViewer slides={slides} onFullscreen={(at) => setPresenting({ slides, at })} />
                        ) : questions ? (
                          <QuizViewer questions={questions} />
                        ) : (
                          // Prose artifacts can be rewritten a section at a
                          // time (/api/studio/regenerate). A rewrite makes
                          // the turn saveable again — the library copy
                          // would otherwise be the stale text.
                          <RewritableBody
                            markdown={turn.text}
                            kind={turn.kind}
                            onChange={(next) =>
                              setTurns((t) => t.map((x, j) => (j === i ? { ...x, text: next, saved: false } : x)))
                            }
                          />
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
                        {(turn.saved || turn.restored) && skillSlotHere && (
                          takenAlready ? (
                            <span className={s.chipBtn} aria-disabled="true">
                              <Check size={13} /> Approach saved to Teaching skills
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={s.chipBtn}
                              data-primary
                              disabled={turn.skillSaving}
                              onClick={() => captureSkill(turn, i)}
                            >
                              <GraduationCap size={13} />
                              {turn.skillSaving ? "Capturing the approach…" : "Loved it? Save this approach as a skill"}
                            </button>
                          )
                        )}
                        {meta.section && (
                          <button
                            type="button" className={s.chipBtn}
                            onClick={() => { window.location.href = `/${meta.section}`; }}
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

            <SkillsPicker version={skillsVersion} onSelection={(sel) => { skillSel.current = sel; }} />

            <span className="flex-1" />

            {/* Before she presses anything, and it moves as she ticks a
                format or attaches a file. */}
            <CreditEstimate
              credits={credits}
              kinds={kinds}
              hasMaterials={attachments.length > 0}
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
