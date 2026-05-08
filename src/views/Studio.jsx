import React, { useRef, useState } from "react";
import {
  Sparkles, FileText, ClipboardList, GraduationCap,
  Layers, Users, Calendar, Save, Copy, Check, X, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import { parseSections, joinSections, renderMarkdown } from "../lib/markdown";
import StudioCard from "./StudioCard";

// Same base URL the rest of the app uses (Vercel rewrites /api → Render in
// prod; same-origin in dev via the Vite middleware).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Order matters — this is the clockwise order around the wheel starting at
// the top position (12 o'clock).
const KINDS = [
  { value: "lesson_plan",  label: "Lesson",     icon: FileText,      oneliner: "Structured class with starter, activities & exit ticket.", sample: "A 45-minute Grade 7 science lesson on photosynthesis with a hands-on starter, two activities, and a quick exit ticket." },
  { value: "quiz",         label: "Quiz",       icon: GraduationCap, oneliner: "MCQ, T/F, short or essay — ready to grade.",                sample: "8-question Grade 8 algebra quiz covering linear equations — mix of MCQ and short answer, total 20 marks." },
  { value: "homework",     label: "Homework",   icon: ClipboardList, oneliner: "Take-home tasks with grading criteria.",                    sample: "Reading-comprehension homework for Grade 6 English on a short story — students answer 5 questions in writing." },
  { value: "activity",     label: "Activity",   icon: Users,         oneliner: "Pair, group, or individual classroom exercise.",            sample: "Group activity for Grade 5 history: students roleplay a town hall debating the construction of the railway." },
  { value: "presentation", label: "Slides",     icon: Layers,        oneliner: "Slide-by-slide outline ready to refine.",                   sample: "8-slide intro deck on the water cycle for Grade 4." },
  { value: "schedule",     label: "Schedule",   icon: Calendar,      oneliner: "Weekly plan or term timeline.",                             sample: "A weekly schedule for Grade 7 Science covering forces and motion across one week (5 days, ~50 min each)." },
];

const SEGMENTS = KINDS.length;
const SEGMENT_DEG = 360 / SEGMENTS;
const DEFAULT_KIND = "lesson_plan";

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
// segment lands under the static accent wedge at the top. Labels rotate with
// the wheel but each one counter-rotates so its text stays upright.
function StudioWheel({ value, onChange }) {
  const idx = Math.max(0, KINDS.findIndex((k) => k.value === value));
  const rotation = -idx * SEGMENT_DEG;
  const active = KINDS[idx];

  return (
    <div className="relative w-full max-w-[440px] mx-auto aspect-square select-none">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full bg-paper-cool border border-line shadow-[inset_0_2px_8px_rgba(0,0,0,0.04)]" />

      {/* Static highlighter wedge — accent fills the top segment */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="-50 -50 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={wedgePath({ halfWidthDeg: SEGMENT_DEG / 2 - 1, innerR: 26, outerR: 47 })}
          fill="var(--color-accent)"
        />
        {/* Faint dotted radial dividers between segments */}
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const a = ((-90 + (i + 0.5) * SEGMENT_DEG) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 26}
              y1={Math.sin(a) * 26}
              x2={Math.cos(a) * 47}
              y2={Math.sin(a) * 47}
              stroke="var(--color-line)"
              strokeWidth="0.3"
              strokeDasharray="0.6 0.6"
              opacity="0.55"
            />
          );
        })}
      </svg>

      {/* Inner cream disc — the "stage" where the active kind name sits */}
      <div className="absolute inset-[26%] rounded-full bg-paper-warm border border-line/70" />

      {/* Down-arrow indicator above the active wedge (fixed; doesn't rotate) */}
      <svg
        className="absolute left-1/2 -translate-x-1/2 text-accent"
        style={{ top: "1.5%" }}
        width="14" height="10" viewBox="0 0 14 10" fill="currentColor"
      >
        <path d="M7 10 L0 0 L14 0 Z" />
      </svg>

      {/* Rotating layer with labels. Cubic-bezier with a touch of overshoot
          gives that "roulette wheel settling" feel. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 750ms cubic-bezier(0.34, 1.18, 0.6, 1)",
        }}
      >
        {KINDS.map((k, i) => {
          const angle = -90 + i * SEGMENT_DEG;
          const x = Math.cos((angle * Math.PI) / 180) * 36; // 36% out from center
          const y = Math.sin((angle * Math.PI) / 180) * 36;
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
                // First centers the button on its anchor, then counter-rotates
                // so the icon + text stay upright as the wheel spins.
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

      {/* Center content — fixed, doesn't rotate */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12 pointer-events-none">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted mb-2">
          Make a
        </p>
        <h3 className="font-serif italic text-[40px] leading-none text-ink mb-3">
          {active.label}
        </h3>
        <p className="text-xs text-muted leading-relaxed max-w-[170px]">
          {active.oneliner}
        </p>
      </div>
    </div>
  );
}

