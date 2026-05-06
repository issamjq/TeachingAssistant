import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import {
  Field, Modal, ConfirmDelete, RowActions,
  inputClasses, selectClasses, api, timeAgo,
} from "./_shared";

export default function Activities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    api("/api/activities")
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
      await api(`/api/activities/${deleting.id}`, { method: "DELETE" });
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
            <span className="w-6 h-px bg-accent" /> Activities
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Classroom <em className="italic font-light text-accent">activities</em>
          </h2>
          <p className="text-muted mt-2">Pair-work, group tasks, individual exercises — with materials and timing.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> New activity
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((a) => (
            <Card key={a.id} className="hover:border-ink transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded">
                    {a.type || "—"}
                  </span>
                  <RowActions
                    onEdit={() => setEditing(a)}
                    onDelete={() => setDeleting(a)}
                  />
                </div>
                <h3 className="font-serif text-xl font-medium text-ink mb-1.5">{a.title}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-3">
                  {a.subject || "—"}{a.grade ? ` · ${a.grade}` : ""}
                  {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                </p>
                {a.instructions && (
                  <p className="text-sm text-ink-soft mb-3 leading-relaxed line-clamp-3">{a.instructions}</p>
                )}
                <div className="pt-3 border-t border-dashed border-line">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Updated {timeAgo(a.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && (
            <button
              onClick={() => setEditing("new")}
              className="border border-dashed border-line bg-paper-cool/50 rounded-xl p-5 flex flex-col items-center justify-center text-muted hover:border-ink hover:text-ink transition min-h-[180px] md:col-span-2"
            >
              <Plus size={20} className="mb-3" />
              <p className="font-medium text-sm">Create your first activity</p>
            </button>
          )}
        </div>
      )}

      {editing && (
        <ActivityModal
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
        message="This activity will be removed permanently."
      />
    </div>
  );
}

function ActivityModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => ({
    title: initial?.title || "",
    type: initial?.type || "individual",
    subject: initial?.subject || "",
    grade: initial?.grade || "",
    duration_minutes: initial?.duration_minutes || 15,
    instructions: initial?.instructions || "",
    materials: initial?.materials || [],
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = isNew
        ? await api("/api/activities", { method: "POST", body: form })
        : await api(`/api/activities/${initial.id}`, { method: "PATCH", body: form });
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
      eyebrow={isNew ? "New activity" : "Edit activity"}
      title={isNew ? "Plan an activity" : `Edit "${initial.title}"`}
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
        <Field label="Type">
          <select className={selectClasses} value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="individual">Individual</option>
            <option value="pair">Pair</option>
            <option value="group">Group</option>
          </select>
        </Field>
        <Field label="Duration (minutes)">
          <input type="number" className={inputClasses} value={form.duration_minutes ?? ""} onChange={(e) => set("duration_minutes", e.target.value === "" ? null : Number(e.target.value))} />
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
      </div>
      <div className="mt-4">
        <Field label="Instructions">
          <textarea rows={4} className={inputClasses} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
