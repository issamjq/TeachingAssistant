import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  ConfirmDelete, SortHeader, useSortable, api,
} from "./_shared";
import {
  DataPageHeader, DataCard, CardsGrid, useViewMode,
} from "./_data-view";

export default function Quizzes({ onOpenQuiz }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useViewMode("mudir.view.quizzes", "cards");

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
      <DataPageHeader
        eyebrow="Quizzes & exams"
        title={<>Quizzes &amp; <em className="italic font-light text-accent">exams</em></>}
        subtitle="Build, schedule, and grade. MCQ, true/false, short, and essay."
        newLabel="New quiz"
        onNewManual={() => onOpenQuiz?.({})}
        aiKind="quiz"
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/quizzes"
        onTrashChange={reload}
      />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? "Loading…" : <>Showing <span className="text-ink">{sorted.length}</span> {sorted.length === 1 ? "quiz" : "quizzes"}</>}
      </p>

      {!loading && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          No quizzes yet — click &ldquo;New quiz&rdquo; to build one.
        </div>
      )}

      {viewMode === "cards" && sorted.length > 0 && (
        <CardsGrid>
          {sorted.map((q) => (
            <DataCard
              key={q.id}
              onEdit={() => onOpenQuiz?.(q)}
              onDelete={() => setDeleting(q)}
            >
              <button
                type="button"
                onClick={() => onOpenQuiz?.(q)}
                className="text-left flex-1 flex flex-col gap-2 pr-16"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
                  {q.status}
                </span>
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">
                  {q.title}
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {q.subject || "—"}
                  {q.grade ? ` · ${q.grade}` : ""}
                  {q.section ? ` · ${q.section}` : ""}
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-dashed border-line">
                  <Stat label="Marks" value={q.total_marks ?? "—"} />
                  <Stat label="Duration" value={q.duration_minutes ? `${q.duration_minutes} min` : "—"} />
                  <Stat label="Scheduled" value={q.scheduled_for ? new Date(q.scheduled_for).toLocaleDateString() : "—"} />
                </div>
              </button>
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
                    <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <ListRowActions onEdit={() => onOpenQuiz?.(q)} onDelete={() => setDeleting(q)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[12px] text-ink mt-0.5 truncate">{value}</p>
    </div>
  );
}

// Same edit/delete affordance as DataCard but inline for list rows.
function ListRowActions({ onEdit, onDelete }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition"
      >
        <Pencil size={12} strokeWidth={2} className="text-ink-soft" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-accent hover:border-accent hover:text-paper-cool text-ink-soft flex items-center justify-center transition"
      >
        <Trash2 size={12} strokeWidth={2} />
      </button>
    </span>
  );
}
