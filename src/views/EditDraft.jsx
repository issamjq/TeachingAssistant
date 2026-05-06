import React, { useState } from "react";
import { Pencil, X, ChevronDown, CheckCircle2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Section, Field, FilePill, inputClasses } from "./_shared";

const initialStages = [
  { id: 1, name: "Warm-up", duration: 5, note: "Ask: where have you heard a metaphor today?", done: true },
  { id: 2, name: "Mini-lesson", duration: 12, note: "Define simile, metaphor, personification with examples.", done: true },
  { id: 3, name: "Guided practice", duration: 15, note: "Identify devices in a short poem together.", done: false, editing: true },
  { id: 4, name: "Independent task", duration: 13, note: "Each student writes 3 lines using one device.", done: false },
];

const initialChecklist = [
  { label: "Draft name", done: true },
  { label: "Subject & grade", done: true },
  { label: "Objectives (≥1)", done: true },
  { label: "Lesson flow (≥2 stages)", done: true },
  { label: "Materials attached", done: true },
  { label: "Slides ready", done: false },
  { label: "Quiz attached", done: false },
  { label: "Reviewed", done: false },
];

const recentChanges = [
  { msg: "Edited stage: Guided practice", when: "just now" },
  { msg: "Added objective", when: "3 min ago" },
  { msg: "Uploaded Examples_slides.pptx", when: "12 min ago" },
  { msg: "Created from blank", when: "1 hour ago" },
];

