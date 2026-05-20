import React, { useEffect, useState } from "react";
import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal, ConfirmDelete, api, timeAgo,
} from "./_shared";
import {
  DataPageHeader, DataCard, CardsGrid, useViewMode,
  useDateScope, filterByDateScope,
} from "./_data-view";
import { useT } from "../lib/i18n";

export default function Activities({ onOpenActivity }) {
  const t = useT();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [completionsFor, setCompletionsFor] = useState(null);
  const [viewMode, setViewMode] = useViewMode("murchid.view.activities", "cards");
  const [sortKey, setSortKey] = useState("updated_at-desc");
  const [scope, setScope, scopeRange] = useDateScope();

  const sortedItems = React.useMemo(() => {
    const [k, dir] = sortKey.split("-");
    const sign = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = a[k]; const bv = b[k];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sign;
    });
  }, [items, sortKey]);
  const visibleItems = filterByDateScope(sortedItems, scopeRange, (a) => a.scheduled_for);

  const reload = () => {
    setLoading(true);
    api("/api/activities")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

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
        eyebrow={t("ac.eyebrow")}
        title={<>{t("ac.titlePlain")}<em className="italic font-light text-accent">{t("ac.titleEm")}</em></>}
        subtitle={t("ac.sub")}
        newLabel={t("ac.new")}
        onNewManual={() => onOpenActivity?.({})}
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/activities"
        onTrashChange={reload}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={[
          { value: "updated_at-desc",   label: "Recently updated" },
          { value: "scheduled_for-asc", label: "Scheduled soonest" },
          { value: "scheduled_for-desc",label: "Scheduled latest" },
          { value: "title-asc",         label: "Title A → Z" },
          { value: "duration_minutes-desc", label: "Longest duration" },
        ]}
        dateScope={scope}
        onDateScopeChange={setScope}
      />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading && <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{t("chip.loading")}</p>}

      {!loading && visibleItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          {items.length === 0
            ? t("ac.empty")
            : t("chip.noFilterMatch")}
        </div>
      )}

      {viewMode === "cards" && visibleItems.length > 0 && (
        <CardsGrid>
          {visibleItems.map((a) => (
            <DataCard
              key={a.id}
              onEdit={() => onOpenActivity?.(a)}
              onDelete={() => setDeleting(a)}
            >
              <button
                type="button"
                onClick={() => onOpenActivity?.(a)}
                className="text-left pr-16 flex-1 flex flex-col gap-2"
              >
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
              </button>
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

      {viewMode === "list" && visibleItems.length > 0 && (
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
              {visibleItems.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition cursor-pointer"
                  onClick={() => onOpenActivity?.(a)}
                >
                  <td className="py-4 px-5 text-ink">{a.title}</td>
                  <td className="py-4 text-muted">{a.type || "—"}</td>
                  <td className="py-4 text-muted">{a.subject || "—"}</td>
                  <td className="py-4 text-muted">{a.grade || "—"}</td>
                  <td className="py-4 text-ink-soft">{a.duration_minutes ? `${a.duration_minutes} min` : "—"}</td>
                  <td className="py-4 text-ink-soft text-xs">{timeAgo(a.updated_at)}</td>
                  <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <ListRowActions onEdit={() => onOpenActivity?.(a)} onDelete={() => setDeleting(a)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
