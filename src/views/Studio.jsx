import React, { useEffect, useMemo, useRef, useState } from "react";
import { setNavGuard } from "../lib/route";
import {
  Sparkles, FileText, ClipboardList, GraduationCap,
  Layers, Users, Calendar, Save, Copy, Check, X, RotateCcw, FileDown,
  Send, Paperclip, Plus, Wand2, RefreshCw, Zap, Dices, ChevronDown,
  BookOpen, Gauge, Hash, Clock, Globe, HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import { parseSections, joinSections, renderMarkdown } from "../lib/markdown";
import StudioCard from "./StudioCard";
import {
  GRADE_LEVELS, MAJORS,
  QUIZ_QUESTION_COUNTS, QUIZ_DURATIONS, QUIZ_DIFFICULTIES,
  QUIZ_LANGUAGES, QUIZ_SECTIONS,
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
    value: "presentation", label: "Slides",     icon: Layers,
    oneliner: "Slide-by-slide outline",
    menuBlurb: "Deck for class",
    verb: "Make", inlineLabel: "slide deck",    suffix: "Tell Mudir what to cover.",
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

// Sample chips shown above the input. Hardcoded today; later they'll come
// from the user's actual recent prompts (localStorage or the API).
const RECENTS_BY_KIND = {
  lesson_plan:  ["Photosynthesis", "Pythagoras", "Story arc", "Buoyancy"],
  quiz:         ["Linear equations", "Quadratics", "Geometry: angles", "Statistics: mean & median"],
  homework:     ["Reading comp · Lesson 4", "Word problems", "Vocab review"],
  activity:     ["Town-hall debate", "Lab pair-up", "Gallery walk"],
  presentation: ["Water cycle", "World religions", "Plot diagram"],
  schedule:     ["Term 2 plan", "Forces & motion week", "Exam revision"],
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
};

// "Or try" pills under the input. Same data shape as recents but more
// directive — verbs the teacher might ask Mudir to do.
const SUGGESTIONS_BY_KIND = {
  lesson_plan:  ["Pop lesson from yesterday", "Re-teach what 8B got wrong", "Same lesson, harder"],
  quiz:         ["Pop quiz from Lesson 3", "Mid-term review (3 chapters)", "Re-teach what 8B got wrong"],
  homework:     ["Easier version for 6B", "Add 2 word problems", "Same idea, shorter"],
  activity:     ["Quick warm-up version", "Group of 4 instead", "Outdoor variant"],
  presentation: ["Add slide on examples", "Remove text-heavy slides", "Add a quiz at the end"],
  schedule:     ["Two-week version", "Compress to 3 days", "Add a review day"],
};

export default function Studio() {
  const [kind, setKind] = useState("lesson_plan");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  // Structured-quiz path: while the model is calling submit_quiz, the
  // backend streams raw partial-JSON chunks. We accumulate them only to
  // estimate progress (count "position": occurrences) — never parsed.
  const [quizPartial, setQuizPartial] = useState("");
  // Pre-prompt knobs the teacher can lock in before generating a quiz.
  // Every field is optional — left as "" / null the AI infers from prose.
  // Only surfaced when kind === "quiz".
  const [quizParams, setQuizParams] = useState(QUIZ_PARAMS_DEFAULTS);
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
  // When the teacher edited any correct_answer pre-save we surface a
  // confirmation modal that lists each change. Holds the diff rows
  // (null means closed).
  const [pendingAnswerConfirm, setPendingAnswerConfirm] = useState(null);
  // The "Ask Mudir to tweak" input. Submitting it regenerates the current
  // section with the typed hint as guidance.
  const [tweak, setTweak] = useState("");
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
  const recents = RECENTS_BY_KIND[kind] || [];
  const suggestions = SUGGESTIONS_BY_KIND[kind] || [];
  const currentSection = sections[sectionIndex];
  const currentLetter = sectionIndex >= 0 ? String.fromCharCode(65 + sectionIndex) : "";
  const tweakBusy = !!currentSection?.regenerating;

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
    setQuizPartial("");
    setQuizParams(QUIZ_PARAMS_DEFAULTS);
    setResult(null);
    setSections([]);
    setError(null);
    setSavedDraftId(null);
    setPendingAnswerConfirm(null);
    setTweak("");
  };

  // Consume the SSE stream from the studio endpoint. For kind=quiz we hit
  // the structured /api/studio/quiz path (tool-use → typed Quiz object);
  // every other kind uses the markdown /api/studio/generate path.
  const generate = async () => {
    if (!prompt.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true); setError(null); setResult(null);
    setStreamingText(""); setQuizPartial(""); setSavedDraftId(null);
    setSections([]);

    const isQuiz = kind === "quiz";
    try {
      const body = isQuiz
        ? { kind, prompt: prompt.trim(), params: quizParams }
        : { kind, prompt: prompt.trim() };
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
          } else if (payload.type === "json_delta") {
            // Quiz path — keep accumulating the partial JSON only as a
            // progress signal; final structured object arrives in `done`.
            setQuizPartial((prev) => prev + (payload.partial || ""));
          } else if (payload.type === "done") {
            if (payload.kind === "quiz" && payload.quiz) {
              // The result-watching effect rebuilds `sections` from the
              // structured quiz, so we just persist the result here. The
              // sidebar + right pane re-render automatically.
              // originalQuiz is a frozen snapshot of what the AI produced,
              // used at save-time to diff which correct_answers the teacher
              // edited and surface a "Are you sure?" confirmation.
              const aiQuiz = payload.quiz;
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
      if (e.key === "ArrowLeft" && !inField && sections.length > 1) {
        setSectionIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" && !inField && sections.length > 1) {
        setSectionIndex((i) => Math.min(sections.length - 1, i + 1));
      } else if ((e.key === "k" || e.key === "K") && !inField && sections.length === 0 && !busy) {
        e.preventDefault();
        openPicker();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections.length, pickerOpen, busy, cursor, kind]);

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
  useEffect(() => {
    const hasUnsaved = busy || !!streamingText || !!result || sections.length > 0;
    if (!hasUnsaved) return;

    const cleanupGuard = setNavGuard(() =>
      window.confirm(
        "You have an AI generation in progress or unsaved. Leave anyway?"
      )
    );
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cleanupGuard();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [busy, streamingText, result, sections.length]);

  const makeAnother = () => {
    abortRef.current?.abort();
    regenAbortsRef.current.forEach((c) => c.abort?.());
    regenAbortsRef.current.clear();
    setBusy(false);
    setStreamingText("");
    setResult(null);
    setSections([]);
    setSavedDraftId(null);
    setError(null);
    setTweak("");
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
        const created = await api("/api/quizzes/bulk", {
          method: "POST",
          body: {
            title: q.title || "Untitled quiz",
            subject: q.subject || null,
            grade: q.grade || null,
            duration_minutes: q.duration_minutes || null,
            total_marks: q.total_marks || null,
            instructions: q.instructions || null,
            status: "Draft",
            questions: (q.questions || []).map((qq, i) => ({
              position: qq.position ?? i + 1,
              type: qq.type,
              prompt: qq.prompt,
              choices: qq.choices ?? null,
              correct_answer: qq.correct_answer ?? null,
              marks: qq.marks ?? 1,
            })),
          },
        });
        setSavedDraftId(created.quiz.id);
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
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Apply the tweak input as guidance to regenerate the current section.
  const sendTweak = () => {
    const hint = tweak.trim();
    if (!hint || sections.length === 0 || tweakBusy) return;
    setTweak("");
    regenerateSection(currentSection.id, hint);
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

    return (
      <div className="max-w-6xl mx-auto pb-20">
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
              <FileDown size={13} className="mr-1.5" /> PDF
            </Button>
            <Button
              variant="secondary"
              onClick={copyToClipboard}
              disabled={!fullText()}
              className="text-xs px-3 py-1.5"
            >
              {copied
                ? <><Check size={13} className="mr-1.5" /> Copied</>
                : <><Copy size={13} className="mr-1.5" /> Copy</>}
            </Button>
            {savedDraftId ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-sage inline-flex items-center gap-1.5 px-2">
                <Check size={13} /> Saved #{savedDraftId}
              </span>
            ) : (
              <Button
                variant="secondary"
                onClick={handleSaveClick}
                disabled={saving || !result}
                className="text-xs px-3 py-1.5"
              >
                <Save size={13} className="mr-1.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
            {busy ? (
              <Button variant="secondary" onClick={cancel} className="text-xs px-3 py-1.5">
                <X size={13} className="mr-1.5" /> Cancel
              </Button>
            ) : (
              <Button onClick={makeAnother} className="text-xs px-3 py-1.5">
                <Sparkles size={13} className="mr-1.5" /> New
              </Button>
            )}
          </div>
        </div>

        {/* Two-column card: sidebar + right pane */}
        <Card className="studio-result-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
            {/* Sidebar — sections list */}
            <aside className="border-b md:border-b-0 md:border-r border-line bg-paper-warm/30 print:hidden">
              <div className="p-4 md:p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Sections</p>
                {sections.length === 0 ? (
                  busy ? (
                    <div className="space-y-1.5">
                      {previewSections.map((s, i) => {
                        const letter = String.fromCharCode(65 + i);
                        return (
                          <div
                            key={s.id || i}
                            className="studio-section-fade-in flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                          >
                            <span className="flex-shrink-0 h-7 w-7 rounded-md font-mono text-[11px] uppercase tracking-wider bg-ink text-paper-cool flex items-center justify-center">
                              {letter}
                            </span>
                            <span className="flex-1 min-w-0 text-sm text-ink-soft truncate">
                              {s.title || `Part ${letter}`}
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
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSectionIndex(i)}
                          title={s.title}
                          className={`group flex-shrink-0 md:flex-shrink md:w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-all duration-200 ${
                            isActive
                              ? "border-ink bg-paper-cool shadow-sm"
                              : "border-transparent hover:border-line hover:bg-paper-cool/60"
                          }`}
                        >
                          <span
                            className={`flex-shrink-0 h-7 w-7 rounded-md font-mono text-[11px] uppercase tracking-wider flex items-center justify-center transition-colors duration-200 ${
                              isActive
                                ? "bg-accent text-paper-cool"
                                : "bg-ink text-paper-cool group-hover:bg-ink-soft"
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-ink truncate">
                              {s.title || `Part ${letter}`}
                            </span>
                          </span>
                          {s.kind === "quiz_question" && s.question?.marks ? (
                            <span className="hidden md:inline-block text-[11px] text-muted font-mono">
                              {s.question.marks}m
                            </span>
                          ) : itemCount > 0 ? (
                            <span className="hidden md:inline-block text-[11px] text-muted font-mono">
                              {itemCount}q
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
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
                {sections.length === 0 ? (
                  // Pre-parse — for the markdown path render the streaming
                  // markdown live so the teacher sees real headings; for
                  // the structured-quiz path show a structured progress
                  // panel because the JSON tool input isn't human-readable.
                  kind === "quiz" ? (
                    <QuizStreamingPlaceholder partial={quizPartial} busy={busy} />
                  ) : (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-3 inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      {busy ? "Generating" : "Done"}
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
                        <p className="text-sm text-muted italic">Mudir is thinking…</p>
                      )}
                    </div>
                  </div>
                  )
                ) : (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-2">
                      Part {currentLetter} · {active?.label}
                      {sections.length > 1 && (
                        <span className="text-muted ml-2">· {sectionIndex + 1} of {sections.length}</span>
                      )}
                      {items > 0 && <span className="text-muted ml-2">· {items} item{items === 1 ? "" : "s"}</span>}
                    </p>
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
                      <div className="mb-4 rounded-lg border border-line bg-paper-warm/40 px-4 py-2.5 text-xs text-ink-soft leading-relaxed">
                        <span className="font-medium text-ink">Tip · </span>
                        Click any field to edit — the title, marks, choices, even which letter is correct. Changing the correct answer asks for confirmation before saving.
                      </div>
                    )}

                    <div
                      key={`${sectionIndex}-${currentSection?.id}`}
                      className="studio-card-flip-in"
                    >
                      <div className="max-h-[55vh] overflow-y-auto rounded-md">
                        {currentSection?.kind === "quiz_meta" ? (
                          <QuizMetaCard
                            quiz={result?.quiz}
                            onUpdate={updateQuiz}
                          />
                        ) : currentSection?.kind === "quiz_question" ? (
                          <QuizQuestionCard
                            question={currentSection.question}
                            index={sectionIndex - 1}
                            onUpdate={(patch) => updateQuestion(sectionIndex - 1, patch)}
                          />
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

                    {/* Keyboard hint — shown only when there's more than one
                        section to navigate between. */}
                    {sections.length > 1 && (
                      <p className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-muted">
                        <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] leading-none">←</kbd>
                        <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px] leading-none">→</kbd>
                        cycle sections
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tweak input bar — sticky at the bottom of the viewport so the
            teacher always sees it once generation starts. Hidden for
            structured quizzes (post-save editing happens in the QuizBuilder).
            Frosted-glass paper so content underneath stays subtly readable
            as you scroll. */}
        {result?.kind !== "quiz" && (
        <div className="sticky bottom-2 md:bottom-3 z-20 mt-5 print:hidden">
          <div
            className={`bg-paper-cool/95 backdrop-blur-md border rounded-2xl pl-4 pr-2 py-2 flex items-center gap-3 shadow-lg transition-all duration-200 ${
              tweak.trim() ? "border-ink" : "border-line"
            }`}
          >
            <Sparkles size={15} className={`flex-shrink-0 ${tweak.trim() ? "text-accent" : "text-muted"}`} />
            <input
              type="text"
              value={tweak}
              onChange={(e) => setTweak(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTweak(); } }}
              placeholder={
                sections.length
                  ? `Ask Mudir to tweak — e.g. 'make Part ${currentLetter} harder' or 'add 2 word problems'`
                  : busy
                    ? "Mudir is drafting — tweak will be ready when sections appear."
                    : "Ask Mudir to tweak…"
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
      </div>
    );
  }

  // ----- picker view -------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="mb-6 md:mb-7">
        <h2 className="font-serif text-4xl md:text-5xl font-medium text-ink leading-[1.05] tracking-tight">
          AI <em className="italic font-light text-accent">studio</em>
        </h2>
      </div>

      {/* Mudir prompt block — the kind noun-phrase inside the sentence is
          itself the picker. Teachers read the sentence, see one phrase
          styled like a tappable mini-card with an icon + chevron, and
          click it to swap the kind. No "spin" jargon needed. */}
      <div className="flex items-start gap-4 mb-7">
        <div className="flex-shrink-0 h-11 w-11 rounded-lg bg-ink text-paper-cool font-serif italic text-lg flex items-center justify-center shadow-sm">
          M
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Mudir</p>
          <p className="font-serif text-xl sm:text-2xl md:text-[1.75rem] text-ink leading-[1.45]">
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

      {/* Recent chips */}
      {recents.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted flex-shrink-0">Recent</p>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPrompt(`${r}.`)}
                className="px-3 py-1.5 rounded-full bg-paper-cool border border-line text-xs text-ink-soft hover:border-ink hover:bg-paper-warm transition-colors duration-200"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiz pre-prompt panel — dedicated block above the input card
          so the teacher can't miss it. Inside the input card it read
          as decoration; here it's clearly a settings step. */}
      {kind === "quiz" && (
        <QuizParamsPanel params={quizParams} onChange={setQuizParams} />
      )}

      {/* Big input card */}
      <div className="bg-paper-cool rounded-2xl border border-line shadow-sm overflow-hidden focus-within:border-ink transition-colors duration-200">
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              generate();
            }
          }}
          placeholder={active?.sample}
          className="w-full bg-transparent outline-none px-5 py-4 text-base text-ink placeholder:text-muted resize-none"
        />
        <div className="border-t border-line px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              title="Attach file (coming soon)"
              className="h-8 w-8 rounded-full border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition-colors duration-200"
            >
              <Paperclip size={14} />
            </button>
            {kind !== "quiz" && <ParamChip>{active?.oneliner}</ParamChip>}
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden sm:block text-xs text-muted italic">Mudir will fill the rest</p>
            <Button
              variant="danger"
              onClick={generate}
              disabled={!prompt.trim()}
              className="hover:scale-[1.02] active:scale-[0.99] transition-transform duration-200 px-4 py-2 text-sm"
            >
              <Send size={14} className="mr-1.5" />
              Make it
            </Button>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted flex-shrink-0">Or try</p>
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

      {/* Footer hints */}
      <div className="mt-7 flex items-center justify-between gap-3 text-[11px] text-muted flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px]">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px]">↵</kbd>
            <span>Generate</span>
          </span>
          <span className="text-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper-cool font-mono text-[10px]">K</kbd>
            <span>Pick</span>
          </span>
          <span className="text-line">·</span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 hover:text-accent transition-colors duration-200"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Zap size={11} />
          <span>usually ~12s</span>
        </div>
      </div>

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
        className={`studio-kind-pulse group inline-flex items-center gap-2 px-3.5 py-1 mx-1 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 transition-all duration-200 align-middle whitespace-nowrap text-[0.72em] font-sans font-medium tracking-normal cursor-pointer ${
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
          {active.label}
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
        className="studio-menu-rise absolute left-0 top-full mt-2 z-50 w-[26rem] sm:w-[28rem] max-w-[calc(100vw-2rem)] origin-top-left rounded-xl border border-line bg-paper-cool shadow-xl ring-1 ring-ink/5 overflow-hidden"
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
                        {k.label}
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

function QuizStreamingPlaceholder({ partial, busy }) {
  // Each question generated by the model contains a "position" key, so
  // counting those occurrences gives a rough live count. The model writes
  // JSON top-down, so we're underestimating until each block closes.
  const detected = (partial.match(/"position"\s*:/g) || []).length;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-3 inline-flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        {busy ? "Building quiz" : "Done"}
      </p>
      <div className="rounded-lg border border-line bg-paper-warm/40 p-5">
        <p className="font-serif text-lg text-ink leading-snug">
          Mudir is structuring your quiz<span className="italic text-accent">…</span>
        </p>
        <p className="text-sm text-muted mt-2">
          Picking question types, writing prompts, building the answer key.
        </p>
        <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-muted">
          {detected > 0
            ? `${detected} question${detected === 1 ? "" : "s"} drafted so far`
            : "Warming up"}
          {busy && (
            <span className="inline-block w-1.5 h-3 bg-accent ml-2 animate-pulse align-text-bottom" />
          )}
        </p>
      </div>
    </div>
  );
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
function QuizParamsPanel({ params, onChange }) {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section,
    params.difficulty, params.questions, params.duration,
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
    <div className="mb-4 rounded-2xl border border-line bg-paper-warm/40 px-4 md:px-5 py-4">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-0.5">
            Quiz settings
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            Pick the basics first <span className="italic text-muted">— or leave them blank and Mudir will figure it out.</span>
          </p>
        </div>
        {setCount > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent flex-shrink-0">
            {setCount} of 7 set
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label="Grade"
          slot="grade"
          emptyHint="Any grade"
          help="Which year group the quiz is for. Drives vocabulary and complexity (KG 1 keeps it visual, Grade 12 allows abstract reasoning)."
          value={params.grade}
          options={GRADE_LEVELS}
          onChange={(v) => set({ grade: v })}
          warning={CHIP_VALIDATORS.grade(params.grade)}
          onMoveTo={(target) => moveTo("grade", target)}
        />
        <DropdownChip
          icon={BookOpen}
          label="Major"
          slot="major"
          emptyHint="Any major"
          help="The school subject the quiz tests — Math, Biology, History, etc. Every question must stay on-topic for this major."
          value={params.major}
          options={MAJORS}
          onChange={(v) => set({ major: v })}
          warning={CHIP_VALIDATORS.major(params.major)}
          onMoveTo={(target) => moveTo("major", target)}
        />
        <DropdownChip
          icon={Globe}
          label="Language"
          slot="language"
          emptyHint="Auto (English)"
          help="The language the quiz will be written in. The whole output — questions, choices, answer key — comes back in this language."
          value={params.language}
          options={QUIZ_LANGUAGES}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label="Section"
          slot="section"
          emptyHint="All sections"
          help="Which class section the quiz is for (e.g. Grade 6 'A'). Doesn't change the questions much — mainly for filing and printing the cover page."
          value={params.section}
          options={QUIZ_SECTIONS}
          onChange={(v) => set({ section: v })}
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
      </div>
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
function DropdownChip({ icon: Icon, label, emptyHint, help, value, options, onChange, suffix, numeric, warning, onMoveTo }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const inputRef = useRef(null);

  // Re-seed draft from external value when the chip is closed (resets, etc.)
  useEffect(() => {
    if (!open) setDraft(value == null ? "" : String(value));
  }, [value, open]);

  // Focus + select the input as soon as it appears so typing just works.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

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

  const filteredOptions = useMemo(() => {
    if (!draft) return options;
    const q = String(draft).toLowerCase();
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [draft, options]);

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
        {help && (
          // Tiny info hint — hover shows the native tooltip with the
          // help text, so teachers learn what each field means without
          // a separate doc page or guided tour.
          <span title={help} className="inline-flex items-center text-muted/80 hover:text-accent cursor-help">
            <HelpCircle size={10} strokeWidth={1.75} />
          </span>
        )}
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
    <span className={`relative inline-block ${open ? "z-50" : ""}`}>
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
            <div className={`text-sm leading-tight ${
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
          <input
            ref={inputRef}
            type="text"
            inputMode={numeric ? "numeric" : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(draft); }
              else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            }}
            placeholder={emptyHint || "Type or pick…"}
            className="w-full bg-transparent outline-none text-sm text-ink font-medium leading-tight placeholder:text-muted placeholder:italic placeholder:font-normal"
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
          onPick={commit}
          onClose={() => commit(draft)}
        />
      )}
    </span>
  );
}

// Filtered menu that opens under a DropdownChip. Shows three regions:
//   1. "Use \"<draft>\" (custom)" — only when the draft text doesn't
//      match any preset; lets the teacher commit a free-form value.
//   2. "Any — let Mudir choose" — clears the field.
//   3. The filtered preset options.
function ComboboxMenu({ value, draft, options, allOptions, suffix, onPick, onClose }) {
  const trimmed = String(draft || "").trim();
  const isCustom =
    trimmed.length > 0 &&
    !allOptions.some((o) => String(o).toLowerCase() === trimmed.toLowerCase());
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
        className="studio-menu-rise absolute left-0 top-full mt-1.5 z-50 min-w-[14rem] max-h-[60vh] overflow-y-auto origin-top-left rounded-xl border border-line bg-paper-cool shadow-xl ring-1 ring-ink/5"
      >
        <ul className="py-1">
          {isCustom && (
            <>
              <li>
                <button
                  type="button"
                  onClick={() => onPick(trimmed)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-paper-warm/60"
                >
                  <span className="truncate">
                    Use <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
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
              onClick={() => onPick("")}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                !value
                  ? "bg-paper-warm text-ink font-medium"
                  : "text-ink-soft hover:bg-paper-warm/60"
              }`}
            >
              <span className="italic">Any — let Mudir choose</span>
              {!value && <Check size={13} className="text-accent" />}
            </button>
          </li>
          <li className="border-t border-line/60 my-1" />

          {options.length === 0 && !isCustom && (
            <li className="px-3 py-2 text-sm text-muted italic">No matches</li>
          )}

          {options.map((opt) => {
            const isActive = String(opt) === String(value);
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => onPick(opt)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                    isActive
                      ? "bg-paper-warm text-ink font-medium"
                      : "text-ink hover:bg-paper-warm/60"
                  }`}
                >
                  <span>
                    {opt}
                    {suffix && <span className="text-muted ml-1">{suffix}</span>}
                  </span>
                  {isActive && <Check size={13} className="text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
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

function QuizMetaCard({ quiz, onUpdate }) {
  if (!quiz) return null;
  const totalQ = (quiz.questions || []).length;
  // total_marks is derived from the question marks; updateQuestion already
  // recomputes it on each change, so the cover always matches reality.
  return (
    <div className="rounded-xl border border-line bg-paper-cool p-5 md:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
        Cover
      </p>
      <EditableText
        value={quiz.title || ""}
        onChange={(v) => onUpdate({ title: v })}
        placeholder="Quiz title"
        className="font-serif text-2xl md:text-3xl font-medium text-ink leading-tight mb-3 w-full"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft mb-4">
        <MetaField
          label="Subject"
          value={quiz.subject || ""}
          onChange={(v) => onUpdate({ subject: v })}
          placeholder="—"
        />
        <span className="text-line">·</span>
        <MetaField
          label="Grade"
          value={quiz.grade || ""}
          onChange={(v) => onUpdate({ grade: v })}
          placeholder="—"
        />
        <span className="text-line">·</span>
        <MetaField
          label="Duration"
          value={quiz.duration_minutes || ""}
          onChange={(v) => onUpdate({ duration_minutes: v === "" ? null : Number(v) })}
          placeholder="—"
          suffix="min"
          numeric
        />
        <span className="text-line">·</span>
        <span className="text-ink-soft">
          {totalQ} question{totalQ === 1 ? "" : "s"}
        </span>
        <span className="text-line">·</span>
        <span className="font-medium text-ink">
          {quiz.total_marks ?? 0} marks
        </span>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
          Instructions
        </p>
        <EditableTextarea
          value={quiz.instructions || ""}
          onChange={(v) => onUpdate({ instructions: v })}
          placeholder="Add instructions for students…"
          rows={2}
          className="text-sm text-ink-soft leading-relaxed w-full"
        />
      </div>
    </div>
  );
}

function QuizQuestionCard({ question, index, onUpdate }) {
  const [showAnswer, setShowAnswer] = useState(false);
  if (!question) return null;
  const typeLabel = QUIZ_TYPE_LABELS[question.type] || question.type;
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const correctLetter =
    typeof question.correct_answer === "string" && question.correct_answer.length === 1
      ? question.correct_answer.toUpperCase()
      : null;

  const updateChoice = (i, text) => {
    const next = choices.slice();
    next[i] = text;
    onUpdate({ choices: next });
  };

  return (
    <div className="rounded-xl border border-line bg-paper-cool p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Question {question.position ?? index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full border border-line bg-paper text-[11px] text-ink-soft">
            {typeLabel}
          </span>
          <span className="font-mono text-[11px] text-muted inline-flex items-center gap-1">
            <EditableNumber
              value={question.marks ?? 1}
              onChange={(v) => onUpdate({ marks: Math.max(1, Number(v) || 1) })}
              min={1}
              className="w-8 text-right"
            />
            <span>mark{question.marks === 1 ? "" : "s"}</span>
          </span>
        </div>
      </div>

      <EditableTextarea
        value={question.prompt || ""}
        onChange={(v) => onUpdate({ prompt: v })}
        placeholder="Question prompt"
        rows={2}
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
                  onClick={() => onUpdate({ correct_answer: letter })}
                  title={isCorrect ? "This is the correct answer" : "Mark as correct"}
                  className={`flex-shrink-0 h-6 w-6 rounded-md font-mono text-[11px] flex items-center justify-center transition-colors duration-200 ${
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
                onClick={() => onUpdate({ correct_answer: value })}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors duration-200 ${
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
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
            {question.type === "essay" ? "Rubric outline" : "Expected answer"}
          </p>
          <EditableTextarea
            value={
              typeof question.correct_answer === "string"
                ? question.correct_answer
                : ""
            }
            onChange={(v) => onUpdate({ correct_answer: v })}
            placeholder={
              question.type === "essay"
                ? "1–2 sentences describing what a strong response covers."
                : "Expected answer text."
            }
            rows={2}
            className="text-sm text-ink-soft leading-relaxed w-full"
          />
        </div>
      )}

      <div className="border-t border-line pt-3 mt-1 flex items-center justify-between gap-3">
        {!showAnswer ? (
          <button
            type="button"
            onClick={() => setShowAnswer(true)}
            className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted hover:text-accent transition-colors duration-200"
            title="Show the AI's marking key for this question. You can still edit the correct answer."
          >
            Show correct answer
          </button>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
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

function EditableText({ value, onChange, placeholder, className = "" }) {
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
      className={`bg-transparent outline-none border-b border-transparent hover:border-line/60 focus:border-ink focus:bg-paper transition-colors duration-150 placeholder:text-muted ${className}`}
    />
  );
}

function EditableTextarea({ value, onChange, placeholder, rows = 2, className = "" }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`bg-transparent outline-none rounded-md p-2 -m-2 border border-transparent hover:border-line/60 focus:border-ink focus:bg-paper resize-y transition-colors duration-150 placeholder:text-muted whitespace-pre-wrap ${className}`}
    />
  );
}

function EditableNumber({ value, onChange, min = 0, className = "" }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      className={`bg-transparent outline-none border-b border-transparent hover:border-line/60 focus:border-ink focus:bg-paper transition-colors duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}

function MetaField({ label, value, onChange, placeholder, suffix, numeric }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
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
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </span>
  );
}
