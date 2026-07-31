// The class bulletin board.
//
// Modelled on the physical thing in the corner of a classroom: notes go up,
// the important ones sit at the top, out-of-date ones come down on their own.
// A teacher already knows how this works, so the screen should not need
// explaining.
//
// The one idea that is not physical: a note is written first and PUT UP
// second. Everything on this screen is private to the teacher until they post
// it — which is what stops a half-typed reminder appearing on a child's screen
// once the student and parent portals land.
import React, { useEffect, useMemo, useState } from "react";
import {
  Pin, PinOff, Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle,
  Bell, CalendarDays, BookOpen, Trophy, Link2, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonCards } from "../components/ui/skeleton";
import {
  ANNOUNCEMENT_KINDS, ANNOUNCEMENT_PRIORITIES, ANNOUNCEMENT_AUDIENCES, GRADE_LEVELS,
} from "../lib/enums";
import {
  Field, Modal, ConfirmDelete, inputClasses, selectClasses,
  api, apiList, DatePicker, useTeacherClasses,
} from "./_shared";

// Each kind gets an icon and one accent colour, used for the card's left edge
// and its badge. Colours come from the brand tokens, not new ones — a board
// that introduces six fresh colours stops looking like the rest of the app.
const KIND_STYLE = {
  Notice:      { icon: StickyNote,   tone: "text-ink-soft", edge: "bg-ink-soft/40",  chip: "bg-ink/[0.06] text-ink-soft" },
  Reminder:    { icon: Bell,         tone: "text-amber",    edge: "bg-amber",        chip: "bg-amber/[0.12] text-amber" },
  Event:       { icon: CalendarDays, tone: "text-clay",     edge: "bg-clay",         chip: "bg-clay/[0.12] text-clay" },
  Homework:    { icon: BookOpen,     tone: "text-sage",     edge: "bg-sage",         chip: "bg-sage/[0.12] text-sage" },
  Achievement: { icon: Trophy,       tone: "text-gold",     edge: "bg-gold",         chip: "bg-gold/[0.16] text-gold" },
  Resource:    { icon: Link2,        tone: "text-ink-soft", edge: "bg-line",         chip: "bg-ink/[0.06] text-ink-soft" },
};
const styleFor = (kind) => KIND_STYLE[kind] || KIND_STYLE.Notice;

const EMPTY = {
  title: "", body: "", kind: "Notice", priority: "Normal", audience: "Students",
  grade: "", section: "", pinned: false, starts_on: "", expires_on: "",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null);
const todayIso = () => new Date().toISOString().slice(0, 10);

