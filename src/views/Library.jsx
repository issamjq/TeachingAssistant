import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, ExternalLink, FileText, Video, Link as LinkIcon, Image as ImageIcon, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import {
  Field, Modal, ConfirmDelete, RowActions,
  inputClasses, selectClasses, api, timeAgo,
} from "./_shared";
import BrandLoader from "../components/BrandLoader";

const TYPE_ICON = {
  pdf: FileText, doc: FileText, video: Video, link: LinkIcon, image: ImageIcon, note: BookOpen,
};

export default function Library() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const reload = () => {
    setLoading(true);
    api("/api/library")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const filtered = useMemo(() => {
    let rows = items;
    if (typeFilter) rows = rows.filter((r) => r.type === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) => r.title.toLowerCase().includes(q) ||
               (r.subject || "").toLowerCase().includes(q) ||
               (r.notes || "").toLowerCase().includes(q) ||
               (r.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [items, query, typeFilter]);

  const onSaved = (saved, isNew) => {
    if (isNew) setItems((rows) => [saved, ...rows]);
    else setItems((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/library/${deleting.id}`, { method: "DELETE" });
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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Library
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Teaching <em className="italic font-light text-accent">library</em>
          </h2>
          <p className="text-muted mt-2">Saved files, links, and notes — your personal stash, only visible to you.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> Add resource
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 bg-paper-cool rounded-lg border border-line px-4 py-2.5 flex items-center gap-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="outline-none w-full text-sm bg-transparent text-ink placeholder:text-muted"
            placeholder="Search by title, subject, tag…"
          />
        </div>
        <select className={selectClasses} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {Object.keys(TYPE_ICON).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading ? (
        <BrandLoader compact fullscreen={false} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const Icon = TYPE_ICON[r.type] || BookOpen;
            return (
              <Card key={r.id} className="hover:border-ink transition">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg border border-line bg-paper flex items-center justify-center">
                      <Icon size={16} className="text-ink-soft" />
                    </div>
                    <RowActions
                      onEdit={() => setEditing(r)}
                      onDelete={() => setDeleting(r)}
                    />
                  </div>
                  <h3 className="font-serif text-lg text-ink mb-1">{r.title}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2">
                    {r.type || "—"}{r.subject ? ` · ${r.subject}` : ""}{r.grade ? ` · ${r.grade}` : ""}
                  </p>
                  {r.notes && <p className="text-xs text-ink-soft mb-2 line-clamp-2">{r.notes}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-line">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      {timeAgo(r.updated_at)}
                    </span>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                      >
                        Open <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <button
              onClick={() => setEditing("new")}
              className="border border-dashed border-line bg-paper-cool/50 rounded-xl p-5 flex flex-col items-center justify-center text-muted hover:border-ink hover:text-ink transition min-h-[180px] md:col-span-3"
            >
              <Plus size={20} className="mb-3" />
              <p className="font-medium text-sm">Add your first resource</p>
            </button>
          )}
        </div>
      )}

      {editing && (
        <ResourceModal
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
        message="This resource will be removed from your library."
      />
    </div>
  );
}

function ResourceModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => ({
    title: initial?.title || "",
    type: initial?.type || "link",
    subject: initial?.subject || "",
    grade: initial?.grade || "",
    url: initial?.url || "",
    notes: initial?.notes || "",
    tags: initial?.tags || [],
  }));
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = isNew
        ? await api("/api/library", { method: "POST", body: form })
        : await api(`/api/library/${initial.id}`, { method: "PATCH", body: form });
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
      eyebrow={isNew ? "New resource" : "Edit resource"}
      title={isNew ? "Add a resource" : `Edit "${initial.title}"`}
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
        <Field label="Type">
          <select className={selectClasses} value={form.type} onChange={(e) => set("type", e.target.value)}>
            {Object.keys(TYPE_ICON).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
        </Field>
        <Field label="Grade">
          <select className={selectClasses} value={form.grade} onChange={(e) => set("grade", e.target.value)}>
            <option value="">—</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="URL">
          <input className={inputClasses} value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes">
            <textarea rows={2} className={inputClasses} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Tags</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(form.tags || []).map((t) => (
            <span key={t} className="px-2 py-0.5 bg-paper border border-line text-ink-soft font-mono text-[9px] uppercase tracking-wider rounded inline-flex items-center gap-1">
              {t}
              <button onClick={() => set("tags", form.tags.filter((x) => x !== t))} className="hover:text-accent">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.preventDefault();
                set("tags", [...(form.tags || []), tagInput.trim()]);
                setTagInput("");
              }
            }}
            placeholder="Add a tag and press Enter"
            className={inputClasses + " py-1.5 text-xs max-w-xs"}
          />
        </div>
      </div>
    </Modal>
  );
}
