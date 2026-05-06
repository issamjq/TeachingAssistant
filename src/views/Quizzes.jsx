import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RowActions, ConfirmDelete, SortHeader, useSortable, api,
} from "./_shared";

export default function Quizzes({ onOpenQuiz }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    api("/api/quizzes")
      .then((data) => { setQuizzes(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const { sorted, sort, toggle } = useSortable(quizzes, {
    defaultKey: "scheduled_for",
    defaultDir: "desc",
  });

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/quizzes/${deleting.id}`, { method: "DELETE" });
      setQuizzes((rows) => rows.filter((r) => r.id !== deleting.id));
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
            <span className="w-6 h-px bg-accent" /> Quizzes & exams
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Quizzes &amp; <em className="italic font-light text-accent">exams</em>
          </h2>
          <p className="text-muted mt-2">Build, schedule, and grade. MCQ, true/false, short, and essay.</p>
        </div>
        <Button onClick={() => onOpenQuiz?.({})}>
          <Plus size={15} className="mr-2" /> New quiz
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? "Loading…" : <>Showing <span className="text-ink">{sorted.length}</span> {sorted.length === 1 ? "quiz" : "quizzes"}</>}
      </p>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label="Title" sortKey="title" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label="Subject" sortKey="subject" sort={sort} onToggle={toggle} />
                  <SortHeader label="Grade · Section" sortKey="grade" sort={sort} onToggle={toggle} />
                  <SortHeader label="Marks" sortKey="total_marks" sort={sort} onToggle={toggle} />
                  <SortHeader label="Duration" sortKey="duration_minutes" sort={sort} onToggle={toggle} />
                  <SortHeader label="Scheduled" sortKey="scheduled_for" sort={sort} onToggle={toggle} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onToggle={toggle} />
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition cursor-pointer"
                    onClick={() => onOpenQuiz?.(q)}
                  >
                    <td className="py-4 px-5 text-ink">{q.title}</td>
                    <td className="py-4 text-muted">{q.subject || "—"}</td>
                    <td className="py-4 text-muted">
                      {q.grade || "—"}{q.section ? ` · ${q.section}` : ""}
                    </td>
                    <td className="py-4 text-ink-soft">{q.total_marks ?? "—"}</td>
                    <td className="py-4 text-ink-soft">
                      {q.duration_minutes ? `${q.duration_minutes} min` : "—"}
                    </td>
                    <td className="py-4 text-ink-soft text-xs">
                      {q.scheduled_for ? new Date(q.scheduled_for).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4">
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper">
                        {q.status}
                      </span>
                    </td>
                    <td className="py-4 px-5" onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        onEdit={() => onOpenQuiz?.(q)}
                        onDelete={() => setDeleting(q)}
                      />
                    </td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      No quizzes yet — click &ldquo;New quiz&rdquo; to build one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        message="This quiz, all its questions, and recorded scores will be removed."
      />
    </div>
  );
}
