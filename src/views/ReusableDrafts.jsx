import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, AlertTriangle, Info } from "lucide-react";
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
} from "./_shared";
import { MAJORS } from "../lib/enums";

const STATUSES = ["In progress", "Ready to use", "Blocked", "Paused"];

export default function ReusableDrafts({ onNewDraft, onEditDraft }) {
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    api("/api/drafts")
      .then((data) => {
        setDrafts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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

  const { sorted, sort, toggle } = useSortable(filtered, {
    defaultKey: "last_edited",
    defaultDir: "desc",
  });

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/drafts/${deleting.id}`, { method: "DELETE" });
      setDrafts((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
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
      alert(`Could not clear all: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Drafts
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Reusable <em className="italic font-light text-accent">drafts</em>
          </h2>
          <p className="text-muted mt-2">
            Lesson plans you started, paused, or saved to reuse later. Only you can see these.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setBulkOpen(true)} disabled={drafts.length === 0}>
            Clear all drafts
          </Button>
          <Button onClick={onNewDraft}>
            <Plus size={15} className="mr-2" /> New draft
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 bg-paper-cool rounded-lg border border-line px-4 py-2.5 flex items-center gap-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="outline-none w-full text-sm bg-transparent text-ink placeholder:text-muted"
            placeholder="Search drafts by name, subject, topic…"
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
          "Loading drafts from Neon…"
        ) : (
          <>
            Showing <span className="text-ink">{sorted.length}</span> of {drafts.length} drafts · auto-saved every 30s
          </>
        )}
      </p>

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
                      No drafts match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
