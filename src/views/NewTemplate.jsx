"use client";

import React, { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubjectBadge, Section, Field, FilePill, inputClasses, selectClasses, api, useTeacherClasses } from "./_shared";

const initialStages = [
  { id: 1, name: "Warm-up", duration: 5, note: "Quick recap of last lesson, vocabulary check." },
  { id: 2, name: "Guided reading", duration: 15, note: "Read chapter 4 together, pause for discussion." },
  { id: 3, name: "Comprehension", duration: 15, note: "Students answer 5 questions in pairs." },
  { id: 4, name: "Exit ticket", duration: 10, note: "One sentence: what did you learn today?" },
];

export default function NewTemplate({ onCancel, onSave }) {
  const { grades: teacherGrades } = useTeacherClasses();
  const [name, setName] = useState("Reading comprehension — chapter walkthrough");
  const [subject, setSubject] = useState("English");
  const [grade, setGrade] = useState("");
  const [duration, setDuration] = useState("45 minutes");
  const [mode, setMode] = useState("manual");
  const [objectives, setObjectives] = useState([
    "Identify the main idea and supporting details in a passage",
    "Summarize a chapter in 3–5 sentences",
    "",
  ]);
  const [stages, setStages] = useState(initialStages);
  const [tags, setTags] = useState(["Comprehension", "Reading", "Quiz attached"]);
  const [visibility, setVisibility] = useState("private");

  const updateObjective = (i, v) => setObjectives((p) => p.map((o, idx) => (idx === i ? v : o)));
  const removeObjective = (i) => setObjectives((p) => p.filter((_, idx) => idx !== i));
  const addObjective = () => setObjectives((p) => [...p, ""]);

  const removeStage = (id) => setStages((p) => p.filter((s) => s.id !== id));
  const addStage = () =>
    setStages((p) => [...p, { id: Date.now(), name: "New stage", duration: 5, note: "" }]);

  const removeTag = (t) => setTags((p) => p.filter((x) => x !== t));

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const durationInt = parseInt(String(duration).match(/\d+/)?.[0] || "0", 10);
      const gradeShort = grade.replace(/^Grade\s+/i, "");
      const flow = stages
        .filter((s) => s.name?.trim())
        .map((s) => s.name)
        .join(" → ");
      // The full stages + objectives now persist in their own JSONB columns,
      // so "Use template" can clone the lesson plan in one click.
      await api("/api/templates", {
        method: "POST",
        body: {
          name: name.trim(),
          subject,
          duration: durationInt,
          grade: gradeShort,
          flow,
          tags,
          used_count: 0,
          starred: false,
          objectives: objectives.filter((o) => o.trim()),
          stages: stages
            .filter((s) => s.name?.trim())
            .map((s) => ({ name: s.name, duration: s.duration, note: s.note })),
        },
      });
      onSave();
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
            <span className="w-6 h-px bg-accent" /> New template
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            New lesson plan <em className="italic font-light text-accent">template</em>
          </h2>
          <p className="text-muted mt-2">
            Fill in the details. You can save this as a reusable template or use it once.
          </p>
        </div>
        <div className="flex bg-paper-warm border border-line rounded-full p-1 text-sm flex-shrink-0">
          <button
            onClick={() => setMode("manual")}
            className={`px-4 py-1.5 rounded-full transition font-medium ${
              mode === "manual" ? "bg-ink text-paper-cool" : "text-muted"
            }`}
          >
            Manual (old school)
          </button>
          <button
            disabled
            className="px-4 py-1.5 rounded-full text-muted flex items-center gap-2 cursor-not-allowed"
          >
            <Sparkles size={13} /> AI-assisted{" "}
            <span className="font-mono text-[9px] uppercase tracking-wider text-accent">soon</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section step="Section 1 of 4" title="Basic information">
            <Field label="Template name *">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <Field label="Subject *">
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectClasses}>
                  {["English", "Math", "Science", "Art", "History", "Geography"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Grade level">
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectClasses}>
                  <option value="">{teacherGrades.length ? "—" : "No grades on your profile"}</option>
                  {teacherGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                  {grade && !teacherGrades.includes(grade) && (
                    <option value={grade}>{grade}</option>
                  )}
                </select>
              </Field>
              <Field label="Duration">
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className={selectClasses}>
                  {["30 minutes", "45 minutes", "60 minutes", "90 minutes"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            step="Section 2 of 4"
            title="Learning objectives"
            subtitle="What should students be able to do by the end of this lesson?"
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
                  <span className="text-muted leading-none mt-0.5 select-none cursor-grab">⋮⋮</span>
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

          <Section step="Section 4 of 4" title="Resources & attachments">
            <div className="flex flex-wrap gap-3">
              <FilePill name="Chapter4_passage.pdf" type="PDF" size="1.2 MB" />
              <FilePill name="Discussion_questions.docx" type="DOCX" size="24 KB" />
              <button className="border border-dashed border-line rounded-lg px-4 py-3 text-sm text-muted hover:border-ink hover:text-ink transition">
                + Upload file
              </button>
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
                Live preview
              </p>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-dashed border-line">
                <SubjectBadge subject={subject} />
                <div className="min-w-0">
                  <p className="font-serif text-base font-medium text-ink truncate">
                    {name.split("—")[0].trim() || name}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-0.5">
                    {subject} · {grade?.toLowerCase()} · {duration}
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {stages.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-[10px] text-muted w-4">{i + 1}</span>
                    <span className="flex-1 truncate text-ink-soft">{s.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      {s.duration} min
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">Tags</p>
              <p className="text-xs text-muted mb-3">Help find this template later</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-paper border border-line text-ink-soft font-mono text-[9px] uppercase tracking-wider rounded"
                  >
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-accent">
                      <X size={10} />
                    </button>
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
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Visibility</p>
              <label className="flex items-start gap-3 cursor-pointer mb-3">
                <input
                  type="radio"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                  className="mt-1 accent-ink"
                />
                <div>
                  <p className="text-sm font-medium text-ink">Only me</p>
                  <p className="text-xs text-muted">Private to your account</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={visibility === "school"}
                  onChange={() => setVisibility("school")}
                  className="mt-1 accent-ink"
                />
                <div>
                  <p className="text-sm font-medium text-ink">Share with school</p>
                  <p className="text-xs text-muted">All teachers can use this template</p>
                </div>
              </label>
            </CardContent>
          </Card>

          <div className="bg-paper-warm border border-line rounded-lg p-4">
            <p className="text-sm font-medium text-ink">Auto-saved as draft</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-0.5">
              Last saved 2 seconds ago
            </p>
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-line">
        <Button onClick={onCancel} variant="secondary" disabled={saving}>
          Cancel
        </Button>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {saveErr && (
            <span className="text-xs text-accent font-mono uppercase tracking-wider">
              {saveErr}
            </span>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
