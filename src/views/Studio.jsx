import React, { useRef, useState } from "react";
import {
  Sparkles, FileText, ClipboardList, GraduationCap,
  Layers, Users, Save, Copy, Check, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { selectClasses, api } from "./_shared";

// Same base URL the rest of the app uses (Vercel rewrites /api → Render in
// prod; same-origin in dev via the Vite middleware).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// AI Studio. Wired to /api/studio/generate which calls Claude Opus 4.7 with
// adaptive thinking + prompt caching. Gated by the ai_studio feature flag —
// off by default; toggle from the Dev console.
const KINDS = [
  { value: "lesson_plan",  label: "Lesson plan",  icon: FileText,      sample: "A 45-minute Grade 7 science lesson on photosynthesis with a hands-on starter, two activities, and a quick exit ticket." },
  { value: "quiz",         label: "Quiz",         icon: GraduationCap, sample: "8-question Grade 8 algebra quiz covering linear equations — mix of MCQ and short answer, total 20 marks." },
  { value: "homework",     label: "Homework",     icon: ClipboardList, sample: "Reading-comprehension homework for Grade 6 English on a short story — students answer 5 questions in writing." },
  { value: "activity",     label: "Activity",     icon: Sparkles,      sample: "Group activity for Grade 5 history: students roleplay a town hall debating the construction of the railway." },
  { value: "presentation", label: "Presentation", icon: Layers,        sample: "8-slide intro deck on the water cycle for Grade 4." },
  { value: "feedback",     label: "Feedback",     icon: Users,         sample: "Write feedback paragraphs for: Mariam (strong analysis but weak grammar), Khalid (clean writing, weak depth), Sara (excellent on both)." },
];

export default function Studio() {
  const [kind, setKind] = useState("lesson_plan");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState(null);
  const abortRef = useRef(null);

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

      // Pre-stream errors (flag off, missing API key, validation) come back
      // as JSON 4xx — surface them the same way as before.
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

        // SSE events are separated by a blank line ("\n\n"). The trailing
        // chunk may be partial — keep it in `buffer` for the next read.
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
          } else if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => abortRef.current?.abort();

  const copyToClipboard = async () => {
    if (!result?.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // For lesson plans, offer one-click save into a real draft so the teacher
  // can refine in the EditDraft editor.
  const saveAsDraft = async () => {
    if (!result?.text) return;
    setSaving(true);
    try {
      // Quick parse: first H1/H2 line becomes the name, the rest goes into
      // main_activity. The teacher refines the structure in EditDraft.
      const lines = result.text.split(/\r?\n/);
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
          main_activity: result.text,
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
          Tell Mudir what you need. It writes a first draft you can refine in the matching section.
          Powered by Claude Haiku 4.5 — gated by the <span className="font-mono text-ink">ai_studio</span> feature flag.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="md:w-56">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">What to make</p>
              <select
                className={selectClasses}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  const found = KINDS.find((k) => k.value === e.target.value);
                  if (found && !prompt) setPrompt(found.sample);
                }}
              >
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Prompt</p>
                <button
                  onClick={() => {
                    const found = KINDS.find((k) => k.value === kind);
                    if (found) setPrompt(found.sample);
                  }}
                  className="font-mono text-[10px] uppercase tracking-wider text-accent hover:text-ink"
                >
                  Use sample
                </button>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={KINDS.find((k) => k.value === kind)?.sample}
                className="w-full rounded-md border border-line bg-paper focus:border-ink focus:outline-none px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Haiku 4.5 · streaming
            </p>
            <div className="flex items-center gap-2">
              {busy && (
                <Button variant="secondary" onClick={cancel} className="text-xs px-3 py-1.5">
                  <X size={13} className="mr-1.5" /> Cancel
                </Button>
              )}
              <Button onClick={generate} disabled={busy || !prompt.trim()}>
                <Sparkles size={14} className="mr-2" />
                {busy ? "Generating…" : "Generate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {(streamingText || result) && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                  {result ? "Generated" : "Generating…"}
                </p>
                <p className="font-serif text-xl text-ink">
                  {KINDS.find((k) => k.value === (result?.kind ?? kind))?.label}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                    <Button onClick={saveAsDraft} disabled={saving || !result} className="text-xs px-3 py-1.5">
                      <Save size={13} className="mr-1.5" />
                      {saving ? "Saving…" : "Save as draft"}
                    </Button>
                  )
                )}
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-ink leading-relaxed font-sans bg-paper border border-line rounded-lg p-5 max-h-[600px] overflow-y-auto">
              {result?.text ?? streamingText}
              {busy && <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse align-text-bottom" />}
            </pre>
            {result && (
              <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-wider text-muted">
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
