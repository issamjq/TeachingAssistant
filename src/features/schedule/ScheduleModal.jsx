"use client";

// The entry editor. Lifted out of the old Schedule screen unchanged
// except for `prefill`: clicking an empty hour in the week grid now opens
// this already knowing the day and the time, so putting a lesson on
// Tuesday at nine is one click and a title rather than four fields.
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "@/lib/enums";
import {
  Field, Modal, inputClasses, selectClasses, api, DatePicker,
  AudienceSelect, useTeacherClasses,
} from "@/views/_shared";
import { fmtTime } from "./timetable";
import { today } from "@/lib/localDate";
import { findClash, HHMM } from "@/shared/lib/scheduleClash";

const EMPTY = {
  title: "",
  subject: "",
  grade: "",
  section: "",
  date: "",
  start_time: "",
  end_time: "",
  notes: "",
  status: "planned",
  draft_id: null,
};

export default function ScheduleModal({ initial, prefill, onClose, onSaved }) {
  const isNew = !initial;
  const { grades: teacherGrades, sections: teacherSections } = useTeacherClasses();
  const [form, setForm] = useState(() => {
    // A slot clicked in the grid arrives as `prefill`, so the editor
    // opens on the day and hour the teacher actually pointed at.
    if (!initial) return { ...EMPTY, date: today(), ...(prefill || {}) };
    return {
      ...EMPTY,
      ...initial,
      date: initial.date ? initial.date.slice(0, 10) : "",
      start_time: fmtTime(initial.start_time),
      end_time: fmtTime(initial.end_time),
    };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Load lesson plans so the user can link this schedule entry to one.
  useEffect(() => {
    api("/api/drafts").then(setDrafts).catch(() => {});
  }, []);

  // When the user picks a lesson plan, prefill any empty fields from it.
  const linkDraft = (id) => {
    const d = drafts.find((x) => x.id === Number(id));
    if (!d) { set("draft_id", null); return; }
    setForm((f) => ({
      ...f,
      draft_id: d.id,
      title: f.title || d.name,
      subject: f.subject || d.subject || "",
      grade: f.grade || d.grade || "",
      section: f.section || d.section || "",
    }));
  };

  // `opts === true` means the teacher pressed "Save anyway" on the clash
  // warning — compared with === because the footer button passes the
  // click event here, which is truthy.
  const submit = async (opts) => {
    const ignoreConflict = opts === true;
    setSaving(true);
    setErr(null);
    // Warn-don't-block: teachers sometimes run parallel activities on
    // purpose, so a clash is a question, never a refusal.
    if (!ignoreConflict && form.start_time && form.status !== "cancelled") {
      const clash = await findClash(form, isNew ? null : initial.id);
      if (clash) {
        setConflict(clash);
        setSaving(false);
        return;
      }
    }
    setConflict(null);
    try {
      const saved = isNew
        ? await api("/api/schedule", { method: "POST", body: form })
        : await api(`/api/schedule/${initial.id}`, { method: "PATCH", body: form });
      onSaved(saved, isNew);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={isNew ? "New entry" : "Edit entry"}
      title={isNew ? "Add a schedule entry" : `Edit "${initial.title}"`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}
      {conflict && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-ink">
            This clashes with <strong>“{conflict.title}”</strong>
            {conflict.start_time &&
              ` (${HHMM(conflict.start_time)}${conflict.end_time ? `–${HHMM(conflict.end_time)}` : ""})`}
            {conflict.grade && ` for ${conflict.grade}${conflict.section ? ` ${conflict.section}` : ""}`}.
          </p>
          <p className="text-xs text-muted mt-1">
            Running two things in parallel is sometimes the plan — your call.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConflict(null)}>
              Change the time
            </Button>
            <Button size="sm" onClick={() => submit(true)} disabled={saving}>
              Save anyway
            </Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Link to lesson plan (optional)">
            <select
              className={selectClasses}
              value={form.draft_id || ""}
              onChange={(e) => linkDraft(e.target.value)}
            >
              <option value="">— Standalone entry, no linked plan</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.subject ? ` · ${d.subject}` : ""}{d.grade ? ` · ${d.grade}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Title">
            <input className={inputClasses} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
        </div>
        <Field label="Subject">
          <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
        </Field>
        <Field label="Grade">
          <AudienceSelect
            value={form.grade}
            onChange={(v) => set("grade", v)}
            options={teacherGrades.length ? teacherGrades : GRADE_LEVELS}
            allLabel="All grades"
          />
        </Field>
        <Field label="Section">
          {teacherSections.length ? (
            <AudienceSelect
              value={form.section}
              onChange={(v) => set("section", v)}
              options={teacherSections}
              allLabel="All sections"
            />
          ) : (
            // No sections on the profile yet — free text, commas for several.
            <input className={inputClasses} value={form.section} onChange={(e) => set("section", e.target.value)} />
          )}
        </Field>
        <Field label="Date">
          <DatePicker value={form.date} onChange={(v) => set("date", v)} />
        </Field>
        <Field label="Status">
          <select className={selectClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="planned">Planned</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Start time">
          <input type="time" className={inputClasses} value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
        </Field>
        <Field label="End time">
          <input type="time" className={inputClasses} value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Notes">
          <textarea rows={2} className={inputClasses} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
