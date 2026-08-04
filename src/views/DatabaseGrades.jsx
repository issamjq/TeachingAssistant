import React, { useEffect, useMemo, useState } from "react";
import { Plus, Eye, EyeOff, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Field, Modal, ConfirmDelete, RowActions, SortHeader, useSortable,
  inputClasses, selectClasses, api, apiList,
} from "./_shared";
import { useT } from "../lib/i18n";

export default function DatabaseGrades() {
  const t = useT();
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [publishing, setPublishing] = useState(false);

  // A grade is a draft until the teacher releases it. Nothing reads
  // published_at yet — the student and parent portals will — but the teacher
  // decides now, so that when those portals arrive the history is already
  // correct rather than every past grade appearing at once.
  const setPublished = async (ids, published) => {
    if (!ids.length) return;
    setPublishing(true);
    try {
      await api("/api/grades/publish", { method: "POST", body: { ids, published } });
      const stamp = published ? new Date().toISOString() : null;
      setRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, published_at: stamp } : r)));
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const reload = () => {
    setLoading(true);
    Promise.all([apiList("/api/grades"), apiList("/api/students")])
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

  const draftIds = useMemo(() => filtered.filter((r) => !r.published_at).map((r) => r.id), [filtered]);

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
      alert(t("gb.deleteFailed", { msg: e.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("gb.eyebrow")}
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {t("gb.titleA")} <em className="italic font-light text-accent">{t("gb.titleEm")}</em>
          </h2>
          <p className="text-muted mt-2">
            {t("gb.lead")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftIds.length > 0 && (
            <Button
              variant="secondary"
              disabled={publishing}
              onClick={() => setPublished(draftIds, true)}
              title={t("gb.releaseHint")}
            >
              <Send size={14} className="mr-2" />
              {publishing
                ? t("gb.releasing")
                : t(draftIds.length === 1 ? "gb.release" : "gb.releasePlural", { n: draftIds.length })}
            </Button>
          )}
          <Button onClick={() => setEditing("new")}>
            <Plus size={15} className="mr-2" /> {t("gb.record")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <select className={selectClasses + " md:max-w-xs"} value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">{t("gb.allStudents")}</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name} {s.section ? `(${s.section})` : ""}
            </option>
          ))}
        </select>
        <select className={selectClasses + " md:max-w-xs"} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">{t("gb.allSubjects")}</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading
          ? t("gb.loading")
          : <>{t("gb.showing")} <span className="text-ink">{sorted.length}</span> {t("gb.ofEntries", { total: rows.length })}</>}
      </p>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label={t("gb.col.student")} sortKey="student" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label={t("gb.col.subject")} sortKey="subject" sort={sort} onToggle={toggle} />
                  <SortHeader label={t("gb.col.term")} sortKey="term" sort={sort} onToggle={toggle} />
                  <SortHeader label={t("gb.col.category")} sortKey="category" sort={sort} onToggle={toggle} />
                  <SortHeader label={t("gb.col.score")} sortKey="pct" sort={sort} onToggle={toggle} />
                  <SortHeader label={t("gb.col.recorded")} sortKey="recorded_at" sort={sort} onToggle={toggle} />
                  <th className="py-3 text-left">{t("gb.col.visibleTo")}</th>
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
                      <td className="py-3">
                        <button
                          type="button"
                          disabled={publishing}
                          onClick={() => setPublished([r.id], !r.published_at)}
                          title={r.published_at
                            ? t("gb.withdrawHint")
                            : t("gb.releaseRowHint")}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition disabled:opacity-50 ${
                            r.published_at
                              ? "border-sage/40 bg-sage/[0.10] text-sage hover:bg-sage hover:text-paper-cool"
                              : "border-line bg-paper-cool text-muted hover:border-ink hover:text-ink"
                          }`}
                        >
                          {r.published_at ? <Eye size={11} /> : <EyeOff size={11} />}
                          {r.published_at ? t("gb.released") : t("gb.onlyMe")}
                        </button>
                      </td>
                      <td className="py-3 px-5">
                        <RowActions onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                      </td>
                    </tr>
                  );
                })}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      {t("gb.empty")}
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
        title={t("gb.deleteTitle")}
        message={t("gb.deleteMsg")}
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
  const t = useT();
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
      eyebrow={isNew ? t("gb.modal.newEyebrow") : t("gb.modal.editEyebrow")}
      title={isNew ? t("gb.modal.newTitle") : t("gb.modal.editTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? t("sch.saving") : t("common.save")}</Button>
        </>
      }
    >
      {err && <div className="mb-4 bg-paper border border-accent rounded-lg p-3"><p className="text-sm text-accent">{err}</p></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label={t("gb.f.student")}>
            <select className={selectClasses} value={form.student_id} onChange={(e) => set("student_id", e.target.value)} required>
              <option value="">{t("gb.f.pickStudent")}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.grade}{s.section ? ` · ${s.section}` : ""})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t("gb.f.subject")}>
          <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} required />
        </Field>
        <Field label={t("gb.f.term")}>
          <input className={inputClasses} value={form.term} placeholder={t("gb.f.termPlaceholder")} onChange={(e) => set("term", e.target.value)} />
        </Field>
        <Field label={t("gb.f.category")}>
          <input className={inputClasses} value={form.category} placeholder={t("gb.f.categoryPlaceholder")} onChange={(e) => set("category", e.target.value)} />
        </Field>
        <Field label={t("gb.f.score")}>
          <input type="number" className={inputClasses} value={form.score} onChange={(e) => set("score", e.target.value)} required />
        </Field>
        <Field label={t("gb.f.outOf")}>
          <input type="number" className={inputClasses} value={form.max_score} onChange={(e) => set("max_score", e.target.value)} required />
        </Field>
        <div className="md:col-span-2">
          <Field label={t("gb.f.notes")}>
            <textarea rows={2} className={inputClasses} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
