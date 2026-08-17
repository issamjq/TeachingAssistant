"use client";

import React, { useEffect, useRef, useState } from "react";
import { Save, CheckCircle2, Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Field, AttachmentsList, inputClasses, selectClasses, api, useTeacherClasses, DatePicker, AudienceSelect } from "./_shared";
import { lessonPlanToDoc } from "../lib/toDoc";
import { renderMarkdown } from "../lib/markdown";
import { useT } from "../lib/i18n";

// A leading `# Title` in the document body repeats the lesson name shown
// in the header — strip that one line so it isn't printed twice.
const stripLeadingH1 = (md) => String(md || "").replace(/^\s*#\s+.*(?:\r?\n|$)/, "");

const STATUSES = ["In progress", "Ready to use", "Blocked", "Paused"];

const ensureArray = (v) => {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
};

// Full lesson-plan editor wired to the drafts table. Loads existing draft by
// id; if no id is present we POST a new one on first save and then track its
// id for subsequent saves.
export default function EditDraft({ draft: initial, onClose, onMarkReady }) {
  const t = useT();
  const { grades: teacherGrades, sections: teacherSections } = useTeacherClasses();
  const [draftId, setDraftId] = useState(initial?.id || null);
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    note: initial?.note || "",
    subject: initial?.subject || "",
    status: initial?.status || "In progress",
    progress: initial?.progress ?? 25,
    planned_date: initial?.planned_date ? initial.planned_date.slice(0, 10) : "",
    grade: initial?.grade || "",
    section: initial?.section || "",
    duration_minutes: initial?.duration_minutes || 45,
    objectives: ensureArray(initial?.objectives),
    materials: ensureArray(initial?.materials),
    attachments: ensureArray(initial?.attachments),
    intro: initial?.intro || "",
    main_activity: initial?.main_activity || "",
    conclusion: initial?.conclusion || "",
    assessment_method: initial?.assessment_method || "",
    // Document-style lessons (imported from the library, AI-generated)
    // carry their whole body as Markdown here instead of the structured
    // intro/main/conclusion fields.
    body_md: initial?.body_md || "",
  }));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [err, setErr] = useState(null);
  // A short-lived "Saved ✓" flash so a click on Save has an unmistakable
  // outcome — the header timestamp alone was too quiet to notice.
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  // Document lessons open in a readable rendered view; this toggles to the
  // raw Markdown for editing.
  const [editingDoc, setEditingDoc] = useState(false);

  // If we got handed a real id, refresh from the server (in case the row was
  // edited elsewhere since the list was loaded).
  useEffect(() => {
    if (!initial?.id) return;
    api(`/api/drafts/${initial.id}`).then((d) => {
      setForm((f) => ({
        ...f,
        ...d,
        planned_date: d.planned_date ? d.planned_date.slice(0, 10) : "",
        objectives: ensureArray(d.objectives),
        materials: ensureArray(d.materials),
        attachments: ensureArray(d.attachments),
      }));
    }).catch(() => {});
  }, [initial?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const persist = async (overrides = {}) => {
    setSaving(true); setErr(null);
    try {
      const body = { ...form, ...overrides };
      if (draftId) {
        const saved = await api(`/api/drafts/${draftId}`, { method: "PATCH", body });
        setForm((f) => ({ ...f, ...saved, planned_date: saved.planned_date ? saved.planned_date.slice(0, 10) : "" }));
      } else {
        const saved = await api(`/api/drafts`, { method: "POST", body });
        setDraftId(saved.id);
      }
      setSavedAt(new Date());
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const markReady = async () => {
    await persist({ status: "Ready to use", progress: 100 });
    onMarkReady?.();
  };

  const addArrayItem = (key) => set(key, [...(form[key] || []), ""]);
  const updateArrayItem = (key, i, v) =>
    set(key, (form[key] || []).map((x, idx) => (idx === i ? v : x)));
  const removeArrayItem = (key, i) =>
    set(key, (form[key] || []).filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Lesson plan editor
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {form.name || <em className="italic font-light text-accent">Untitled lesson</em>}
          </h2>
          <p className="text-muted mt-2 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5">
            {err ? (
              <span className="text-accent">{err}</span>
            ) : justSaved ? (
              <span className="text-ink inline-flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-accent" /> All changes saved
              </span>
            ) : savedAt ? (
              `Saved ${savedAt.toLocaleTimeString()}`
            ) : draftId ? (
              "Saved to your account"
            ) : (
              "Unsaved — click Save to keep it"
            )}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {form.name && (
            <ExportMenu
              formats={["pdf", "doc", "md"]}
              buildDoc={() => lessonPlanToDoc(form, t)}
            />
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Close</Button>
          <Button variant="secondary" onClick={() => persist()} disabled={saving}>
            {justSaved && !saving ? (
              <><CheckCircle2 size={14} className="mr-2 text-accent" /> Saved</>
            ) : (
              <><Save size={14} className="mr-2" /> {saving ? "Saving…" : "Save"}</>
            )}
          </Button>
          <Button onClick={markReady} disabled={saving}>
            <CheckCircle2 size={14} className="mr-2" /> Mark ready
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Basics</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Lesson title">
                    <input className={inputClasses} value={form.name} onChange={(e) => set("name", e.target.value)} />
                  </Field>
                </div>
                <Field label="Subject">
                  <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
                </Field>
                <Field label="Grade">
                  <AudienceSelect
                    value={form.grade || ""}
                    onChange={(v) => set("grade", v)}
                    options={teacherGrades}
                    allLabel="All grades"
                    emptyNote="No grades on your profile"
                  />
                </Field>
                <Field label="Section">
                  <AudienceSelect
                    value={form.section || ""}
                    onChange={(v) => set("section", v)}
                    options={teacherSections}
                    allLabel="All sections"
                    emptyNote="No sections on your profile"
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <input type="number" className={inputClasses} value={form.duration_minutes ?? ""} onChange={(e) => set("duration_minutes", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="Planned date">
                  <DatePicker value={form.planned_date || ""} onChange={(v) => set("planned_date", v)} />
                </Field>
                <Field label="Status">
                  <select className={selectClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </CardContent>
          </Card>

          {form.body_md && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Lesson</p>
                  <button
                    type="button"
                    onClick={() => setEditingDoc((v) => !v)}
                    className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                  >
                    {editingDoc ? "Done editing" : "Edit the text"}
                  </button>
                </div>
                {editingDoc ? (
                  <textarea
                    rows={22}
                    className={`${inputClasses} font-mono text-xs leading-relaxed`}
                    value={form.body_md}
                    onChange={(e) => set("body_md", e.target.value)}
                    aria-label="Lesson document, editable Markdown"
                  />
                ) : (
                  <article className="max-w-[68ch]">
                    {renderMarkdown(stripLeadingH1(form.body_md))}
                  </article>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Learning objectives</p>
              <div className="space-y-2">
                {form.objectives.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-paper border border-line text-ink-soft font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      className={inputClasses}
                      value={o}
                      onChange={(e) => updateArrayItem("objectives", i, e.target.value)}
                      placeholder="Add an objective…"
                    />
                    <button onClick={() => removeArrayItem("objectives", i)} className="text-muted hover:text-accent">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addArrayItem("objectives")}
                className="text-accent hover:text-ink font-serif italic text-sm mt-3 border-b border-accent hover:border-ink transition inline-flex items-center gap-1.5"
              >
                <Plus size={12} /> Add objective
              </button>
            </CardContent>
          </Card>

          {!form.body_md && (
          <Card>
            <CardContent className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Lesson body</p>
              <div className="space-y-4">
                <Field label="Intro (warm-up)">
                  <textarea rows={2} className={inputClasses} value={form.intro || ""} onChange={(e) => set("intro", e.target.value)} />
                </Field>
                <Field label="Main activity">
                  <textarea rows={4} className={inputClasses} value={form.main_activity || ""} onChange={(e) => set("main_activity", e.target.value)} />
                </Field>
                <Field label="Conclusion (exit ticket / wrap-up)">
                  <textarea rows={2} className={inputClasses} value={form.conclusion || ""} onChange={(e) => set("conclusion", e.target.value)} />
                </Field>
                <Field label="Assessment method">
                  <input className={inputClasses} value={form.assessment_method || ""} onChange={(e) => set("assessment_method", e.target.value)} placeholder="e.g. exit ticket, formative quiz, peer review" />
                </Field>
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Materials</p>
              <div className="space-y-2">
                {form.materials.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputClasses}
                      value={m}
                      onChange={(e) => updateArrayItem("materials", i, e.target.value)}
                      placeholder="Worksheet, slide, lab equipment…"
                    />
                    <button onClick={() => removeArrayItem("materials", i)} className="text-muted hover:text-accent">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addArrayItem("materials")}
                className="text-accent hover:text-ink font-serif italic text-sm mt-3 border-b border-accent hover:border-ink transition inline-flex items-center gap-1.5"
              >
                <Plus size={12} /> Add material
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">Attachments</p>
              <p className="text-xs text-muted mb-4">
                Paste links to files in Drive, OneDrive, or anywhere else. Murchid doesn&rsquo;t host uploads itself yet.
              </p>
              <AttachmentsList
                value={form.attachments}
                onChange={(v) => set("attachments", v)}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Progress</p>
              <p className="font-serif text-3xl text-ink">{form.progress}%</p>
              <input
                type="range"
                min="0"
                max="100"
                value={form.progress}
                onChange={(e) => set("progress", Number(e.target.value))}
                className="w-full mt-3 accent-ink"
              />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-2">
                Drag to update. Marking the lesson ready bumps it to 100%.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Notes to self</p>
              <textarea
                rows={4}
                className={inputClasses}
                value={form.note || ""}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Reminders, what to print, things to ask the lab tech…"
              />
            </CardContent>
          </Card>

          <div className="bg-paper-warm border border-line rounded-lg p-4">
            <p className="text-sm font-medium text-ink">Private to you</p>
            <p className="text-xs text-muted mt-0.5">
              No one else can see this lesson plan. It lives in your account only.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
