"use client";

import { flash } from "@/shared/lib/flash";
import React, { useEffect, useState } from "react";
import { useAutoRefresh } from "@/shared/hooks/useAutoRefresh";
import { Pencil, Trash2 } from "lucide-react";
import {
  ConfirmDelete, SortHeader, useSortable, api, fmtRowTimestamp,
} from "./_shared";
import {
  DataPageHeader, DataCard, CardsGrid, useViewMode,
  useDateScope, filterByDateScope,
} from "./_data-view";
import { ExportMenu } from "@/components/ui/export-menu";
import { SkeletonCards, SkeletonList } from "@/components/ui/skeleton";
import { DeliveryChip, useDeliveryMap } from "@/features/delivery";
import { quizToDoc } from "../lib/toDoc";
import { useT } from "../lib/i18n";

export default function Quizzes({ onOpenQuiz }) {
  const t = useT();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useViewMode("murchid.view.quizzes", "cards");
  // draft_id → timetable entries. A quiz's own scheduled_for is a label;
  // only a timetable slot delivers it, and each row says which it has.
  const deliveryMap = useDeliveryMap();
  const [sortKey, setSortKey] = useState("scheduled_for-desc");
  const [scope, setScope, scopeRange] = useDateScope();

  const reload = (silent = false) => {
    if (!silent) setLoading(true);
    api("/api/quizzes")
      .then((data) => { setQuizzes(data); setLoading(false); })
      .catch((err) => { if (!silent) setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);
  // Keep the list live: revalidate on focus, tab-visible, and a gentle poll.
  useAutoRefresh(() => reload(true));

  // Drive the existing useSortable from the dropdown so the card view
  // can be sorted without clicking column headers.
  const [sortField, sortDir] = sortKey.split("-");
  const { sorted: sortedAll, sort, toggle, setSort } = useSortable(quizzes, {
    defaultKey: sortField,
    defaultDir: sortDir,
  });
  useEffect(() => { setSort({ key: sortField, dir: sortDir }); }, [sortKey, setSort, sortField, sortDir]);
  const sorted = filterByDateScope(sortedAll, scopeRange, (q) => q.scheduled_for);

  // Build the export doc for a row — the list only has summary fields, so
  // pull the full quiz + its questions before mapping.
  const buildQuizDoc = async (q) => {
    const [full, questions] = await Promise.all([
      api(`/api/quizzes/${q.id}`).catch(() => q),
      api(`/api/quizzes/${q.id}/questions`).catch(() => []),
    ]);
    return quizToDoc(full || q, questions || [], t);
  };
  const quizExport = (q) => (
    <ExportMenu compact formats={["pdf", "doc", "md"]} buildDoc={() => buildQuizDoc(q)} />
  );

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/quizzes/${deleting.id}`, { method: "DELETE" });
      setQuizzes((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      flash(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <DataPageHeader
        eyebrow={t("q.eyebrow")}
        title={<>{t("q.titlePlain")}<em className="italic font-light text-accent">{t("q.titleEm")}</em></>}
        subtitle={t("q.sub")}
        newLabel={t("q.new")}
        onNewManual={() => onOpenQuiz?.({})}
        aiKind="quiz"
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/quizzes"
        onTrashChange={reload}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={[
          { value: "scheduled_for-desc", label: t("sort.scheduledNewest") },
          { value: "scheduled_for-asc",  label: t("sort.scheduledOldest") },
          { value: "title-asc",          label: t("sort.titleAz") },
          { value: "title-desc",         label: t("sort.titleZa") },
          { value: "total_marks-desc",   label: t("sort.mostMarks") },
          { value: "duration_minutes-desc", label: t("sort.longestDuration") },
        ]}
        dateScope={scope}
        onDateScopeChange={setScope}
      />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? t("chip.loading") : <>{sorted.length} {t("q.eyebrow")}</>}
      </p>

      {loading && (viewMode === "cards" ? <SkeletonCards /> : <SkeletonList />)}

      {!loading && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          {t("q.empty")}
        </div>
      )}

      {viewMode === "cards" && sorted.length > 0 && (
        <CardsGrid>
          {sorted.map((q) => (
            <DataCard
              key={q.id}
              onEdit={() => onOpenQuiz?.(q)}
              onDelete={() => setDeleting(q)}
              exportNode={quizExport(q)}
              timestamp={fmtRowTimestamp(q)}
            >
              <button
                type="button"
                onClick={() => onOpenQuiz?.(q)}
                className="text-left flex-1 flex flex-col gap-2 pe-16 w-full"
              >
                <span className="flex flex-wrap items-center gap-1.5 self-start">
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded">
                    {q.status}
                  </span>
                  {deliveryMap && <DeliveryChip entries={deliveryMap.get(String(q.id))} />}
                </span>
                {/* Title clamps to 2 lines and reserves that height so
                    the meta line below it sits at the same baseline
                    across every card in the row. */}
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1 line-clamp-2 min-h-[2.6em]">
                  {q.title}
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted line-clamp-2 min-h-[2.4em]">
                  {q.subject || "—"}
                  {q.grade ? ` · ${q.grade}` : ""}
                  {q.section ? ` · ${q.section}` : ""}
                </p>
                {/* mt-auto pins the stats row to the bottom edge so
                    Marks / Duration / Scheduled line up across cards
                    regardless of title length. */}
                <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-dashed border-line">
                  <Stat label={t("card.marks")} value={q.total_marks ?? "—"} />
                  {/* "40 min" was a bare Latin run in an RTL paragraph, and
                      bidi reordered it to "min 40". Translating the unit
                      fixes the reading order because the whole string is
                      then RTL, rather than papering over it with an
                      isolate. */}
                  <Stat
                    label={t("card.duration")}
                    value={q.duration_minutes
                      ? t("card.minutes", { n: String(q.duration_minutes) })
                      : "—"}
                  />
                  <Stat label={t("card.scheduled")} value={fmtShortDate(q.scheduled_for)} />
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
                      {q.duration_minutes
                        ? t("card.minutes", { n: String(q.duration_minutes) })
                        : "—"}
                    </td>
                    <td className="py-4 text-ink-soft text-xs">
                      {q.scheduled_for ? new Date(q.scheduled_for).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper">
                          {q.status}
                        </span>
                        {deliveryMap && <DeliveryChip entries={deliveryMap.get(String(q.id))} />}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <ListRowActions onEdit={() => onOpenQuiz?.(q)} onDelete={() => setDeleting(q)} exportNode={quizExport(q)} />
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
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[12px] text-ink mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
    </div>
  );
}

// Short, calendar-friendly date label — e.g. "May 18". Falls back to
// an em dash when there is no value, so card stats stay aligned.
function fmtShortDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Same edit/delete affordance as DataCard but inline for list rows.
function ListRowActions({ onEdit, onDelete, exportNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {exportNode}
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