export default function Studio() {
  const [kind, setKind] = useState(DEFAULT_KIND);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [result, setResult] = useState(null);
  // Sections are the editable per-card breakdown of the result. They start
  // as the parsed structure of streamingText and are then mutated as the
  // user edits or regenerates individual cards.
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState(null);
  const abortRef = useRef(null);
  // One AbortController per regenerating section, keyed by section id, so
  // each card can be cancelled independently.
  const regenAbortsRef = useRef(new Map());

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

  const reset = () => {
    abortRef.current?.abort();
    setKind(DEFAULT_KIND);
    setPrompt("");
    setBusy(false);
    setStreamingText("");
    setResult(null);
    setError(null);
    setSavedDraftId(null);
  };

  // Consume the SSE stream from /api/studio/generate. Each `delta` event
  // appends to `streamingText` so the UI re-renders as tokens arrive; the
  // final `done` event carries the same shape we used to return as JSON,
  // so Save / Copy / token-strip logic stays unchanged.
  const generate = async () => {
    if (!prompt.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true); setError(null); setResult(null);
    setStreamingText(""); setSavedDraftId(null);

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
            // Parse the final text into editable section cards.
            setSections(parseSections(acc, payload.kind));
          } else if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        // Non-abort failure → drop any partial output so the wheel comes back
        // and the user sees the error banner above it.
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

  // "Make another" — return to the wheel without throwing away the prompt /
  // selected kind so the user can tweak and regenerate quickly.
  const makeAnother = () => {
    abortRef.current?.abort();
    // Cancel any in-flight section regenerations too.
    regenAbortsRef.current.forEach((c) => c.abort?.());
    regenAbortsRef.current.clear();
    setBusy(false);
    setStreamingText("");
    setResult(null);
    setSections([]);
    setSavedDraftId(null);
    setError(null);
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

  // Stream a fresh replacement for a single section. Updates the card's
  // streamingMarkdown live as deltas arrive, then commits to markdown when
  // the stream completes.
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
            // Update streaming markdown so live preview tracks the new text.
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
        // Roll back to the previous content; show a top-level error banner.
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

  const active = KINDS.find((k) => k.value === kind);
  // Picker is visible only when we're NOT generating, streaming, or showing
  // a result — keeps focus on one thing at a time.
  const showPicker = !busy && !streamingText && !result;

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Studio
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          AI <em className="italic font-light text-accent">studio</em>
        </h2>
        <p className="text-muted mt-2 max-w-2xl">
          Pick what to make on the wheel, write a one-line brief, and Mudir drafts it.
          Powered by Claude Haiku 4.5 — gated by the <span className="font-mono text-ink">ai_studio</span> feature flag.
        </p>
      </div>

      {showPicker && (
      <Card>
        <CardContent className="p-6">
          {/* Wheel header — eyebrow on the left, RESET on the right */}
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> What to make
            </p>
            <button
              type="button"
              onClick={reset}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted hover:text-accent inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          {/* Wheel left, brief on the right — fits on a single screen so the
              teacher doesn't have to scroll between picking and writing. */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:gap-12 items-center">
            <StudioWheel value={kind} onChange={onPickKind} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Brief for the {active?.label?.toLowerCase()}
                </p>
                <button
                  type="button"
                  onClick={() => setPrompt(active?.sample || "")}
                  className="font-mono text-[10px] uppercase tracking-wider text-accent hover:text-ink"
                >
                  Use sample
                </button>
              </div>
              <textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={active?.sample}
                className="w-full rounded-md border border-line bg-paper focus:border-ink focus:outline-none px-3 py-2.5 text-sm resize-none"
              />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  Haiku 4.5 · streaming
                </p>
                <Button onClick={generate} disabled={!prompt.trim()}>
                  <Sparkles size={14} className="mr-2" />
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {error && (
        <div className="mt-6 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">Could not generate</p>
          <p className="text-sm text-ink-soft">{error}</p>
          {error.includes("ai_studio") && (
            <p className="text-xs text-muted mt-2">
              Open Dev console (switch role from Account) → Feature flags → flip <span className="font-mono text-ink">ai_studio</span> to On.
            </p>
          )}
        </div>
      )}

      {(busy || streamingText || result) && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                  {busy ? "Generating…" : "Generated"}
                </p>
                <p className="font-serif text-xl text-ink truncate">
                  {KINDS.find((k) => k.value === (result?.kind ?? kind))?.label}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {busy ? (
                  <Button variant="secondary" onClick={cancel} className="text-xs px-3 py-1.5">
                    <X size={13} className="mr-1.5" /> Cancel
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={copyToClipboard}
                      disabled={!result}
                      className="text-xs px-3 py-1.5"
                    >
                      {copied ? <><Check size={13} className="mr-1.5" /> Copied</> : <><Copy size={13} className="mr-1.5" /> Copy</>}
                    </Button>
                    {(result?.kind ?? kind) === "lesson_plan" && (
                      savedDraftId ? (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-sage inline-flex items-center gap-1.5">
                          <Check size={13} /> Saved as draft #{savedDraftId}
                        </span>
                      ) : (
                        <Button variant="secondary" onClick={saveAsDraft} disabled={saving || !result} className="text-xs px-3 py-1.5">
                          <Save size={13} className="mr-1.5" />
                          {saving ? "Saving…" : "Save as draft"}
                        </Button>
                      )
                    )}
                    <Button onClick={makeAnother} className="text-xs px-3 py-1.5">
                      <Sparkles size={13} className="mr-1.5" /> Make another
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* Split pane: editable section cards on the left, live preview
                on the right. While the initial generation is still streaming,
                the cards aren't built yet — show the streaming markdown in
                the preview pane only and a placeholder on the left. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-[420px]">
              {/* Left: section cards */}
              <div className="space-y-3 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1 inline-flex items-center gap-2">
                  <span className="w-6 h-px bg-accent" /> Sections
                </p>
                {sections.length === 0 ? (
                  <Card>
                    <CardContent className="p-5 text-sm text-muted">
                      {busy
                        ? "Cards will appear here once the first draft finishes streaming. You can edit and regenerate each part independently."
                        : "Nothing to edit yet."}
                    </CardContent>
                  </Card>
                ) : (
                  sections.map((s) => (
                    <StudioCard
                      key={s.id}
                      section={s}
                      onSave={(md) => setSectionMarkdown(s.id, md)}
                      onRegenerate={(hint) => regenerateSection(s.id, hint)}
                      onCancelRegenerate={() => cancelRegenerate(s.id)}
                      onRemove={() => removeSection(s.id)}
                    />
                  ))
                )}
              </div>

              {/* Right: live preview — always renders the latest joined
                  markdown (sections > streaming text). Sticks while the user
                  scrolls through long card lists on the left. */}
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1 inline-flex items-center gap-2">
                  <span className="w-6 h-px bg-accent" /> Live preview
                </p>
                <div className="bg-paper border border-line rounded-xl p-6 lg:sticky lg:top-4 max-h-[70vh] overflow-y-auto">
                  {sections.length === 0 ? (
                    <pre className="whitespace-pre-wrap text-sm text-ink leading-relaxed font-sans">
                      {streamingText}
                      {busy && <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse align-text-bottom" />}
                    </pre>
                  ) : (
                    renderMarkdown(joinSections(sections))
                  )}
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-wider text-muted">
                <span>{result.usage.input_tokens} input tokens</span>
                <span>{result.usage.output_tokens} output tokens</span>
                {result.usage.cache_read_input_tokens > 0 && (
                  <span className="text-sage">{result.usage.cache_read_input_tokens} cache read</span>
                )}
                {result.usage.cache_creation_input_tokens > 0 && (
                  <span className="text-gold">{result.usage.cache_creation_input_tokens} cache write</span>
                )}
                <span>stop: {result.stop_reason}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
