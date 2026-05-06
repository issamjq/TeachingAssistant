import React, { useEffect, useState } from "react";
import { Plus, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import {
  Field, Modal, ConfirmDelete, RowActions, SortHeader, useSortable,
  AttachmentsList, inputClasses, selectClasses, api,
} from "./_shared";

export default function Homework() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [submissionsFor, setSubmissionsFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Homework
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            <em className="italic font-light text-accent">Homework</em> tasks
          </h2>
          <p className="text-muted mt-2">Assign work to a class, track who&rsquo;s done it, grade and give feedback.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> New homework
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? "Loading…" : <>Showing <span className="text-ink">{sorted.length}</span> assignments</>}
      </p>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label="Title" sortKey="title" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label="Subject" sortKey="subject" sort={sort} onToggle={toggle} />
                  <SortHeader label="Class" sortKey="grade" sort={sort} onToggle={toggle} />
                  <SortHeader label="Due" sortKey="due_date" sort={sort} onToggle={toggle} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onToggle={toggle} />
                  <th className="text-left py-3 font-medium">Submissions</th>
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
                    <td className="py-4">
                      <button
                        onClick={() => setSubmissionsFor(h)}
                        className="inline-flex items-center gap-1.5 text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                      >
                        <ListChecks size={13} /> Open
                      </button>
                    </td>
                    <td className="py-4 px-5">
                      <RowActions onEdit={() => setEditing(h)} onDelete={() => setDeleting(h)} />
                    </td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      No homework yet — click &ldquo;New homework&rdquo; to assign one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <HomeworkModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {submissionsFor && (
        <SubmissionsModal
          homework={submissionsFor}
          onClose={() => setSubmissionsFor(null)}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        message="The homework and all submission records will be removed."
      />
    </div>
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

function SubmissionsModal({ homework, onClose }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api(`/api/homework/${homework.id}/submissions`).then(setRows).catch(() => {});
  }, [homework.id]);

  const update = async (sid, patch) => {
    await api(`/api/homework/${homework.id}/submissions/${sid}`, { method: "PUT", body: patch });
    api(`/api/homework/${homework.id}/submissions`).then(setRows);
  };

  return (
    <Modal open onClose={onClose} eyebrow={homework.title} title="Submissions" wide
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
              <th className="text-left py-2 font-medium">Student</th>
              <th className="text-left py-2 font-medium">Status</th>
              <th className="text-left py-2 font-medium">Score</th>
              <th className="text-left py-2 font-medium">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id} className="border-b border-line/60 last:border-0">
                <td className="py-2 text-ink">
                  {r.first_name} {r.last_name} <span className="font-mono text-[10px] text-muted ml-1">{r.code}</span>
                </td>
                <td className="py-2">
                  <select
                    defaultValue={r.status || "Pending"}
                    onChange={(e) => update(r.student_id, { status: e.target.value })}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-xs"
                  >
                    {["Pending", "Submitted", "Late", "Missing"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    defaultValue={r.score ?? ""}
                    onBlur={(e) => update(r.student_id, { score: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-20 rounded-md border border-line bg-paper px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-2">
                  <input
                    defaultValue={r.feedback ?? ""}
                    onBlur={(e) => update(r.student_id, { feedback: e.target.value || null })}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-xs w-full"
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted">No students in your roster.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
