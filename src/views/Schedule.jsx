import React, { useEffect, useMemo, useState } from "react";
import { Plus, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import {
  Field, Modal, ConfirmDelete, RowActions,
  inputClasses, selectClasses, api,
} from "./_shared";

const fmtTime = (t) => (t ? t.slice(0, 5) : "");

const startOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

export default function Schedule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [view, setView] = useState("week"); // week | list

  const reload = () => {
    setLoading(true);
    api("/api/schedule")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [isoDate(d), []]));
    items.forEach((it) => {
      const key = it.date.slice(0, 10);
      if (map.has(key)) map.get(key).push(it);
    });
    return map;
  }, [items, days]);

  const onSaved = (saved, isNew) => {
    if (isNew) setItems((rows) => [...rows, saved]);
    else setItems((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/schedule/${deleting.id}`, { method: "DELETE" });
      setItems((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const shiftWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Schedule
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Your <em className="italic font-light text-accent">schedule</em>
          </h2>
          <p className="text-muted mt-2">Pick a slot and assign a lesson. Calendar sync coming later.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> New entry
        </Button>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div className="flex bg-paper-warm border border-line rounded-full p-1 text-sm">
          {["week", "list"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider transition ${
                view === v ? "bg-ink text-paper-cool" : "text-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === "week" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => shiftWeek(-1)}
              className="h-8 w-8 rounded-md border border-line hover:bg-paper-warm flex items-center justify-center"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
              {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            <button
              onClick={() => shiftWeek(1)}
              className="h-8 w-8 rounded-md border border-line hover:bg-paper-warm flex items-center justify-center"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="font-mono text-[10px] uppercase tracking-wider text-accent border-b border-accent hover:text-ink hover:border-ink"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Loading schedule from Neon…
        </p>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((d) => {
            const key = isoDate(d);
            const isToday = key === isoDate(new Date());
            const list = byDay.get(key) || [];
            return (
              <Card key={key} className={isToday ? "border-ink" : ""}>
                <CardContent className="p-3 min-h-[200px]">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className={`font-serif text-2xl ${isToday ? "text-accent" : "text-ink"} mt-0.5`}>
                    {d.getDate()}
                  </p>
                  <div className="space-y-2 mt-3">
                    {list.length === 0 && (
                      <p className="text-xs text-muted">—</p>
                    )}
                    {list.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => setEditing(it)}
                        className="block w-full text-left bg-paper border border-line rounded-md px-2 py-1.5 hover:border-ink transition"
                      >
                        <p className="font-mono text-[10px] text-ink-soft">
                          {fmtTime(it.start_time)}
                        </p>
                        <p className="text-sm text-ink leading-tight truncate">{it.title}</p>
                        <p className="text-[10px] text-muted truncate">{it.subject || "—"}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                    <th className="text-left py-3 px-5 font-medium">Date</th>
                    <th className="text-left py-3 font-medium">Time</th>
                    <th className="text-left py-3 font-medium">Lesson</th>
                    <th className="text-left py-3 font-medium">Subject</th>
                    <th className="text-left py-3 font-medium">Class</th>
                    <th className="text-left py-3 font-medium">Where</th>
                    <th className="py-3 px-5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition"
                    >
                      <td className="py-3 px-5 text-ink-soft">{new Date(it.date).toLocaleDateString()}</td>
                      <td className="py-3 font-mono text-[11px] text-ink-soft">
                        {fmtTime(it.start_time)} – {fmtTime(it.end_time)}
                      </td>
                      <td className="py-3 text-ink">{it.title}</td>
                      <td className="py-3 text-muted">{it.subject || "—"}</td>
                      <td className="py-3 text-muted">{it.section || it.grade || "—"}</td>
                      <td className="py-3 text-muted">{it.location || "—"}</td>
                      <td className="py-3 px-5">
                        <RowActions onEdit={() => setEditing(it)} onDelete={() => setDeleting(it)} />
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        No schedule entries yet — click &ldquo;New entry&rdquo; to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <ScheduleModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        message="This entry will be removed from your schedule."
      />
    </div>
  );
}

const EMPTY = {
  title: "",
  subject: "",
  grade: "",
  section: "",
  date: "",
  start_time: "",
  end_time: "",
  location: "",
  notes: "",
  status: "planned",
};

function ScheduleModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => {
    if (!initial) return { ...EMPTY, date: new Date().toISOString().slice(0, 10) };
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
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
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
            <option value="">—</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Section">
          <input className={inputClasses} value={form.section} onChange={(e) => set("section", e.target.value)} />
        </Field>
        <Field label="Location">
          <input className={inputClasses} value={form.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Date">
          <input type="date" className={inputClasses} value={form.date} onChange={(e) => set("date", e.target.value)} />
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
