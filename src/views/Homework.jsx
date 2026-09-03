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
import { homeworkToDoc } from "../lib/toDoc";
import { useT } from "../lib/i18n";
import { filterByClassScope, useClassScope } from "../shared/lib/classScope";
import StudioLauncher from "../features/studio-ai/StudioLauncher";

export default function Homework({ onOpenHomework }) {
  const t = useT();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useViewMode("murchid.view.homework", "cards");
  // draft_id → timetable entries. A due date on the row delivers nothing;
  // only a timetable slot does, and each row says which state it is in.
  const deliveryMap = useDeliveryMap();
  const [sortKey, setSortKey] = useState("due_date-asc");
  const [scope, setScope, scopeRange] = useDateScope();
  // Set by the sidebar when this library was opened from a class.
  const classScope = useClassScope();

  const reload = (silent = false) => {
    if (!silent) setLoading(true);
    api("/api/homework")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { if (!silent) setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);
  // Keep the list live: revalidate on focus, tab-visible, and a gentle poll.
  useAutoRefresh(() => reload(true));

  const [sortField, sortDir] = sortKey.split("-");
  const { sorted: sortedAll, sort, toggle, setSort } = useSortable(items, {
    defaultKey: sortField,
    defaultDir: sortDir,
  });
  useEffect(() => { setSort({ key: sortField, dir: sortDir }); }, [sortKey, setSort, sortField, sortDir]);
  const sorted = filterByClassScope(
    filterByDateScope(sortedAll, scopeRange, (h) => h.due_date),
    classScope,
  );

  const hwExport = (h) => (
    <ExportMenu
      compact
      formats={["pdf", "doc", "md"]}
      buildDoc={async () => homeworkToDoc(await api(`/api/homework/${h.id}`).catch(() => h), t)}
    />
  );

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/homework/${deleting.id}`, { method: "DELETE" });
      setItems((rows) => rows.filter((r) => r.id !== deleting.id));
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
        eyebrow={t("hw.eyebrow")}
        title={<><em className="italic font-light text-accent">{t("hw.titleEm")}</em>{t("hw.titlePlain")}</>}
        subtitle={t("hw.sub")}
        newLabel={t("hw.new")}
        onNewManual={() => onOpenHomework?.({})}
        aiKind="homework"
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/homework"
        onTrashChange={reload}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={[
          { value: "due_date-asc",   label: "Due soonest" },
          { value: "due_date-desc",  label: "Due latest" },
          { value: "title-asc",      label: "Title A → Z" },
          { value: "title-desc",     label: "Title Z → A" },
          { value: "status-asc",     label: "Status" },
        ]}
        dateScope={scope}
        onDateScopeChange={setScope}
      />

      {/* The studio, on the shelf it writes into. Opened from a class
          in the sidebar it is already writing for that class, so the
          question does not have to be re-answered somewhere else. */}
      <StudioLauncher kind="homework" scope={classScope} />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? t("chip.loading") : <>{sorted.length} {t("hw.eyebrow")}</>}
      </p>

      {loading && (viewMode === "cards" ? <SkeletonCards /> : <SkeletonList />)}

      {!loading && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          {t("hw.empty")}
        </div>
      )}

      {viewMode === "cards" && sorted.length > 0 && (
        <CardsGrid>
          {sorted.map((h) => (
            <DataCard
              key={h.id}
              onEdit={() => onOpenHomework?.(h)}
              onDelete={() => setDeleting(h)}
              exportNode={hwExport(h)}
              timestamp={fmtRowTimestamp(h)}
            >
              <button
                type="button"
                onClick={() => onOpenHomework?.(h)}
                className="text-left pe-16 flex-1 flex flex-col gap-2"
              >
                <span className="flex flex-wrap items-center gap-1.5 self-start">
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded">
                    {h.status}
                  </span>
                  {deliveryMap && <DeliveryChip entries={deliveryMap.get(String(h.id))} />}
                </span>
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">
                  {h.title}
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {h.subject || "—"}
                  {h.grade ? ` · ${h.grade}` : ""}
                  {h.section ? ` · ${h.section}` : ""}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-dashed border-line">
                  <Stat label="Due" value={fmtShortDate(h.due_date)} />
                  <Stat label="Section" value={h.section || "—"} />
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
                  <SortHeader label="Class" sortKey="grade" sort={sort} onToggle={toggle} />
                  <SortHeader label="Due" sortKey="due_date" sort={sort} onToggle={toggle} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onToggle={toggle} />
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition cursor-pointer"
                    onClick={() => onOpenHomework?.(h)}
                  >
                    <td className="py-4 px-5 text-ink">{h.title}</td>
                    <td className="py-4 text-muted">{h.subject || "—"}</td>
                    <td className="py-4 text-muted">
                      {h.grade || "—"}{h.section ? ` · ${h.section}` : ""}
                    </td>
                    <td className="py-4 text-ink-soft text-xs">
                      {h.due_date ? new Date(h.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper">
                          {h.status}
                        </span>
                        {deliveryMap && <DeliveryChip entries={deliveryMap.get(String(h.id))} />}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <ListRowActions onEdit={() => onOpenHomework?.(h)} onDelete={() => setDeleting(h)} exportNode={hwExport(h)} />
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
        message="The homework will be removed."
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

function fmtShortDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ListRowActions({ onEdit, onDelete, exportNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {exportNode}
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
