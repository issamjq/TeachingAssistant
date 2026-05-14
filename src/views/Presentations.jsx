import React, { useEffect, useState } from "react";
import { Play, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import {
  Field, Modal, ConfirmDelete,
  inputClasses, selectClasses, api, timeAgo,
} from "./_shared";
import {
  DataPageHeader, DataCard, CardsGrid, useViewMode,
} from "./_data-view";

export default function Presentations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [presenting, setPresenting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useViewMode("mudir.view.presentations", "cards");

  const reload = () => {
    setLoading(true);
    api("/api/presentations")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const onSaved = (saved, isNew) => {
    if (isNew) setItems((rows) => [saved, ...rows]);
    else setItems((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/presentations/${deleting.id}`, { method: "DELETE" });
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
        eyebrow="Presentations"
        title={<>Slide <em className="italic font-light text-accent">decks</em></>}
        subtitle="Build slide-based presentations linked to your lessons."
        newLabel="New presentation"
        onNewManual={() => setEditing("new")}
        mode={viewMode}
        onModeChange={setViewMode}
      />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading && <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          No presentations yet — click &ldquo;New presentation&rdquo; to build one.
        </div>
      )}

      {viewMode === "cards" && items.length > 0 && (
        <CardsGrid>
          {items.map((p) => (
            <DataCard
              key={p.id}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
            >
              <div className="pr-16 flex-1 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
                  {p.status}
                </span>
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">{p.title}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {p.subject || "—"}{p.grade ? ` · ${p.grade}` : ""} · {(p.slides || []).length} slide{(p.slides || []).length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {timeAgo(p.updated_at)}
                </span>
                <button
                  onClick={() => setPresenting(p)}
                  className="inline-flex items-center gap-1.5 text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                >
                  <Play size={13} /> Present
                </button>
              </div>
            </DataCard>
          ))}
        </CardsGrid>
      )}

      {viewMode === "list" && items.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                <th className="text-left py-3 px-5 font-medium">Title</th>
                <th className="text-left py-3 font-medium">Subject</th>
                <th className="text-left py-3 font-medium">Grade</th>
                <th className="text-left py-3 font-medium">Slides</th>
                <th className="text-left py-3 font-medium">Status</th>
                <th className="text-left py-3 font-medium">Updated</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                  <td className="py-4 px-5 text-ink">{p.title}</td>
                  <td className="py-4 text-muted">{p.subject || "—"}</td>
                  <td className="py-4 text-muted">{p.grade || "—"}</td>
                  <td className="py-4 text-ink-soft">{(p.slides || []).length}</td>
                  <td className="py-4">
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper">
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 text-ink-soft text-xs">{timeAgo(p.updated_at)}</td>
                  <td className="py-4 px-5 text-right">
                    <ListRowActions onEdit={() => setEditing(p)} onDelete={() => setDeleting(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PresentationModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {presenting && (
        <PresentMode presentation={presenting} onClose={() => setPresenting(null)} />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        message="This presentation and its slides will be removed permanently."
      />
    </div>
  );
}

function PresentationModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => ({
    title: initial?.title || "",
    subject: initial?.subject || "",
    grade: initial?.grade || "",
    status: initial?.status || "Draft",
    slides: initial?.slides || [],
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = isNew
        ? await api("/api/presentations", { method: "POST", body: form })
        : await api(`/api/presentations/${initial.id}`, { method: "PATCH", body: form });
      onSaved(saved, isNew);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const updateSlide = (i, patch) => {
    setForm((f) => ({ ...f, slides: f.slides.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  };
  const addSlide = () => setForm((f) => ({ ...f, slides: [...(f.slides || []), { title: "New slide", body: "" }] }));
  const removeSlide = (i) => setForm((f) => ({ ...f, slides: f.slides.filter((_, idx) => idx !== i) }));

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={isNew ? "New presentation" : "Edit presentation"}
      title={isNew ? "Build a presentation" : `Edit "${initial.title}"`}
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
            <input className={inputClasses} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
        </div>
        <Field label="Subject">
          <input className={inputClasses} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
        </Field>
        <Field label="Grade">
          <select className={selectClasses} value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}>
            <option value="">—</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={selectClasses} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option>Draft</option>
            <option>Ready</option>
            <option>Archived</option>
          </select>
        </Field>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 mt-6">Slides</p>
      <div className="space-y-3">
        {(form.slides || []).map((s, i) => (
          <div key={i} className="bg-paper border border-line rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Slide {i + 1}</p>
              <button onClick={() => removeSlide(i)} className="text-muted hover:text-accent">
                <Trash2 size={13} />
              </button>
            </div>
            <input
              className={inputClasses + " mb-2"}
              placeholder="Slide title"
              value={s.title || ""}
              onChange={(e) => updateSlide(i, { title: e.target.value })}
            />
            <textarea
              rows={3}
              className={inputClasses + " mb-2"}
              placeholder="Content"
              value={s.body || ""}
              onChange={(e) => updateSlide(i, { body: e.target.value })}
            />
            <input
              className={inputClasses}
              placeholder="Image URL (optional)"
              value={s.image_url || ""}
              onChange={(e) => updateSlide(i, { image_url: e.target.value })}
            />
          </div>
        ))}
        <button
          onClick={addSlide}
          className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
        >
          + Add slide
        </button>
      </div>
    </Modal>
  );
}

function PresentMode({ presentation, onClose }) {
  const [idx, setIdx] = useState(0);
  const slides = presentation.slides || [];
  const cur = slides[idx];

  return (
    <div className="fixed inset-0 z-50 bg-ink text-paper-cool flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <p className="font-mono text-[10px] uppercase tracking-wider text-paper-cool/60">
          {presentation.title} · slide {idx + 1} of {slides.length || 0}
        </p>
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-wider hover:text-accent">
          Exit
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-12">
        {cur ? (
          <div className="max-w-4xl w-full text-center">
            <h2 className="font-serif text-6xl mb-8">{cur.title}</h2>
            {cur.image_url && (
              <img
                src={cur.image_url}
                alt=""
                className="max-h-[40vh] mx-auto mb-6 rounded-lg border border-white/10 object-contain"
              />
            )}
            <p className="text-2xl leading-relaxed text-paper-cool/80 whitespace-pre-line">{cur.body}</p>
          </div>
        ) : (
          <p className="text-paper-cool/60">No slides yet.</p>
        )}
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="font-mono text-[11px] uppercase tracking-wider hover:text-accent disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
          disabled={idx >= slides.length - 1}
          className="font-mono text-[11px] uppercase tracking-wider hover:text-accent disabled:opacity-30"
        >
          Next →
        </button>
      </div>
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
