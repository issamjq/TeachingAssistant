import React, { useEffect, useState } from "react";
import { ListChecks, Pencil, Trash2 } from "lucide-react";
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

export default function Activities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [completionsFor, setCompletionsFor] = useState(null);
  const [viewMode, setViewMode] = useViewMode("mudir.view.activities", "cards");

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
      <DataPageHeader
        eyebrow="Activities"
        title={<>Classroom <em className="italic font-light text-accent">activities</em></>}
        subtitle="Pair-work, group tasks, individual exercises — with materials and timing."
        newLabel="New activity"
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
          No activities yet — click &ldquo;New activity&rdquo; to create one.
        </div>
      )}

      {viewMode === "cards" && items.length > 0 && (
        <CardsGrid>
          {items.map((a) => (
            <DataCard
              key={a.id}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
            >
              <div className="pr-16 flex-1 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
                  {a.type || "—"}
                </span>
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">{a.title}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {a.subject || "—"}{a.grade ? ` · ${a.grade}` : ""}
                  {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                </p>
                {a.instructions && (
                  <p className="text-sm text-ink-soft mt-1 leading-relaxed line-clamp-3">{a.instructions}</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  Updated {timeAgo(a.updated_at)}
                </span>
                <button
                  onClick={() => setCompletionsFor(a)}
                  className="inline-flex items-center gap-1.5 text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                >
                  <ListChecks size={13} /> Completions
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
                <th className="text-left py-3 font-medium">Type</th>
                <th className="text-left py-3 font-medium">Subject</th>
                <th className="text-left py-3 font-medium">Grade</th>
                <th className="text-left py-3 font-medium">Duration</th>
                <th className="text-left py-3 font-medium">Updated</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                  <td className="py-4 px-5 text-ink">{a.title}</td>
                  <td className="py-4 text-muted">{a.type || "—"}</td>
                  <td className="py-4 text-muted">{a.subject || "—"}</td>
                  <td className="py-4 text-muted">{a.grade || "—"}</td>
                  <td className="py-4 text-ink-soft">{a.duration_minutes ? `${a.duration_minutes} min` : "—"}</td>
                  <td className="py-4 text-ink-soft text-xs">{timeAgo(a.updated_at)}</td>
                  <td className="py-4 px-5 text-right">
                    <ListRowActions onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ActivityModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {completionsFor && (
        <CompletionsModal
          activity={completionsFor}
          onClose={() => setCompletionsFor(null)}
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

function CompletionsModal({ activity, onClose }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api(`/api/activities/${activity.id}/completions`).then(setRows).catch(() => {});
  }, [activity.id]);

  const update = async (sid, patch) => {
    await api(`/api/activities/${activity.id}/completions/${sid}`, {
      method: "PUT",
      body: patch,
    });
    api(`/api/activities/${activity.id}/completions`).then(setRows);
  };

  return (
    <Modal
      open onClose={onClose}
      eyebrow={activity.title}
      title="Completions"
      wide
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
              <th className="text-left py-2 font-medium">Student</th>
              <th className="text-left py-2 font-medium">Status</th>
              <th className="text-left py-2 font-medium">Notes</th>
              <th className="text-left py-2 font-medium">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id} className="border-b border-line/60 last:border-0">
                <td className="py-2 text-ink">
                  {r.first_name} {r.last_name}{" "}
                  <span className="font-mono text-[10px] text-muted ml-1">{r.code}</span>
                </td>
                <td className="py-2">
                  <select
                    defaultValue={r.status || "Pending"}
                    onChange={(e) => update(r.student_id, { status: e.target.value })}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-xs"
                  >
                    {["Pending", "Done", "Partial", "Skipped"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="py-2">
                  <input
                    defaultValue={r.notes ?? ""}
                    onBlur={(e) => update(r.student_id, { notes: e.target.value || null })}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-xs w-full"
                  />
                </td>
                <td className="py-2 text-muted text-xs">
                  {r.recorded_at ? new Date(r.recorded_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted">No students in your roster yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
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
