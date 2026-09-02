"use client";

import { flash } from "@/shared/lib/flash";
import React, { useState, useMemo, useEffect } from "react";
import { useAutoRefresh } from "@/shared/hooks/useAutoRefresh";
import { Search, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SubjectBadge,
  StatusBadge,
  RowActions,
  ConfirmDelete,
  SortHeader,
  useSortable,
  timeAgo,
  api,
  selectClasses,
  fmtRowTimestamp,
} from "./_shared";
import {
  DataPageHeader, useViewMode, DataCard, CardsGrid,
  useDateScope, filterByDateScope,
} from "./_data-view";
import { MAJORS } from "../lib/enums";
import { useT } from "../lib/i18n";

const STATUSES = ["In progress", "Ready to use", "Blocked", "Paused"];

export default function ReusableDrafts({ onEditDraft, onNewLesson }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode("murchid.view.drafts", "cards");
  const [sortKey, setSortKey] = useState("last_edited-desc");
  const [scope, setScope, scopeRange] = useDateScope();

  const reload = (silent = false) => {
    if (!silent) setLoading(true);
    api("/api/drafts")
      .then((data) => { setDrafts(data); setLoading(false); })
      .catch((err) => { if (!silent) setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);
  // Keep the list live: revalidate on focus, tab-visible, and a gentle poll.
  useAutoRefresh(() => reload(true));

  const subjectOptions = useMemo(() => {
    const set = new Set([...MAJORS, ...drafts.map((d) => d.subject).filter(Boolean)]);
    return [...set].sort();
  }, [drafts]);

  const filtered = useMemo(() => {
    let rows = drafts;
    if (subjectFilter) rows = rows.filter((d) => d.subject === subjectFilter);
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.subject || "").toLowerCase().includes(q) ||
          (d.status || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [query, drafts, subjectFilter, statusFilter]);

  const [sortField, sortDir] = sortKey.split("-");
  const { sorted: sortedAll, sort, toggle, setSort } = useSortable(filtered, {
    defaultKey: sortField,
    defaultDir: sortDir,
  });
  useEffect(() => { setSort({ key: sortField, dir: sortDir }); }, [sortKey, setSort, sortField, sortDir]);
  const sorted = filterByDateScope(sortedAll, scopeRange, (d) => d.last_edited);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/drafts/${deleting.id}`, { method: "DELETE" });
      setDrafts((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      flash(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmClearAll = async () => {
    setBusy(true);
    try {
      await Promise.all(drafts.map((d) => api(`/api/drafts/${d.id}`, { method: "DELETE" })));
      setDrafts([]);
      setBulkOpen(false);
    } catch (e) {
      flash(`Could not clear all: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <DataPageHeader
        eyebrow={t("dr.eyebrow")}
        title={<>{t("dr.titlePlain")}<em className="italic font-light text-accent">{t("dr.titleEm")}</em></>}
        subtitle={t("dr.sub")}
        newLabel={t("dr.new")}
        onNewManual={() => onNewLesson?.()}
        aiKind="lesson_plan"
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/drafts"
        trashTitleField="name"
        onTrashChange={reload}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={[
          { value: "last_edited-desc", label: "Recently edited" },
          { value: "last_edited-asc",  label: "Oldest first" },
          { value: "name-asc",         label: "Title A → Z" },
          { value: "name-desc",        label: "Title Z → A" },
          { value: "progress-desc",    label: "Most progress" },
        ]}
        dateScope={scope}
        onDateScopeChange={setScope}
        extraActions={(
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            disabled={drafts.length === 0}
            className="planner-nav-btn h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink text-[12px] text-ink leading-none whitespace-nowrap disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      />

      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[240px] bg-paper-cool rounded-lg border border-line px-4 py-2.5 flex items-center gap-2">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="outline-none w-full text-sm bg-transparent text-ink placeholder:text-muted"
            placeholder={t("dr.search")}
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All subjects</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load drafts
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? (
          t("dr.loading")
        ) : (
          <>
            Showing <span className="text-ink">{sorted.length}</span> of {drafts.length} drafts · auto-saved every 30s
          </>
        )}
      </p>

      {viewMode === "cards" && (
        <>
          {!loading && sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
              {t("dr.empty")}
            </div>
          )}
          {sorted.length > 0 && (
            <CardsGrid>
              {sorted.map((d) => (
                <DataCard
                  key={d.id}
                  onEdit={() => onEditDraft(d)}
                  onDelete={() => setDeleting(d)}
                  timestamp={fmtRowTimestamp(d)}
                >
                  <div className="pe-16 flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <SubjectBadge subject={d.subject} />
                      <StatusBadge status={d.status} />
                    </div>
                    <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">{d.name}</h3>
                    {d.note && (
                      <p className="text-xs text-muted line-clamp-2">{d.note}</p>
                    )}
                    {d.warning && (
                      <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 bg-paper-warm border border-gold text-gold font-mono text-[9px] uppercase tracking-wider rounded">
                        <AlertTriangle size={9} /> {d.warning}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-dashed border-line">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-1.5 bg-paper-warm rounded-full overflow-hidden border border-line">
                        <div
                          className={`h-full ${d.progress === 100 ? "bg-sage" : "bg-ink"}`}
                          style={{ width: `${d.progress}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted w-10 text-right">
                        {d.progress}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                        {timeAgo(d.last_edited)}
                      </span>
                      <button
                        onClick={() => onEditDraft(d)}
                        className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                      >
                        Resume →
                      </button>
                    </div>
                  </div>
                </DataCard>
              ))}
            </CardsGrid>
          )}
        </>
      )}

      {viewMode === "list" && (
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label="Draft" sortKey="name" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label="Subject" sortKey="subject" sort={sort} onToggle={toggle} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onToggle={toggle} />
                  <SortHeader label="Last edited" sortKey="last_edited" sort={sort} onToggle={toggle} />
                  <SortHeader label="Progress" sortKey="progress" sort={sort} onToggle={toggle} />
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition"
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-start gap-3">
                        <SubjectBadge subject={d.subject} />
                        <div>
                          <p className="font-medium text-ink">{d.name}</p>
                          <p className="text-xs text-muted">{d.note}</p>
                          {d.warning && (
                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-paper-warm border border-gold text-gold font-mono text-[9px] uppercase tracking-wider rounded">
                              <AlertTriangle size={9} /> {d.warning}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-ink-soft">{d.subject}</td>
                    <td className="py-4">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-4 text-muted text-xs">{timeAgo(d.last_edited)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-paper-warm rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${d.progress === 100 ? "bg-sage" : "bg-ink"}`}
                            style={{ width: `${d.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted w-10">
                          {d.progress}%
                        </span>
                        <button
                          onClick={() => onEditDraft(d)}
                          className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                        >
                          Resume →
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <RowActions
                        onEdit={() => onEditDraft(d)}
                        onDelete={() => setDeleting(d)}
                      />
                    </td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted">
                      {t("dr.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      <div className="mt-6 bg-paper border border-line rounded-lg p-4 flex gap-3">
        <Info size={18} className="text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-ink">All drafts are private to you</p>
          <p className="text-xs text-muted mt-0.5">
            No one else — not your school, not other teachers — can see or open these drafts. Only you.
          </p>
        </div>
      </div>

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.name}"?` : ""}
        message={
          deleting
            ? `This draft will be removed permanently.`
            : ""
        }
      />

      <ConfirmDelete
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onConfirm={confirmClearAll}
        busy={busy}
        title="Clear all drafts?"
        message={`All ${drafts.length} drafts will be removed permanently.`}
      />
    </div>
  );
}