// "Expires in 3 days" is the thing a teacher scans for, so it is computed once
// here rather than being re-derived inside the card render.
function expiryLabel(note) {
  if (!note.expires_on) return null;
  const days = Math.ceil((new Date(note.expires_on).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: "Expired", urgent: true };
  if (days === 0) return { text: "Comes down today", urgent: true };
  if (days <= 3) return { text: `${days} day${days === 1 ? "" : "s"} left`, urgent: true };
  return { text: `Until ${fmtDate(note.expires_on)}`, urgent: false };
}

export default function BulletinBoard() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kindFilter, setKindFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [showDrafts, setShowDrafts] = useState(true);

  const reload = () => {
    setLoading(true);
    apiList("/api/announcements")
      .then((rows) => { setNotes(rows); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };
  useEffect(reload, []);

  // Filtering is client-side because the whole board is one teacher's notes —
  // tens of rows, already fetched. Going back to the server for a chip click
  // would be a round-trip to filter a list the browser is holding.
  const visible = useMemo(() => {
    let rows = notes;
    if (kindFilter) rows = rows.filter((n) => n.kind === kindFilter);
    if (classFilter) rows = rows.filter((n) => `${n.grade || ""}|${n.section || ""}` === classFilter);
    if (!showDrafts) rows = rows.filter((n) => n.published_at);
    return rows;
  }, [notes, kindFilter, classFilter, showDrafts]);

  const draftCount = useMemo(() => notes.filter((n) => !n.published_at).length, [notes]);

  // Every distinct class the teacher has actually pinned something to, so the
  // filter offers real options rather than the whole timetable.
  const classOptions = useMemo(() => {
    const seen = new Map();
    for (const n of notes) {
      const key = `${n.grade || ""}|${n.section || ""}`;
      if (!seen.has(key)) {
        seen.set(key, n.grade ? `${n.grade}${n.section ? ` · ${n.section}` : ""}` : "All my classes");
      }
    }
    return [...seen.entries()];
  }, [notes]);

  const setPosted = async (ids, posted) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      await api("/api/announcements/post", { method: "POST", body: { ids, posted } });
      const stamp = posted ? new Date().toISOString() : null;
      setNotes((rs) => rs.map((n) => (ids.includes(n.id) ? { ...n, published_at: stamp } : n)));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const togglePin = async (note) => {
    setBusy(true);
    try {
      const saved = await api(`/api/announcements/${note.id}`, {
        method: "PATCH", body: { pinned: !note.pinned },
      });
      setNotes((rs) => rs.map((n) => (n.id === note.id ? { ...n, ...saved } : n)));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/announcements/${deleting.id}`, { method: "DELETE" });
      setNotes((rs) => rs.filter((n) => n.id !== deleting.id));
      setDeleting(null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const onSaved = (saved, isNew) => {
    setNotes((rs) => (isNew ? [saved, ...rs] : rs.map((n) => (n.id === saved.id ? saved : n))));
    setEditing(null);
  };

  const chip = (active) =>
    `h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[12px] border leading-none whitespace-nowrap transition ${
      active ? "bg-ink text-paper-cool border-ink" : "border-line bg-paper-cool text-ink hover:border-ink"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Bulletin board
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink leading-tight">
            Class <em className="italic font-light text-accent">notice board</em>
          </h2>
          <p className="text-muted mt-2 max-w-2xl">
            Notices, reminders and dates for your classes. Nothing here is visible to anyone
            until you put it up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setPosted(notes.filter((n) => !n.published_at).map((n) => n.id), true)}
              title="Put every draft on the board"
            >
              <Eye size={14} className="mr-2" />
              Put up {draftCount} draft{draftCount === 1 ? "" : "s"}
            </Button>
          )}
          <Button onClick={() => setEditing("new")}>
            <Plus size={15} className="mr-2" /> Write a note
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button type="button" className={chip(!kindFilter)} onClick={() => setKindFilter("")}>
          All
        </button>
        {ANNOUNCEMENT_KINDS.map((k) => {
          const { icon: Icon } = styleFor(k);
          return (
            <button key={k} type="button" className={chip(kindFilter === k)} onClick={() => setKindFilter(k)}>
              <Icon size={12} /> {k}
            </button>
          );
        })}
        {classOptions.length > 1 && (
          <select
            className={`${selectClasses} h-8 py-0 text-[12px] max-w-[190px]`}
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">Every class</option>
            {classOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        )}
        <button
          type="button"
          className={`${chip(showDrafts)} ml-auto`}
          onClick={() => setShowDrafts((v) => !v)}
          title="Show notes you haven't put up yet"
        >
          {showDrafts ? <Eye size={12} /> : <EyeOff size={12} />} Drafts
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading ? (
        <SkeletonCards />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-warm/40 p-16 text-center">
          <Pin size={22} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
          <p className="font-serif text-xl text-ink mb-1">
            {notes.length === 0 ? "The board is empty" : "Nothing matches that filter"}
          </p>
          <p className="text-muted text-sm">
            {notes.length === 0
              ? "Write your first note — a reminder, a date, or something worth celebrating."
              : "Try a different kind or class."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              busy={busy}
              onEdit={() => setEditing(n)}
              onDelete={() => setDeleting(n)}
              onTogglePin={() => togglePin(n)}
              onTogglePost={() => setPosted([n.id], !n.published_at)}
            />
          ))}
        </div>
      )}

      {editing && (
        <NoteModal
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
        title="Take this note down?"
        message="It moves to Recently deleted and can be restored for 30 days."
      />
    </div>
  );
}

// ── One pinned note ────────────────────────────────────────────────────
function NoteCard({ note, busy, onEdit, onDelete, onTogglePin, onTogglePost }) {
  const style = styleFor(note.kind);
  const Icon = style.icon;
  const expiry = expiryLabel(note);
  const posted = Boolean(note.published_at);
  const urgent = note.priority === "Urgent";

  return (
    <article
      className={`relative flex flex-col rounded-2xl border bg-paper-cool overflow-hidden transition-all duration-200
        hover:shadow-[0_22px_50px_-22px_rgba(15,20,16,0.22)] hover:border-ink/30
        ${urgent ? "border-accent/40" : "border-[#e6dccb]"}
        ${posted ? "" : "opacity-[0.72]"}`}
    >
      {/* The coloured edge is the fastest way to read the kind at a glance. */}
      <span className={`absolute inset-y-0 start-0 w-[3px] ${style.edge}`} aria-hidden />

      <div className="p-5 ps-6 flex-1">
        <div className="flex items-start justify-between gap-3 mb-2">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[9.5px] uppercase tracking-[0.14em] ${style.chip}`}>
            <Icon size={11} /> {note.kind}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {urgent && (
              <span className="inline-flex items-center gap-1 text-accent" title="Urgent">
                <AlertTriangle size={12} />
              </span>
            )}
            <button
              type="button"
              onClick={onTogglePin}
              disabled={busy}
              aria-label={note.pinned ? "Unpin" : "Pin to the top"}
              title={note.pinned ? "Unpin" : "Pin to the top"}
              className={`h-7 w-7 rounded-md border flex items-center justify-center transition disabled:opacity-50 ${
                note.pinned
                  ? "border-accent/40 bg-accent/[0.10] text-accent"
                  : "border-line bg-paper-cool text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {note.pinned ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </div>
        </div>

        <h3 className="font-serif text-[19px] font-medium text-ink leading-snug mb-1.5">
          {note.title}
        </h3>
        {note.body && (
          <p className="text-[13px] text-ink-soft leading-relaxed whitespace-pre-wrap line-clamp-5">
            {note.body}
          </p>
        )}
      </div>

      <div className="px-5 ps-6 pb-4 pt-3 border-t border-dashed border-line/70">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted mb-3">
          <span>{note.grade ? `${note.grade}${note.section ? ` · ${note.section}` : ""}` : "All my classes"}</span>
          <span className="text-line">/</span>
          <span>{note.audience}</span>
          {expiry && (
            <>
              <span className="text-line">/</span>
              <span className={expiry.urgent ? "text-accent" : ""}>{expiry.text}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onTogglePost}
            disabled={busy}
            title={posted ? "On the board — click to take it down" : "Only you can see this — click to put it up"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition disabled:opacity-50 ${
              posted
                ? "border-sage/40 bg-sage/[0.10] text-sage hover:bg-sage hover:text-paper-cool"
                : "border-line bg-paper-cool text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {posted ? <Eye size={11} /> : <EyeOff size={11} />}
            {posted ? "On the board" : "Draft"}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button" onClick={onEdit} aria-label="Edit" title="Edit"
              className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition"
            >
              <Pencil size={12} className="text-ink-soft" />
            </button>
            <button
              type="button" onClick={onDelete} aria-label="Take down" title="Take down"
              className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-accent hover:border-accent hover:text-paper-cool text-ink-soft flex items-center justify-center transition"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Write / edit a note ────────────────────────────────────────────────
function NoteModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const { grades, sections } = useTeacherClasses();
  const [form, setForm] = useState(() => (initial ? { ...EMPTY, ...initial } : EMPTY));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const gradeOptions = grades.length ? grades : GRADE_LEVELS;

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      // Only the columns the API accepts — the row we were handed carries
      // published_at, timestamps and an id, none of which are settable.
      const body = {
        title: form.title.trim(),
        body: form.body?.trim() || null,
        kind: form.kind,
        priority: form.priority,
        audience: form.audience,
        grade: form.grade || null,
        section: form.section || null,
        pinned: Boolean(form.pinned),
        starts_on: form.starts_on || null,
        expires_on: form.expires_on || null,
      };
      const saved = isNew
        ? await api("/api/announcements", { method: "POST", body })
        : await api(`/api/announcements/${initial.id}`, { method: "PATCH", body });
      onSaved(saved, isNew);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open onClose={onClose}
      eyebrow={isNew ? "New note" : "Edit note"}
      title={isNew ? "Write a note" : "Edit this note"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? "Saving…" : isNew ? "Save as draft" : "Save"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <Field label="Title">
        <input
          className={inputClasses}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Bring your calculator tomorrow"
          maxLength={200}
          autoFocus
        />
      </Field>

      <Field label="Details (optional)">
        <textarea
          className={`${inputClasses} min-h-[110px] resize-y`}
          value={form.body || ""}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Anything the class needs to know."
          maxLength={4000}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Kind">
          <select className={selectClasses} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {ANNOUNCEMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className={selectClasses} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {ANNOUNCEMENT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Who it's for">
          <select className={selectClasses} value={form.audience} onChange={(e) => set("audience", e.target.value)}>
            {ANNOUNCEMENT_AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Grade (blank = all my classes)">
          <select className={selectClasses} value={form.grade || ""} onChange={(e) => set("grade", e.target.value)}>
            <option value="">All my classes</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Section (optional)">
          <select
            className={selectClasses}
            value={form.section || ""}
            onChange={(e) => set("section", e.target.value)}
            disabled={!form.grade}
          >
            <option value="">Every section</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Put up from (optional)">
          <DatePicker
            value={form.starts_on || ""}
            onChange={(v) => set("starts_on", v)}
            className={inputClasses}
          />
        </Field>
        <Field label="Take down after (optional)">
          <DatePicker
            value={form.expires_on || ""}
            onChange={(v) => set("expires_on", v)}
            min={form.starts_on || todayIso()}
            className={inputClasses}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 mt-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(form.pinned)}
          onChange={(e) => set("pinned", e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="text-[13px] text-ink">Pin to the top of the board</span>
      </label>

      <p className="mt-4 pt-3 border-t border-dashed border-line/70 text-[12px] text-muted">
        Saved notes stay private until you put them up on the board.
      </p>
    </Modal>
  );
}
