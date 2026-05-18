import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Field, AttachmentsList, inputClasses, selectClasses, api,
  useTeacherClasses, DatePicker,
} from "./_shared";

// Full-page homework builder — same routed pattern as QuizBuilder. Callers
// may hand us just `{ id }` (the Homework list routes by id), so when an id
// is present we always re-fetch the full row and seed the form from the
// server. A brand-new homework has no id until the first save.
export default function HomeworkBuilder({ homework, onClose }) {
  const { grades: teacherGrades, sections: teacherSections } = useTeacherClasses();
  const [hwId, setHwId] = useState(homework?.id || null);
  const [form, setForm] = useState({
    title: homework?.title || "",
    subject: homework?.subject || "",
    grade: homework?.grade || "",
    section: homework?.section || "",
    instructions: homework?.instructions || "",
    due_date: homework?.due_date ? String(homework.due_date).slice(0, 10) : "",
    status: homework?.status || "Open",
    attachments: Array.isArray(homework?.attachments) ? homework.attachments : [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!hwId) return;
    api(`/api/homework/${hwId}`).then((row) => {
      if (!row) return;
      setForm({
        title: row.title || "",
        subject: row.subject || "",
        grade: row.grade || "",
        section: row.section || "",
        instructions: row.instructions || "",
        due_date: row.due_date ? String(row.due_date).slice(0, 10) : "",
        status: row.status || "Open",
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
      });
    }).catch(() => {});
  }, [hwId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    const payload = { ...form, due_date: form.due_date || null };
    try {
      const saved = hwId
        ? await api(`/api/homework/${hwId}`, { method: "PATCH", body: payload })
        : await api(`/api/homework`, { method: "POST", body: payload });
      setHwId(saved.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {hwId ? "Edit homework" : "New homework"}
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {hwId ? form.title || "Untitled homework" : <>Assign <em className="italic font-light text-accent">homework</em></>}
          </h2>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Back to homework</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : hwId ? "Save changes" : "Create homework"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Homework details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Title">
                <input className={inputClasses} value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
            </div>
            <Field label="Subject">
              <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <Field label="Grade">
              <select className={selectClasses} value={form.grade} onChange={(e) => set("grade", e.target.value)}>
                <option value="">{teacherGrades.length ? "—" : "No grades on your profile"}</option>
                {teacherGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                {form.grade && !teacherGrades.includes(form.grade) && (
                  <option value={form.grade}>{form.grade}</option>
                )}
              </select>
            </Field>
            <Field label="Section">
              <select className={selectClasses} value={form.section} onChange={(e) => set("section", e.target.value)}>
                <option value="">{teacherSections.length ? "—" : "No sections on your profile"}</option>
                {teacherSections.map((s) => <option key={s} value={s}>{s}</option>)}
                {form.section && !teacherSections.includes(form.section) && (
                  <option value={form.section}>{form.section}</option>
                )}
              </select>
            </Field>
            <Field label="Due date">
              <DatePicker value={form.due_date} onChange={(v) => set("due_date", v)} />
            </Field>
            <Field label="Status">
              <select className={selectClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option>Open</option>
                <option>Closed</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Instructions">
                <textarea rows={4} className={inputClasses} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Attachments (links)</p>
            <AttachmentsList
              value={form.attachments}
              onChange={(v) => set("attachments", v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
