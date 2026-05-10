import React, { useEffect, useMemo, useRef, useState } from "react";
import { setNavGuard } from "../lib/route";
import {
  Sparkles, FileText, ClipboardList, GraduationCap,
  Layers, Users, Calendar, Save, Copy, Check, X, RotateCcw, FileDown,
  Send, Paperclip, Plus, Wand2, RefreshCw, Zap, Shuffle, Dices,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import { parseSections, joinSections, renderMarkdown } from "../lib/markdown";
import StudioCard from "./StudioCard";

// Same base URL the rest of the app uses (Vercel rewrites /api → Render in
// prod; same-origin in dev via the Vite middleware).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const KINDS = [
  {
    value: "lesson_plan",  label: "Lesson",     icon: FileText,
    oneliner: "Structured class plan",
    headline: "Make a lesson plan. Tell Mudir what to teach.",
    sample: "A 45-minute Grade 7 science lesson on photosynthesis with a hands-on starter, two activities, and a quick exit ticket.",
  },
  {
    value: "quiz",         label: "Quiz",       icon: GraduationCap,
    oneliner: "MCQ, T/F, short or essay",
    headline: "Make a quiz. Tell Mudir what to test.",
    sample: "8-question Grade 8 algebra quiz covering linear equations — mix of MCQ and short answer, total 20 marks.",
  },
  {
    value: "homework",     label: "Homework",   icon: ClipboardList,
    oneliner: "Take-home tasks",
    headline: "Make homework. Tell Mudir the focus.",
    sample: "Reading-comprehension homework for Grade 6 English on a short story — students answer 5 questions in writing.",
  },
  {
    value: "activity",     label: "Activity",   icon: Users,
    oneliner: "Pair, group or solo task",
    headline: "Plan an activity. Tell Mudir what learners explore.",
    sample: "Group activity for Grade 5 history: students roleplay a town hall debating the construction of the railway.",
  },
  {
    value: "presentation", label: "Slides",     icon: Layers,
    oneliner: "Slide-by-slide outline",
    headline: "Make slides. Tell Mudir what to cover.",
    sample: "8-slide intro deck on the water cycle for Grade 4.",
  },
  {
    value: "schedule",     label: "Schedule",   icon: Calendar,
    oneliner: "Weekly or term plan",
    headline: "Plan a schedule. Tell Mudir the timeframe.",
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

// --- Roulette wheel picker -------------------------------------------------

const SEGMENTS = KINDS.length;
const SEGMENT_DEG = 360 / SEGMENTS;

// Build a donut-slice (annular sector) path centered around the top of an
// SVG with origin at (0, 0). Used once for the static highlighter wedge that
// sits above the rotating wheel of labels.
const wedgePath = ({ centerDeg = -90, halfWidthDeg, innerR, outerR }) => {
  const a1 = ((centerDeg - halfWidthDeg) * Math.PI) / 180;
  const a2 = ((centerDeg + halfWidthDeg) * Math.PI) / 180;
  const o1 = [Math.cos(a1) * outerR, Math.sin(a1) * outerR];
  const o2 = [Math.cos(a2) * outerR, Math.sin(a2) * outerR];
  const i2 = [Math.cos(a2) * innerR, Math.sin(a2) * innerR];
  const i1 = [Math.cos(a1) * innerR, Math.sin(a1) * innerR];
  return `M ${o1[0]} ${o1[1]} A ${outerR} ${outerR} 0 0 1 ${o2[0]} ${o2[1]} L ${i2[0]} ${i2[1]} A ${innerR} ${innerR} 0 0 0 ${i1[0]} ${i1[1]} Z`;
};

// Roulette-style picker. Clicking any segment rotates the wheel so that
// segment lands under the static accent wedge at the top. Labels rotate
// with the wheel but each one counter-rotates so its text stays upright.
function StudioWheel({ value, onChange }) {
  const idx = Math.max(0, KINDS.findIndex((k) => k.value === value));
  const rotation = -idx * SEGMENT_DEG;
  const active = KINDS[idx];

  return (
    <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto aspect-square select-none">
      <div className="absolute inset-0 rounded-full bg-paper-cool border border-line shadow-[inset_0_2px_8px_rgba(0,0,0,0.04)]" />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="-50 -50 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={wedgePath({ halfWidthDeg: SEGMENT_DEG / 2 - 1, innerR: 22, outerR: 46 })}
          fill="var(--color-accent)"
        />
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const a = ((-90 + (i + 0.5) * SEGMENT_DEG) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 22}
              y1={Math.sin(a) * 22}
              x2={Math.cos(a) * 46}
              y2={Math.sin(a) * 46}
              stroke="var(--color-line)"
              strokeWidth="0.3"
              strokeDasharray="0.6 0.6"
              opacity="0.55"
            />
          );
        })}
      </svg>

      <div className="absolute inset-[30%] rounded-full bg-paper-warm border border-line/70" />

      {/* Selection pointer — sits above the wheel rim, points down. */}
      <svg
        className="absolute left-1/2 -translate-x-1/2 text-accent"
        style={{ top: "-14px" }}
        width="18" height="13" viewBox="0 0 16 11" fill="currentColor"
      >
        <path d="M8 11 L0 0 L16 0 Z" />
      </svg>

      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 750ms cubic-bezier(0.34, 1.18, 0.6, 1)",
        }}
      >
        {KINDS.map((k, i) => {
          const angle = -90 + i * SEGMENT_DEG;
          const x = Math.cos((angle * Math.PI) / 180) * 40;
          const y = Math.sin((angle * Math.PI) / 180) * 40;
          const isActive = i === idx;
          const Icon = k.icon;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => onChange(k.value)}
              className="absolute"
              style={{
                left: `${50 + x}%`,
                top: `${50 + y}%`,
                transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                transition: "transform 750ms cubic-bezier(0.34, 1.18, 0.6, 1)",
              }}
            >
              <div
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition ${
                  isActive
                    ? "text-paper-cool"
                    : "text-ink-soft hover:text-ink hover:bg-paper-warm/60"
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span className="font-sans text-[12px] tracking-wide font-medium">
                  {k.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="absolute inset-[30%] flex flex-col items-center justify-center text-center pointer-events-none">
        <p className="text-[10px] text-muted mb-0.5 uppercase tracking-wider">Make a</p>
        <h3 className="text-xl sm:text-2xl font-semibold text-ink leading-none mb-1 tracking-tight">
          {active.label}
        </h3>
        <p className="text-[10px] text-muted leading-snug px-2">
          {active.oneliner}
        </p>
      </div>
    </div>
  );
}

export default function Studio() {
  const [kind, setKind] = useState("lesson_plan");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
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
  // The "Ask Mudir to tweak" input. Submitting it regenerates the current
  // section with the typed hint as guidance.
  const [tweak, setTweak] = useState("");
  // Roulette popup — opened from the kind button on the picker view.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Pulse the kind button briefly each time the kind changes via the wheel.
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
  const docTitle = useMemo(() => {
    const text = sections.length ? joinSections(sections) : streamingText;
    const line = text.split(/\r?\n/).find((l) => /^#{1,3}\s+/.test(l));
    return line ? line.replace(/^#+\s*/, "").trim() : `${active?.label || ""} draft`;
  }, [sections, streamingText, active?.label]);

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

  // Wheel pick: spin to it, then fade the popup out so the user is back on
  // the brief screen with the new kind selected.
  const onPickFromWheel = (next) => {
    onPickKind(next);
    setPulseKey((n) => n + 1);
    // Hold long enough for the wheel's 750ms easing to land before closing.
    setTimeout(() => setPickerOpen(false), 700);
  };

  const surpriseMe = () => {
    const others = KINDS.filter((k) => k.value !== kind);
    const next = others[Math.floor(Math.random() * others.length)].value;
    onPickFromWheel(next);
  };

  const reset = () => {
    abortRef.current?.abort();
    setKind("lesson_plan");
    setPrompt("");
    setBusy(false);
    setStreamingText("");
    setResult(null);
    setSections([]);
    setError(null);
    setSavedDraftId(null);
    setTweak("");
  };

  // Consume the SSE stream from /api/studio/generate.
  const generate = async () => {
    if (!prompt.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true); setError(null); setResult(null);
    setStreamingText(""); setSavedDraftId(null);
    setSections([]);

    try {
      const res = await fetch(API_BASE + "/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt: prompt.trim() }),
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
            setResult({
              text: acc,
              kind: payload.kind,
              stop_reason: payload.stop_reason,
              usage: payload.usage,
            });
            setSections(parseSections(acc, payload.kind));
            setSectionIndex(0);
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
  //   ←/→  navigate result sections (when not typing)
  //   K    open the kind picker (when not typing, picker view only)
  //   Esc  close the kind picker
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      const inField = tag === "TEXTAREA" || tag === "INPUT";
      if (e.key === "Escape" && pickerOpen) {
        e.preventDefault();
        setPickerOpen(false);
      } else if (e.key === "ArrowLeft" && !inField && sections.length > 1) {
        setSectionIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" && !inField && sections.length > 1) {
        setSectionIndex((i) => Math.min(sections.length - 1, i + 1));
      } else if ((e.key === "k" || e.key === "K") && !inField && !pickerOpen && sections.length === 0 && !busy) {
        e.preventDefault();
        setPickerOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections.length, pickerOpen, busy]);

  // Reset / clamp the visible section index whenever sections change.
  useEffect(() => {
    if (sections.length === 0) {
      setSectionIndex(0);
    } else if (sectionIndex >= sections.length) {
      setSectionIndex(sections.length - 1);
    }
  }, [sections.length, sectionIndex]);

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

  const saveAsDraft = async () => {
    const text = fullText();
    if (!text) return;
    setSaving(true);
    try {
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
      <div className="max-w-6xl mx-auto pb-8">
        {/* Top bar: brand + crumb + actions */}
        <div className="flex items-center justify-between gap-4 mb-5 print:hidden flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-ink leading-none">
              AI <em className="italic font-light text-accent">studio</em>
            </h2>
            <span className="hidden md:block h-6 w-px bg-line" />
            <p className="hidden md:block font-mono text-[10px] uppercase tracking-[0.18em] text-muted truncate max-w-md">
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
            {(result?.kind ?? kind) === "lesson_plan" && (
              savedDraftId ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-sage inline-flex items-center gap-1.5 px-2">
                  <Check size={13} /> Saved #{savedDraftId}
                </span>
              ) : (
                <Button
                  variant="secondary"
                  onClick={saveAsDraft}
                  disabled={saving || !result}
                  className="text-xs px-3 py-1.5"
                >
                  <Save size={13} className="mr-1.5" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              )
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
                    <p className="text-xs text-muted inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      Generating…
                    </p>
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
                          {itemCount > 0 && (
                            <span className="hidden md:inline-block text-[11px] text-muted font-mono">
                              {itemCount}q
                            </span>
                          )}
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
                  // Pre-parse — show streaming text as it arrives
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-3 inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      {busy ? "Generating" : "Done"}
                    </p>
                    <pre className="whitespace-pre-wrap text-sm text-ink-soft leading-relaxed font-sans max-h-[60vh] overflow-y-auto">
                      {streamingText || (
                        <span className="text-muted">No content yet…</span>
                      )}
                      {busy && (
                        <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse align-text-bottom" />
                      )}
                    </pre>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-2">
                      Part {currentLetter} · {active?.label}
                      {items > 0 && <span className="text-muted ml-2">· {items} item{items === 1 ? "" : "s"}</span>}
                    </p>
                    <h3 className="font-serif text-2xl md:text-3xl font-medium text-ink mb-5 leading-tight">
                      {currentSection?.title}
                    </h3>

                    {/* Section content — keyed so the in-animation fires
                        on each navigation. */}
                    <div
                      key={`${sectionIndex}-${currentSection?.id}`}
                      className="studio-card-flip-in"
                    >
                      <div className="max-h-[55vh] overflow-y-auto rounded-md">
                        <StudioCard
                          section={currentSection}
                          onSave={(md) => setSectionMarkdown(currentSection.id, md)}
                          onRegenerate={(hint) => regenerateSection(currentSection.id, hint)}
                          onCancelRegenerate={() => cancelRegenerate(currentSection.id)}
                          onRemove={() => removeSection(currentSection.id)}
                        />
                      </div>
                    </div>

                    {/* Section action chips */}
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
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tweak input bar — always visible during generation + after. */}
        <div className="mt-4 print:hidden">
          <div
            className={`bg-paper-cool border rounded-2xl pl-4 pr-2 py-2 flex items-center gap-3 shadow-sm transition-all duration-200 ${
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

        {/* Footer hints + token usage */}
        {result && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted print:hidden">
            <span>{result.usage.input_tokens} input</span>
            <span>{result.usage.output_tokens} output</span>
            {result.usage.cache_read_input_tokens > 0 && (
              <span className="text-sage">{result.usage.cache_read_input_tokens} cache read</span>
            )}
            {result.usage.cache_creation_input_tokens > 0 && (
              <span className="text-gold">{result.usage.cache_creation_input_tokens} cache write</span>
            )}
            <span>stop: {result.stop_reason}</span>
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
      </div>
    );
  }

  // ----- picker view -------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="mb-5 md:mb-6">
        <h2 className="font-serif text-3xl md:text-4xl font-medium text-ink leading-tight">
          AI <em className="italic font-light text-accent">studio</em>
        </h2>
      </div>

      {/* Kind picker — single button that opens the roulette popup. */}
      <div className="mb-7">
        {(() => {
          const ActiveIcon = active?.icon;
          return (
            <button
              key={pulseKey}
              type="button"
              onClick={() => setPickerOpen(true)}
              title="Spin to change (K)"
              className="studio-kind-pulse inline-flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-full bg-ink text-paper-cool border border-ink shadow-sm hover:scale-[1.02] active:scale-[0.99] transition-all duration-200"
            >
              {ActiveIcon && <ActiveIcon size={15} strokeWidth={1.75} />}
              <span className="text-sm font-medium">{active?.label}</span>
              <span className="h-4 w-px bg-paper-cool/25" />
              <span className="inline-flex items-center gap-1 pl-0.5 pr-2 text-[11px] text-paper-cool/75 font-mono uppercase tracking-wider">
                <Shuffle size={11} />
                Spin
              </span>
            </button>
          );
        })()}
      </div>

      {/* Mudir prompt block */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 h-10 w-10 rounded-md bg-ink text-paper-cool font-serif text-base font-medium flex items-center justify-center shadow-sm">
          M
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">Mudir</p>
          <p className="font-serif text-xl md:text-2xl text-ink leading-snug">
            {active?.headline}
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

      {/* Big input card */}
      <div className="bg-paper rounded-2xl border border-line shadow-sm overflow-hidden focus-within:border-ink transition-colors duration-200">
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
            <ParamChip>{active?.oneliner}</ParamChip>
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
                <Sparkles size={11} className="text-accent" />
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

      {/* Roulette popup — backdrop click and Esc both close. Picking a
          segment spins the wheel, holds for the easing to land, then
          fades the popup out automatically. */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm studio-popup-fade"
            onClick={() => setPickerOpen(false)}
          />
          <div className="studio-popup-rise relative bg-paper-cool rounded-2xl border border-line shadow-2xl w-full max-w-md p-6 md:p-7">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              title="Close (Esc)"
              className="absolute top-3 right-3 h-8 w-8 rounded-md border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center text-ink-soft transition-colors duration-200"
            >
              <X size={14} />
            </button>

            <div className="mb-4 pr-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">Pick what to make</p>
              <h3 className="font-serif text-xl md:text-2xl font-medium text-ink leading-tight">
                Spin the <em className="italic font-light text-accent">wheel</em>
              </h3>
            </div>

            <StudioWheel value={kind} onChange={onPickFromWheel} />

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={surpriseMe}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors duration-200"
              >
                <Dices size={12} /> Surprise me
              </button>
              <p className="text-[11px] text-muted">
                <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper font-mono text-[10px] mr-1.5">Esc</kbd>
                close
              </p>
            </div>
          </div>
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
