import React, { useEffect, useState } from "react";
import { Play, Pencil, Trash2 } from "lucide-react";
import { ConfirmDelete, api, timeAgo } from "./_shared";
import {
  DataPageHeader, DataCard, CardsGrid, useViewMode,
  useDateScope, filterByDateScope,
} from "./_data-view";
import SlideBuilder, { PresentDeck, deckFromPresentation } from "./SlideBuilder";

// Blank deck for a brand-new presentation created from this page.
const BLANK_DECK = {
  deckTitle: "Untitled presentation",
  metaLine: "",
  slides: [
    { title: "Title slide", bullets: [""], notes: "", imageQuery: "", image: null, layout: "title", bg: "ink" },
  ],
};

export default function Presentations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [presenting, setPresenting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useViewMode("mudir.view.presentations", "cards");
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
  const visibleItems = filterByDateScope(sortedItems, scopeRange, (p) => p.scheduled_for);

  const reload = () => {
    setLoading(true);
    api("/api/presentations")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  // Keep the editor open after a save (teacher may keep tweaking); just
  // reflect the change in the list. Closing is via the editor's X.
  const onSaved = (saved) => {
    setItems((rows) =>
      rows.some((r) => r.id === saved.id)
        ? rows.map((r) => (r.id === saved.id ? saved : r))
        : [saved, ...rows]
    );
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/presentations/${deleting.id}`, { method: "DELETE" });
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
        eyebrow="Presentations"
        title={<>Slide <em className="italic font-light text-accent">decks</em></>}
        subtitle="Build slide-based presentations linked to your lessons."
        newLabel="New presentation"
        onNewManual={() => setEditing("new")}
        aiKind="presentation"
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/presentations"
        onTrashChange={reload}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={[
          { value: "updated_at-desc",   label: "Recently updated" },
          { value: "scheduled_for-asc", label: "Scheduled soonest" },
          { value: "scheduled_for-desc",label: "Scheduled latest" },
          { value: "title-asc",         label: "Title A → Z" },
          { value: "title-desc",        label: "Title Z → A" },
        ]}
        dateScope={scope}
        onDateScopeChange={setScope}
      />

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading && <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Loading…</p>}

      {!loading && visibleItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          {items.length === 0
            ? "No presentations yet — click “New presentation” to build one."
            : "Nothing matches the current filters."}
        </div>
      )}

      {viewMode === "cards" && visibleItems.length > 0 && (
        <CardsGrid>
          {visibleItems.map((p) => (
            <DataCard
              key={p.id}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
            >
              <div className="pr-16 flex-1 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
                  {p.status}
                </span>
                <h3 className="font-serif text-lg font-medium text-ink leading-snug mt-1">{p.title}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {p.subject || "—"}{p.grade ? ` · ${p.grade}` : ""} · {(p.slides || []).length} slide{(p.slides || []).length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {timeAgo(p.updated_at)}
                </span>
                <button
                  onClick={() => setPresenting(p)}
                  className="inline-flex items-center gap-1.5 text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                >
                  <Play size={13} /> Present
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
                <th className="text-left py-3 font-medium">Subject</th>
                <th className="text-left py-3 font-medium">Grade</th>
                <th className="text-left py-3 font-medium">Slides</th>
                <th className="text-left py-3 font-medium">Status</th>
                <th className="text-left py-3 font-medium">Updated</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                  <td className="py-4 px-5 text-ink">{p.title}</td>
                  <td className="py-4 text-muted">{p.subject || "—"}</td>
                  <td className="py-4 text-muted">{p.grade || "—"}</td>
                  <td className="py-4 text-ink-soft">{(p.slides || []).length}</td>
                  <td className="py-4">
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper">
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 text-ink-soft text-xs">{timeAgo(p.updated_at)}</td>
                  <td className="py-4 px-5 text-right">
                    <ListRowActions onEdit={() => setEditing(p)} onDelete={() => setDeleting(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[70] bg-paper overflow-y-auto">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-6">
            <SlideBuilder
              key={editing === "new" ? "new" : editing.id}
              deck={editing === "new" ? BLANK_DECK : deckFromPresentation(editing)}
              presentationId={editing === "new" ? null : editing.id}
              meta={
                editing === "new"
                  ? { status: "Draft" }
                  : {
                      subject: editing.subject,
                      grade: editing.grade,
                      section: editing.section,
                      status: editing.status,
                      scheduled_for: editing.scheduled_for,
                    }
              }
              onSaved={onSaved}
              onClose={() => { setEditing(null); reload(); }}
            />
          </div>
        </div>
      )}

      {presenting && (
        <PresentDeck presentation={presenting} onClose={() => setPresenting(null)} />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        message="This presentation and its slides will be removed permanently."
      />
    </div>
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
