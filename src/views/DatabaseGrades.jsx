"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Field, Modal, ConfirmDelete, RowActions, SortHeader, useSortable,
  inputClasses, selectClasses, api,
} from "./_shared";

export default function DatabaseGrades() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const reload = () => {
    setLoading(true);
    Promise.all([api("/api/grades"), api("/api/students")])
      .then(([g, s]) => {
        setRows(g);
        setStudents(s);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const studentMap = useMemo(() => {
    const m = new Map();
    students.forEach((s) => m.set(s.id, s));
    return m;
  }, [students]);

  const subjectOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.subject).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let xs = rows;
    if (studentFilter) xs = xs.filter((r) => String(r.student_id) === studentFilter);
    if (subjectFilter) xs = xs.filter((r) => r.subject === subjectFilter);
    return xs;
  }, [rows, studentFilter, subjectFilter]);

  const { sorted, sort, toggle } = useSortable(filtered, {
    defaultKey: "recorded_at",
    defaultDir: "desc",
    getValue: (r, key) => {
      if (key === "student") {
        const s = studentMap.get(r.student_id);
        return s ? `${s.first_name} ${s.last_name}` : "";
      }
      if (key === "pct") {
        return r.max_score ? Number(r.score) / Number(r.max_score) : 0;
      }
      return r[key];
    },
  });

  const onSaved = (saved, isNew) => {
    if (isNew) setRows((xs) => [saved, ...xs]);
    else setRows((xs) => xs.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/grades/${deleting.id}`, { method: "DELETE" });
      setRows((xs) => xs.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Grades
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Per-student <em className="italic font-light text-accent">grades</em>
          </h2>
          <p className="text-muted mt-2">
            Record one-off grades — projects, oral, participation. Quizzes &amp; homework you grade
            elsewhere flow into Reports automatically.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> Record grade
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <select className={selectClasses + " md:max-w-xs"} value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name} {s.section ? `(${s.section})` : ""}
            </option>
          ))}
        </select>
        <select className={selectClasses + " md:max-w-xs"} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">All subjects</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? "Loading…" : <>Showing <span className="text-ink">{sorted.length}</span> of {rows.length} entries</>}
      </p>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label="Student" sortKey="student" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label="Subject" sortKey="subject" sort={sort} onToggle={toggle} />
                  <SortHeader label="Term" sortKey="term" sort={sort} onToggle={toggle} />
                  <SortHeader label="Category" sortKey="category" sort={sort} onToggle={toggle} />
                  <SortHeader label="Score" sortKey="pct" sort={sort} onToggle={toggle} />
                  <SortHeader label="Recorded" sortKey="recorded_at" sort={sort} onToggle={toggle} />
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const s = studentMap.get(r.student_id);
                  const pct = r.max_score ? Math.round((Number(r.score) / Number(r.max_score)) * 100) : null;
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                      <td className="py-3 px-5 text-ink">
                        {s ? `${s.first_name} ${s.last_name}` : <span className="text-muted">deleted student</span>}
                      </td>
                      <td className="py-3 text-muted">{r.subject}</td>
                      <td className="py-3 text-muted text-xs">{r.term || "—"}</td>
                      <td className="py-3 text-muted text-xs">{r.category || "—"}</td>
                      <td className="py-3 text-ink-soft">
                        {r.score} / {r.max_score}
                        {pct != null && <span className="font-mono text-[10px] text-muted ml-2">({pct}%)</span>}
                      </td>
                      <td className="py-3 text-muted text-xs">
                        {r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-5">
                        <RowActions onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                      </td>
                    </tr>
                  );
                })}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      No grade entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <GradeModal
          initial={editing === "new" ? null : editing}
          students={students}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete grade entry?"
        message="This entry will be removed and the student's average will recompute."
      />
    </div>
  );
}

const EMPTY = {
  student_id: "",
  subject: "",
  term: "",
  category: "",
  score: "",
  max_score: 100,
  notes: "",
};

function GradeModal({ initial, students, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => initial ? { ...EMPTY, ...initial } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const body = {
        ...form,
        student_id: Number(form.student_id),
        score: Number(form.score),
        max_score: Number(form.max_score),
      };
      const saved = isNew
        ? await api("/api/grades", { method: "POST", body })
        : await api(`/api/grades/${initial.id}`, { method: "PATCH", body });
      onSaved(saved, isNew);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open onClose={onClose}
      eyebrow={isNew ? "New grade" : "Edit grade"}
      title={isNew ? "Record a grade" : "Edit grade entry"}
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
          <Field label="Student">
            <select className={selectClasses} value={form.student_id} onChange={(e) => set("student_id", e.target.value)} required>
              <option value="">— pick a student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.grade}{s.section ? ` · ${s.section}` : ""})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subject">
          <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} required />
        </Field>
        <Field label="Term (optional)">
          <input className={inputClasses} value={form.term} placeholder="e.g. Term 1" onChange={(e) => set("term", e.target.value)} />
        </Field>
        <Field label="Category (optional)">
          <input className={inputClasses} value={form.category} placeholder="e.g. Project" onChange={(e) => set("category", e.target.value)} />
        </Field>
        <Field label="Score">
          <input type="number" className={inputClasses} value={form.score} onChange={(e) => set("score", e.target.value)} required />
        </Field>
        <Field label="Out of">
          <input type="number" className={inputClasses} value={form.max_score} onChange={(e) => set("max_score", e.target.value)} required />
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes (optional)">
            <textarea rows={2} className={inputClasses} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
