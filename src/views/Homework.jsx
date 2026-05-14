import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import {
  Field, Modal, ConfirmDelete, SortHeader, useSortable,
  AttachmentsList, inputClasses, selectClasses, api,
} from "./_shared";
import {
  DataPageHeader, DataCard, CardsGrid, useViewMode,
} from "./_data-view";

export default function Homework() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useViewMode("mudir.view.homework", "cards");

  const reload = () => {
    setLoading(true);
    api("/api/homework")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const { sorted, sort, toggle } = useSortable(items, {
    defaultKey: "due_date",
    defaultDir: "asc",
  });

  const onSaved = (saved, isNew) => {
    if (isNew) setItems((rows) => [saved, ...rows]);
    else setItems((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/homework/${deleting.id}`, { method: "DELETE" });
      setItems((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <DataPageHeader
        eyebrow="Homework"
        title={<><em className="italic font-light text-accent">Homework</em> tasks</>}
        subtitle="Assign work to a class, track who's done it, grade and give feedback."
        newLabel="New homework"
        onNewManual={() => setEditing("new")}
        aiKind="homework"
        mode={viewMode}
        onModeChange={setViewMode}
      />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? "Loading…" : <>Showing <span className="text-ink">{sorted.length}</span> assignments</>}
      </p>

      {!loading && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          No homework yet — click &ldquo;New homework&rdquo; to assign one.
        </div>
      )}

      {viewMode === "cards" && sorted.length > 0 && (
        <CardsGrid>
          {sorted.map((h) => (
            <DataCard
              key={h.id}
              onEdit={() => setEditing(h)}
              onDelete={() => setDeleting(h)}
            >
              <div className="pr-16 flex-1 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
                  {h.status}
                </span>
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">
                  {h.title}
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {h.subject || "—"}
                  {h.grade ? ` · ${h.grade}` : ""}
                  {h.section ? ` · ${h.section}` : ""}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-dashed border-line">
                  <Stat label="Due" value={h.due_date ? new Date(h.due_date).toLocaleDateString() : "—"} />
                  <Stat label="Section" value={h.section || "—"} />
                </div>
              </div>
            </DataCard>
          ))}
        </CardsGrid>
      )}

      {viewMode === "list" && sorted.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label="Title" sortKey="title" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label="Subject" sortKey="subject" sort={sort} onToggle={toggle} />
                  <SortHeader label="Class" sortKey="grade" sort={sort} onToggle={toggle} />
                  <SortHeader label="Due" sortKey="due_date" sort={sort} onToggle={toggle} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onToggle={toggle} />
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => (
                  <tr key={h.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-4 px-5 text-ink">{h.title}</td>
                    <td className="py-4 text-muted">{h.subject || "—"}</td>
                    <td className="py-4 text-muted">
                      {h.grade || "—"}{h.section ? ` · ${h.section}` : ""}
                    </td>
                    <td className="py-4 text-ink-soft text-xs">
                      {h.due_date ? new Date(h.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4">
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper">
                        {h.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <ListRowActions onEdit={() => setEditing(h)} onDelete={() => setDeleting(h)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <HomeworkModal
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
        message="The homework will be removed."
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[12px] text-ink mt-0.5 truncate">{value}</p>
    </div>
  );
}

function ListRowActions({ onEdit, onDelete }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={onEdit} aria-label="Edit"
        className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition">
        <Pencil size={12} strokeWidth={2} className="text-ink-soft" />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete"
        className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-accent hover:border-accent hover:text-paper-cool text-ink-soft flex items-center justify-center transition">
        <Trash2 size={12} strokeWidth={2} />
      </button>
    </span>
  );
}

const EMPTY = {
  title: "",
  subject: "",
  grade: "",
  section: "",
  instructions: "",
  due_date: "",
  status: "Open",
  attachments: [],
};

function HomeworkModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => initial
    ? {
        ...EMPTY,
        ...initial,
        due_date: initial.due_date ? initial.due_date.slice(0, 10) : "",
        attachments: Array.isArray(initial.attachments) ? initial.attachments : [],
      }
    : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = isNew
        ? await api("/api/homework", { method: "POST", body: form })
        : await api(`/api/homework/${initial.id}`, { method: "PATCH", body: form });
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
      eyebrow={isNew ? "New homework" : "Edit homework"}
      title={isNew ? "Assign homework" : `Edit "${initial.title}"`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
      {err && <div className="mb-4 bg-paper border border-accent rounded-lg p-3"><p className="text-sm text-accent">{err}</p></div>}
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
        <Field label="Due date">
          <input type="date" className={inputClasses} value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </Field>
        <Field label="Status">
          <select className={selectClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option>Open</option>
            <option>Closed</option>
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Instructions">
          <textarea rows={4} className={inputClasses} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </Field>
      </div>
      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Attachments (links)</p>
        <AttachmentsList
          value={form.attachments}
          onChange={(v) => set("attachments", v)}
        />
      </div>
    </Modal>
  );
}

