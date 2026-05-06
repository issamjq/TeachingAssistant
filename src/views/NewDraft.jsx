import React, { useState } from "react";
import { Sparkles, Calendar, X, Lightbulb, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Section, Field, FilePill, inputClasses, api } from "./_shared";

const initialStages = [
  { id: 1, name: "Warm-up", duration: 5, note: "Ask: where have you heard a metaphor today?" },
  { id: 2, name: "Mini-lesson", duration: 12, note: "Define simile, metaphor, personification with examples." },
  { id: 3, name: "Guided practice", duration: 15, note: "Identify devices in a short poem together." },
  { id: 4, name: "Independent task", duration: 13, note: "Each student writes 3 lines using one device." },
];

const checklist = [
  { label: "Draft name", done: true },
  { label: "Subject & grade", done: true },
  { label: "Objectives (≥1)", done: true },
  { label: "Lesson flow (≥2 stages)", done: true },
  { label: "Materials attached", done: true },
  { label: "Slides", done: false },
  { label: "Quiz attached", done: false },
];

export default function NewDraft({ onCancel, onSave, onOpenFull }) {
  const [name, setName] = useState("Poetry — figurative language");
  const [subject, setSubject] = useState("English");
  const [grade, setGrade] = useState("Grade 7");
  const [klass, setKlass] = useState("7B");
  const [duration, setDuration] = useState("45 min");
  const [date, setDate] = useState("Friday, May 8 · 10:30 AM");
  const [objectives, setObjectives] = useState([
    "Identify simile, metaphor, and personification in a poem",
    "Explain how figurative language creates meaning",
    "",
  ]);
  const [stages, setStages] = useState(initialStages);

  const updateObjective = (i, v) => setObjectives((p) => p.map((o, idx) => (idx === i ? v : o)));
  const removeObjective = (i) => setObjectives((p) => p.filter((_, idx) => idx !== i));
  const addObjective = () => setObjectives((p) => [...p, ""]);

  const removeStage = (id) => setStages((p) => p.filter((s) => s.id !== id));
  const addStage = () =>
    setStages((p) => [...p, { id: Date.now(), name: "New stage", duration: 5, note: "" }]);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const persist = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const durationInt = parseInt(String(duration).match(/\d+/)?.[0] || "0", 10);
      const cleanedObjectives = objectives.map((o) => o.trim()).filter(Boolean);
      const validStages = stages.filter((s) => s.name?.trim());

      // Map the on-screen "stages" to the lesson plan's intro / main /
      // conclusion buckets so the EditDraft view picks them up. Three or
      // more stages: first → intro, last → conclusion, middle stages are
      // joined into main_activity. Two stages: intro + main. One stage: intro.
      let intro = "", main_activity = "", conclusion = "";
      if (validStages.length === 1) {
        intro = `${validStages[0].name}: ${validStages[0].note || ""}`.trim();
      } else if (validStages.length === 2) {
        intro = `${validStages[0].name}: ${validStages[0].note || ""}`.trim();
        main_activity = `${validStages[1].name}: ${validStages[1].note || ""}`.trim();
      } else if (validStages.length >= 3) {
        intro = `${validStages[0].name}: ${validStages[0].note || ""}`.trim();
        conclusion = `${validStages[validStages.length - 1].name}: ${validStages[validStages.length - 1].note || ""}`.trim();
        main_activity = validStages
          .slice(1, -1)
          .map((s) => `${s.name}: ${s.note || ""}`.trim())
          .join("\n");
      }

      const created = await api("/api/drafts", {
        method: "POST",
        body: {
          name: name.trim(),
          subject: subject || "English",
          status: "In progress",
          progress: 25,
          note: `${grade}${klass ? " · " + klass : ""}${duration ? " · " + duration : ""}`,
          grade,
          section: klass,
          duration_minutes: durationInt || null,
          objectives: cleanedObjectives,
          intro,
          main_activity,
          conclusion,
        },
      });
      onSave(created);
    } catch (e) {
      setSaveErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> New draft
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            New <em className="italic font-light text-accent">draft</em>
          </h2>
          <p className="text-muted mt-2">
            Quick draft of a lesson plan. Save it now, polish it later. Only you can see this.
          </p>
        </div>
        <div className="flex bg-paper-warm border border-line rounded-full p-1 text-sm flex-shrink-0">
          <button className="px-4 py-1.5 rounded-full bg-ink text-paper-cool font-medium">
            Manual (old school)
          </button>
          <button disabled className="px-4 py-1.5 rounded-full text-muted flex items-center gap-2 cursor-not-allowed">
            <Sparkles size={13} /> AI-assisted{" "}
            <span className="font-mono text-[9px] uppercase tracking-wider text-accent">soon</span>
          </button>
        </div>
      </div>

      <Card className="mb-6 bg-paper">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">Quick start</p>
            <p className="font-serif text-lg text-ink">Start from a template, or build from scratch</p>
            <p className="text-sm text-muted mt-1">
              Templates fill in objectives and lesson flow for you. You can edit anything after.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Button variant="outline">Pick a template</Button>
            <Button>Build from scratch</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section step="Section 1 of 4" title="Basic information">
            <Field label="Draft name *">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
            </Field>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <Field label="Subject *">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClasses} />
              </Field>
              <Field label="Grade">
                <input value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClasses} />
              </Field>
              <Field label="Class">
                <input value={klass} onChange={(e) => setKlass(e.target.value)} className={inputClasses} />
              </Field>
              <Field label="Duration">
                <input value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClasses} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Planned date (optional — for scheduling)">
                <div className={`${inputClasses} flex items-center gap-2`}>
                  <Calendar size={14} className="text-muted" />
                  <input
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent outline-none flex-1 text-ink"
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section
            step="Section 2 of 4"
            title="Learning objectives"
            subtitle="What students should be able to do by the end of the lesson."
          >
            <div className="space-y-2">
              {objectives.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-paper border border-line text-ink-soft font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={o}
                    onChange={(e) => updateObjective(i, e.target.value)}
                    placeholder="Add an objective…"
                    className={inputClasses}
                  />
                  <button onClick={() => removeObjective(i)} className="text-muted hover:text-accent">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addObjective}
              className="text-accent hover:text-ink font-serif italic text-sm mt-3 border-b border-accent hover:border-ink transition"
            >
              + Add objective
            </button>
          </Section>

          <Section step="Section 3 of 4" title="Lesson flow" subtitle="Break the lesson into stages. Drag to reorder.">
            <div className="space-y-2">
              {stages.map((s) => (
                <div key={s.id} className="bg-paper border border-line rounded-lg p-3 flex items-start gap-3">
                  <span className="text-muted leading-none mt-0.5 cursor-grab select-none">⋮⋮</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-ink">{s.name}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-paper-cool border border-line text-ink-soft rounded">
                        {s.duration} min
                      </span>
                    </div>
                    <p className="text-xs text-muted">{s.note}</p>
                  </div>
                  <button onClick={() => removeStage(s.id)} className="text-muted hover:text-accent">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addStage}
              className="text-accent hover:text-ink font-serif italic text-sm mt-3 border-b border-accent hover:border-ink transition"
            >
              + Add stage
            </button>
          </Section>

          <Section step="Section 4 of 4" title="Notes & resources">
            <textarea
              defaultValue="Reminder: print the poem handout in advance."
              placeholder="Add a note to your future self…"
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink mb-4 text-ink"
              rows={2}
            />
            <div className="flex flex-wrap gap-3">
              <FilePill name="Poem_handout.pdf" type="PDF" size="480 KB" />
              <FilePill name="Examples_slides.pptx" type="PPTX" size="2.1 MB" />
              <button className="border border-dashed border-line rounded-lg px-4 py-3 text-sm text-muted hover:border-ink hover:text-ink transition">
                + Upload file
              </button>
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Draft status</p>
              <div className="flex items-center justify-between mb-2">
                <span className="font-serif text-lg font-medium text-ink">65% complete</span>
                <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded-full inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink" /> In progress
                </span>
              </div>
              <div className="h-1.5 bg-paper-warm border border-line rounded-full overflow-hidden mb-5">
                <div className="h-full bg-ink" style={{ width: "65%" }} />
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Checklist</p>
              <div className="space-y-1.5">
                {checklist.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 text-sm">
                    {c.done ? (
                      <CheckCircle2 size={16} className="text-sage" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-line inline-block" />
                    )}
                    <span className={c.done ? "text-ink-soft" : "text-muted"}>{c.label}</span>
                  </div>
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
                    className="px-2 py-0.5 bg-paper border border-line text-ink-soft font-mono text-[9px] uppercase tracking-wider rounded"
                  >
                    {t}
                  </span>
                ))}
                <button className="px-2 py-0.5 border border-dashed border-line text-muted font-mono text-[9px] uppercase tracking-wider rounded hover:border-ink hover:text-ink">
                  + Add
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="bg-paper-warm border border-line rounded-lg p-4">
            <p className="text-sm font-medium text-ink">Private to you</p>
            <p className="text-xs text-muted mt-0.5">No one else can see this draft.</p>
          </div>

          <div className="bg-paper border border-gold rounded-lg p-4 flex gap-2.5">
            <Lightbulb size={16} className="text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink">Reuse this later?</p>
              <p className="text-xs text-muted mt-0.5">Save it as a template once you finish.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-8 pt-6 border-t border-line">
        <Button onClick={onCancel} variant="danger" disabled={saving}>
          Discard draft
        </Button>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {saveErr ? (
            <span className="text-xs text-accent font-mono uppercase tracking-wider">
              {saveErr}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Changes are written to Neon on save
            </span>
          )}
          <Button onClick={persist} variant="secondary" disabled={saving}>
            {saving ? "Saving…" : "Save & close"}
          </Button>
          <Button onClick={onOpenFull} disabled={saving}>
            Open in full editor →
          </Button>
        </div>
      </div>
    </div>
  );
}
