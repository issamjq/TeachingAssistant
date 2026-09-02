"use client";

// The entry editor. Lifted out of the old Schedule screen unchanged
// except for `prefill`: clicking an empty hour in the week grid now opens
// this already knowing the day and the time, so putting a lesson on
// Tuesday at nine is one click and a title rather than four fields.
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS, MAJORS } from "@/lib/enums";
import {
  Field, Modal, inputClasses, selectClasses, api, DatePicker,
  AudienceSelect, useTeacherClasses,
} from "@/views/_shared";
import { fmtTime } from "./timetable";
import { today } from "@/lib/localDate";
import { findClash, HHMM } from "@/shared/lib/scheduleClash";
import { AudiencePreview, useRoster } from "@/features/delivery";
import { distinctClasses } from "@/shared/lib/classMatch";
import { repeatDates, addDays } from "@/shared/lib/repeatWeekly";

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
  /**
   * The profile's sections list has never been populated (getProfile
   * returns none), so every Section field degraded to free text — on the
   * exact fields whose string-match controls student delivery. The
   * roster knows her real grades and sections; offer those.
   */
  const { roster } = useRoster();
  const rosterClasses = distinctClasses(roster);
  const rosterSections = [...new Set(rosterClasses.map((c) => c.section).filter(Boolean))].sort();
  const rosterGrades = [...new Set(rosterClasses.map((c) => c.grade).filter(Boolean))];
  const gradeOptions = teacherGrades.length ? teacherGrades : rosterGrades.length ? rosterGrades : GRADE_LEVELS;
  const sectionOptions = teacherSections.length ? teacherSections : rosterSections;
  const subjectOptions = [...new Set([...rosterClasses.map((c) => c.subject).filter(Boolean), ...MAJORS])];

  /**
   * Weekly repetition — new entries only. "Every Sunday, period 2" was
   * impossible: a 30-period week over a 14-week term meant ~420
   * hand-entered rows, the single largest data-entry burden in the
   * product. The expansion happens at save (see repeatWeekly.ts); each
   * week is an ordinary entry, editable and cancellable on its own.
   */
  const [repeat, setRepeat] = useState("none");
  const [repeatUntil, setRepeatUntil] = useState("");
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

  /**
   * Is this entry an assignment, or just a slot in her own week?
   *
   * A generation attached makes it work that students receive; without
   * one it is a free period or a meeting, which has no audience to miss.
   */
  const carriesWork = Boolean(form.draft_id);
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
    // Compared as strings: draft ids are uuids now, and Number() on one is
    // NaN, so linking a schedule entry to a lesson silently matched nothing.
    const d = drafts.find((x) => String(x.id) === String(id));
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
    /**
     * Refuse before the round trip, and say what it costs.
     *
     * The data layer enforces this too — four screens write entries — but
     * catching it here keeps the teacher in the form with the empty field
     * in front of her rather than reading an error about a save.
     */
    if (carriesWork) {
      const missing = [
        !String(form.grade ?? "").trim() && "a grade",
        !String(form.subject ?? "").trim() && "a subject",
      ].filter(Boolean);
      if (missing.length) {
        setErr(
          `Add ${missing.join(" and ")} before scheduling this. Students receive work by ` +
          `matching their grade and subject, so without ${missing.length > 1 ? "them" : "it"} ` +
          `nobody will see it.`
        );
        return;
      }
    }
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
      if (isNew) {
        // One row per week. Sequential, so a mid-series failure reports
        // how far it got instead of scattering unknown holes.
        const dates =
          repeat === "weekly" ? repeatDates(form.date, repeatUntil) : [form.date];
        let saved = null;
        let written = 0;
        try {
          for (const d of dates) {
            // eslint-disable-next-line no-await-in-loop
            saved = await api("/api/schedule", { method: "POST", body: { ...form, date: d } });
            written += 1;
          }
        } catch (e) {
          if (!written) throw e;
          setErr(
            `Saved ${written} of ${dates.length} weeks, then: ${e.message}. ` +
            `The saved weeks are on your timetable; add the rest when the connection is back.`,
          );
          setSaving(false);
          onSaved(saved, isNew);
          return;
        }
        onSaved(saved, isNew);
      } else {
        const saved = await api(`/api/schedule/${initial.id}`, { method: "PATCH", body: form });
        onSaved(saved, isNew);
      }
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
          <Button onClick={submit} disabled={saving}>
            {saving
              ? "Saving…"
              : isNew && repeat === "weekly" && repeatUntil
                ? `Save ${repeatDates(form.date, repeatUntil).length} weeks`
                : "Save"}
          </Button>
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
        <Field
          label="Subject"
          required={carriesWork}
          hint={carriesWork ? "students match on this" : undefined}
        >
          {/* Free text with her real subjects offered — the app already
              knows them from the roster and the majors list, and this is
              one of the two fields whose string-match controls delivery. */}
          <input
            className={inputClasses}
            value={form.subject}
            list="schedule-subject-options"
            onChange={(e) => set("subject", e.target.value)}
          />
          <datalist id="schedule-subject-options">
            {subjectOptions.map((m) => <option key={m} value={m} />)}
          </datalist>
        </Field>
        <Field label="Grade" required={carriesWork}>
          <AudienceSelect
            value={form.grade}
            onChange={(v) => set("grade", v)}
            options={gradeOptions}
            allLabel="All grades"
          />
        </Field>
        <Field label="Section">
          {sectionOptions.length ? (
            <AudienceSelect
              value={form.section}
              onChange={(v) => set("section", v)}
              options={sectionOptions}
              allLabel="All sections"
            />
          ) : (
            // Nothing known yet — free text, commas for several.
            <input className={inputClasses} value={form.section} onChange={(e) => set("section", e.target.value)} />
          )}
        </Field>
        {carriesWork && (
          /* This entry carries work, so these three fields decide who
             receives it. The chips are the teacher's real classes read off
             her roster — one tap fills all three with values that cannot
             lose the text match — and the line beneath is the match itself,
             run live. */
          <div className="md:col-span-2">
            <AudiencePreview
              audience={{ grade: form.grade, subject: form.subject, section: form.section }}
              onPick={(cls) =>
                setForm((f) => ({
                  ...f,
                  grade: cls.grade,
                  // Roster rows saved without a subject would otherwise
                  // ERASE the one she typed — keep hers when the class
                  // has none of its own.
                  subject: cls.subject || f.subject,
                  section: cls.section,
                }))
              }
            />
          </div>
        )}
        <Field label="Date">
          <DatePicker value={form.date} onChange={(v) => set("date", v)} />
        </Field>
        {isNew && (
          <Field
            label="Repeat"
            hint={
              repeat === "weekly" && repeatUntil
                ? `${repeatDates(form.date, repeatUntil).length} weeks, same day and time`
                : undefined
            }
          >
            <select
              className={selectClasses}
              value={repeat}
              onChange={(e) => {
                const v = e.target.value;
                setRepeat(v);
                // A sensible horizon offered, not demanded: ~a term.
                if (v === "weekly" && !repeatUntil && form.date) {
                  setRepeatUntil(addDays(form.date, 7 * 13));
                }
              }}
            >
              <option value="none">Just this day</option>
              <option value="weekly">Every week</option>
            </select>
          </Field>
        )}
        {isNew && repeat === "weekly" && (
          <div className="md:col-span-2">
            <Field label="Repeat until" hint="each week is its own entry — edit or cancel any one alone">
              <DatePicker value={repeatUntil} onChange={setRepeatUntil} min={form.date || undefined} />
            </Field>
          </div>
        )}
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
