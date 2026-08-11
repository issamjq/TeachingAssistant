"use client";

// SchedulePopup — full-bleed blurred backdrop with the Add / Edit a
// schedule entry form inside a centered panel. Used by Planner (when
// a teacher clicks "+ Schedule" or an existing entry on the calendar)
// AND by the TeachingRail (when they click "+ New entry" beneath the
// mini-calendar), so it lives in its own module.
import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "../shared/hooks/useMounted";
import { X } from "lucide-react";
import { api, inputClasses, selectClasses, DatePicker, AudienceSelect } from "./_shared";
import { today as localToday } from "@/lib/localDate";
import { findClash, HHMM } from "@/shared/lib/scheduleClash";

export default function SchedulePopup({
  initial,
  defaultDate,
  // Field values to seed a NEW entry with (the assistant's hand-off, a
  // clicked slot, …). Ignored when editing.
  prefill = null,
  teacherGrades = [],
  teacherSections = [],
  onClose,
  onSaved,
}) {
  const mounted = useMounted();
  const isEdit = !!initial;
  // Snapshot the initial form once — used to detect dirty state for the
  // discard-changes guard. Lazy init so it doesn't reshuffle each render.
  const [initialForm] = useState(() => {
    const today = localToday();
    if (!initial) {
      return {
        title: "", subject: "", grade: "", section: "",
        date: defaultDate || today, status: "planned",
        start_time: "", end_time: "", notes: "",
        ...(prefill || {}),
      };
    }
    return {
      title: initial.title || "",
      subject: initial.subject || "",
      grade: initial.grade || "",
      section: initial.section || "",
      date: initial.date ? String(initial.date).slice(0, 10) : today,
      status: initial.status || "planned",
      start_time: initial.start_time ? String(initial.start_time).slice(0, 5) : "",
      end_time: initial.end_time ? String(initial.end_time).slice(0, 5) : "",
      notes: initial.notes || "",
    };
  });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const attemptClose = useCallback(() => {
    if (isDirty) setShowDiscard(true);
    else onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") attemptClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [attemptClose]);

  // `opts === true` means the teacher pressed "Save anyway" on the
  // clash warning. Compared with === because the footer button passes
  // the click event here, which is truthy.
  const submit = async (opts) => {
    const ignoreConflict = opts === true;
    setSaving(true);
    setErr(null);
    // Empty strings for TIME columns trip Postgres' type cast; turn them
    // into nulls so the schedule entry can be saved without a slot.
    const payload = {
      ...form,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    };
    // Teachers sometimes run parallel activities on purpose, so a clash
    // is a question, never a refusal.
    if (!ignoreConflict && payload.start_time && payload.status !== "cancelled") {
      const clash = await findClash(payload, isEdit ? initial.id : null);
      if (clash) {
        setConflict(clash);
        setSaving(false);
        return;
      }
    }
    setConflict(null);
    try {
      if (isEdit) {
        await api(`/api/schedule/${initial.id}`, { method: "PATCH", body: payload });
      } else {
        await api("/api/schedule", { method: "POST", body: payload });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit) return;
    if (!window.confirm("Delete this schedule entry? This cannot be undone.")) return;
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/schedule/${initial.id}`, { method: "DELETE" });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const markDone = async () => {
    if (!isEdit) return;
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/schedule/${initial.id}`, {
        method: "PATCH",
        body: {
          ...form,
          status: "done",
          start_time: form.start_time || null,
          end_time: form.end_time || null,
        },
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  // Portal to document.body so the blurred backdrop escapes any
  // ancestor with `transform` (e.g. animated planner-view) — otherwise
  // `fixed inset-0` is clipped to the parent column and the sidebar
  // stays sharp behind the dialog.
  // Portals cannot be server-rendered — see useMounted().
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/45 backdrop-blur-lg backdrop-saturate-150 animate-[fadeIn_180ms_ease-out]"
      onClick={attemptClose}
    >
      <div
        className="relative bg-paper-cool rounded-2xl border border-line shadow-[0_30px_80px_-20px_rgba(15,20,16,0.45)] w-full max-w-[820px] animate-[popIn_220ms_cubic-bezier(0.22,1,0.36,1)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={attemptClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-4 border-b border-line">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {isEdit ? "Edit entry" : "New entry"}
          </p>
          <h2 className="font-serif text-2xl font-medium text-ink leading-none">
            {isEdit ? "Edit schedule entry" : "Add a schedule entry"}
          </h2>
        </div>

        <div className="px-7 py-5">
          {err && (
            <div className="mb-3 bg-paper border border-accent rounded-lg p-2.5">
              <p className="text-sm text-accent">{err}</p>
            </div>
          )}
          {conflict && (
            <div className="mb-3 bg-paper border border-accent rounded-lg p-3">
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
                <button
                  type="button"
                  onClick={() => setConflict(null)}
                  className="planner-nav-btn px-3 py-1.5 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm text-xs text-ink"
                >
                  Change the time
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={saving}
                  className="planner-nav-btn px-3 py-1.5 rounded-lg bg-ink text-paper-cool text-xs font-medium hover:bg-ink-soft disabled:opacity-50"
                >
                  Save anyway
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <SerifField label="Title" wide>
              <input className={inputClasses} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </SerifField>
            <SerifField label="Subject">
              <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </SerifField>
            <SerifField label="Grade">
              <AudienceSelect
                value={form.grade}
                onChange={(v) => set("grade", v)}
                options={teacherGrades}
                allLabel="All grades"
                emptyNote="No grades on your profile"
              />
            </SerifField>
            <SerifField label="Section">
              <AudienceSelect
                value={form.section}
                onChange={(v) => set("section", v)}
                options={teacherSections}
                allLabel="All sections"
                emptyNote="No sections on your profile"
              />
            </SerifField>
            <SerifField label="Date">
              <DatePicker value={form.date} onChange={(v) => set("date", v)} />
            </SerifField>
            <SerifField label="Start time">
              <input type="time" className={inputClasses} value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </SerifField>
            <SerifField label="End time">
              <input type="time" className={inputClasses} value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </SerifField>
            <SerifField label="Status" wide>
              <select className={selectClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="planned">Planned</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </SerifField>
            <SerifField label="Notes" wide>
              <textarea rows={2} className={inputClasses} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </SerifField>
          </div>
        </div>

        <div className="px-7 py-4 border-t border-line flex items-center gap-3 bg-paper">
          {isEdit && (
            <>
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="planner-nav-btn px-4 py-2 rounded-lg border border-accent/40 bg-paper-cool hover:bg-accent hover:text-paper-cool hover:border-accent text-sm text-accent disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={markDone}
                disabled={saving}
                className="planner-nav-btn px-4 py-2 rounded-lg border border-sage/40 bg-paper-cool hover:bg-sage hover:text-paper-cool hover:border-sage text-sm text-sage disabled:opacity-50"
              >
                Mark done
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={attemptClose}
            disabled={saving}
            className="planner-nav-btn px-4 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm text-sm text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !form.title}
            className="planner-nav-btn px-4 py-2 rounded-lg bg-ink text-paper-cool text-sm font-medium hover:bg-ink-soft disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {showDiscard && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/40 backdrop-blur-sm rounded-2xl animate-[fadeIn_140ms_ease-out]">
            <div className="bg-paper-cool border border-line rounded-xl shadow-[0_18px_44px_-18px_rgba(15,20,16,0.35)] p-5 max-w-[360px] mx-4">
              <h4 className="font-serif text-lg font-medium text-ink leading-tight mb-1">
                Discard changes?
              </h4>
              <p className="text-[12.5px] text-muted mb-4 leading-snug">
                You have unsaved edits on this entry. Closing now will lose them.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscard(false)}
                  className="planner-nav-btn px-3.5 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm text-[13px] text-ink"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDiscard(false); onClose(); }}
                  className="planner-nav-btn px-3.5 py-2 rounded-lg bg-accent text-paper-cool text-[13px] font-medium hover:bg-accent/90"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function SerifField({ label, wide = false, children }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="font-serif text-[13px] font-medium text-ink block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