export default function EditDraft({ draft, onClose, onMarkReady }) {
  const [progress, setProgress] = useState(draft?.progress ?? 65);
  const [objectives] = useState([
    "Identify simile, metaphor, and personification in a poem",
    "Explain how figurative language creates meaning",
  ]);
  const [stages, setStages] = useState(initialStages);
  const [checklist, setChecklist] = useState(initialChecklist);

  const totalMin = stages.reduce((t, s) => t + s.duration, 0);

  const toggleCheck = (label) =>
    setChecklist((p) => p.map((c) => (c.label === label ? { ...c, done: !c.done } : c)));

  const stopEditing = (id) =>
    setStages((p) => p.map((s) => (s.id === id ? { ...s, editing: false } : s)));

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Edit draft
          </p>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-serif text-4xl font-medium text-ink">
              {draft?.name || "Poetry — figurative language"}
            </h2>
            <button className="text-muted hover:text-ink">
              <Pencil size={16} />
            </button>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-1">
            English · Grade 7B · 45 min · Friday May 8 · 10:30 AM
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 bg-paper border border-line rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" /> In progress <ChevronDown size={12} />
          </button>
          <Button variant="secondary">Preview</Button>
          <Button onClick={onClose}>Save & close</Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Draft progress</p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-serif text-3xl font-medium text-ink">{progress}%</span>
                <span className="text-sm text-muted">complete</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-ink"
              />
              <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Quick set</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {[0, 25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => setProgress(p)}
                    className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wider border transition ${
                      progress === p
                        ? "bg-ink text-paper-cool border-ink"
                        : "bg-paper-cool text-ink-soft border-line hover:border-ink"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                Drag the slider, or let progress update from your checklist below
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section step="Section 1" title="Basic information">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Subject">
                <input className={inputClasses} defaultValue="English" />
              </Field>
              <Field label="Grade">
                <input className={inputClasses} defaultValue="Grade 7" />
              </Field>
              <Field label="Class">
                <input className={inputClasses} defaultValue="7B" />
              </Field>
              <Field label="Duration">
                <input className={inputClasses} defaultValue="45 min" />
              </Field>
            </div>
          </Section>

          <Section step="Section 2" title="Learning objectives" badge="Done">
            <div className="space-y-2">
              {objectives.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-paper border border-line text-ink-soft font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <input defaultValue={o} className={inputClasses} />
                  <span className="text-muted cursor-grab select-none">⋮⋮</span>
                  <button className="text-muted hover:text-accent">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button className="text-accent hover:text-ink font-serif italic text-sm mt-3 border-b border-accent hover:border-ink transition">
              + Add objective
            </button>
          </Section>

          <Section step="Section 3" title="Lesson flow" badge={`Total: ${totalMin} min`}>
            <div className="space-y-2">
              {stages.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-lg p-3 flex items-start gap-3 border ${
                    s.editing ? "bg-paper-cool border-ink ring-1 ring-ink" : "bg-paper border-line"
                  }`}
                >
                  <span className="text-muted leading-none mt-0.5 select-none cursor-grab">⋮⋮</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {s.done ? (
                        <CheckCircle2 size={16} className="text-sage" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-line inline-block" />
                      )}
                      <span className="font-medium text-sm text-ink">{s.name}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-paper-cool border border-line text-ink-soft rounded">
                        {s.duration} min
                      </span>
                    </div>
                    <p className="text-xs text-muted">{s.note}</p>
                  </div>
                  {s.editing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => stopEditing(s.id)}
                        className="bg-ink text-paper-cool font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => stopEditing(s.id)}
                        className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="text-muted hover:text-ink">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="text-accent hover:text-ink font-serif italic text-sm mt-3 border-b border-accent hover:border-ink transition">
              + Add stage
            </button>
          </Section>

          <Section step="Section 4" title="Notes & resources">
            <textarea
              defaultValue={
                "Reminder: print the poem handout in advance.\nMaybe show a 2-minute video clip about figurative language at the start."
              }
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink mb-4 text-ink"
              rows={3}
            />
            <div className="flex flex-wrap gap-3">
              <FilePill name="Poem_handout.pdf" type="PDF" size="480 KB" removable />
              <FilePill name="Examples_slides.pptx" type="PPTX" size="2.1 MB" removable />
              <button className="border border-dashed border-line rounded-lg px-4 py-3 text-sm text-muted hover:border-ink hover:text-ink transition">
                + Upload file
              </button>
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                Completion checklist
              </p>
              <p className="text-xs text-muted mb-4">
                Tick items as you finish them. Progress updates automatically.
              </p>
              <div className="space-y-1">
                {checklist.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => toggleCheck(c.label)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition ${
                      c.done ? "bg-paper" : "hover:bg-paper-warm"
                    }`}
                  >
                    {c.done ? (
                      <CheckCircle2 size={16} className="text-sage" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-line inline-block" />
                    )}
                    <span className={`text-sm ${c.done ? "text-ink" : "text-muted"}`}>
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {["Poetry", "Figurative language"].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-paper border border-line text-ink-soft font-mono text-[9px] uppercase tracking-wider rounded"
                  >
                    {t} <X size={10} />
                  </span>
                ))}
                <button className="px-2 py-0.5 border border-dashed border-line text-muted font-mono text-[9px] uppercase tracking-wider rounded hover:border-ink hover:text-ink">
                  + Add
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Recent changes</p>
              <ul className="space-y-3">
                {recentChanges.map(({ msg, when }) => (
                  <li key={msg} className="flex gap-3 text-sm">
                    <span className="h-2 w-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-ink-soft">{msg}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-0.5">
                        {when}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="bg-paper-warm border border-line rounded-lg p-4 flex gap-3">
            <Lock size={16} className="text-ink-soft flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink">Private to you</p>
              <p className="text-xs text-muted mt-0.5">Only you can see and edit this draft.</p>
            </div>
          </div>

          <Card className="border-accent">
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-3">
                Danger zone
              </p>
              <button className="w-full border border-accent text-accent rounded-lg py-2.5 text-sm font-medium hover:bg-accent hover:text-paper-cool transition">
                Delete draft
              </button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-8 pt-6 border-t border-line">
        <Button onClick={onClose} variant="secondary">
          ← Back to drafts
        </Button>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className="font-mono text-[10px] uppercase tracking-wider text-sage flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" /> All changes saved
          </span>
          <Button variant="secondary">Save as template</Button>
          <Button onClick={onMarkReady}>Mark as ready to use →</Button>
        </div>
      </div>
    </div>
  );
}
