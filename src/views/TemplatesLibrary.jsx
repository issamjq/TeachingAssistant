import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Star, Upload, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  SubjectBadge,
  RowActions,
  ConfirmDelete,
  timeAgo,
  api, apiList,
  selectClasses,
} from "./_shared";
import { DataPageHeader, useViewMode, useDateScope, filterByDateScope } from "./_data-view";
import { ExportMenu } from "@/components/ui/export-menu";
import { SkeletonCards, SkeletonList } from "@/components/ui/skeleton";
import { lessonPlanToDoc } from "../lib/toDoc";
import { MAJORS } from "../lib/enums";
import { useT } from "../lib/i18n";

// Lazy-load mammoth only when the user actually clicks Import .docx, so the
// ~280 KB parser stays out of the main bundle.
const importDocx = async (file) => {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value;
};

// Walk the parsed plain text and try to bucket it. We don't get headings from
// extractRawText, so this is intentionally light: split on the obvious
// markers and dump everything else into `flow`. The teacher can refine
// after the import.
const buckets = (text) => {
  const out = { name: "", flow: "", objectives: [], tags: [] };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return out;
  out.name = lines[0].slice(0, 120);
  let mode = null;
  for (const line of lines.slice(1)) {
    const lower = line.toLowerCase();
    if (/^objectives?:?$/.test(lower)) { mode = "objectives"; continue; }
    if (/^(tags|keywords):?$/.test(lower)) { mode = "tags"; continue; }
    if (/^(flow|outline|stages|steps):?$/.test(lower)) { mode = "flow"; continue; }
    if (mode === "objectives" && /^[-•*]/.test(line)) {
      out.objectives.push(line.replace(/^[-•*]\s*/, ""));
    } else if (mode === "tags") {
      out.tags.push(...line.split(/[,;]+/).map((t) => t.trim()).filter(Boolean));
    } else {
      out.flow += (out.flow ? " → " : "") + line;
    }
  }
  return out;
};

const SORTS = {
  most_used: { label: "Most used", cmp: (a, b) => (b.used_count || 0) - (a.used_count || 0) },
  recent:    { label: "Recently updated", cmp: (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0) },
  name_asc:  { label: "Name A → Z", cmp: (a, b) => a.name.localeCompare(b.name) },
  name_desc: { label: "Name Z → A", cmp: (a, b) => b.name.localeCompare(a.name) },
};

export default function TemplatesLibrary({ onNewTemplate, onUseTemplate, onEditTemplate }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sortKey, setSortKey] = useState("most_used");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewMode, setViewMode] = useViewMode("murchid.view.templates", "cards");
  const [scope, setScope, scopeRange] = useDateScope();
  const fileInputRef = useRef(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setImporting(true);
    try {
      const text = await importDocx(file);
      const parsed = buckets(text);
      const created = await api("/api/templates", {
        method: "POST",
        body: {
          name: parsed.name || file.name.replace(/\.docx$/i, ""),
          subject: "General",
          duration: 45,
          grade: "—",
          flow: parsed.flow,
          tags: parsed.tags,
          used_count: 0,
          starred: false,
          objectives: parsed.objectives,
          stages: [],
        },
      });
      setTemplates((rows) => [created, ...rows]);
    } catch (err) {
      alert(`Could not import: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const reload = () => {
    setLoading(true);
    apiList("/api/templates")
      .then((data) => { setTemplates(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };
  useEffect(() => {
    apiList("/api/templates")
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const subjectOptions = useMemo(() => {
    const set = new Set([...MAJORS, ...templates.map((t) => t.subject).filter(Boolean)]);
    return [...set].sort();
  }, [templates]);

  const gradeOptions = useMemo(() => {
    const set = new Set(templates.map((t) => t.grade).filter(Boolean));
    return [...set].sort();
  }, [templates]);

  const filtered = useMemo(() => {
    let rows = templates;
    if (subjectFilter) rows = rows.filter((t) => t.subject === subjectFilter);
    if (gradeFilter) rows = rows.filter((t) => t.grade === gradeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.subject || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    const sorted = [...rows].sort(SORTS[sortKey].cmp);
    return filterByDateScope(sorted, scopeRange, (t) => t.updated_at);
  }, [query, templates, subjectFilter, gradeFilter, sortKey, scopeRange]);

  // Defined at component scope so `t` here is the translator — inside the
  // card/list `.map((t) => …)` below `t` is shadowed by the template row.
  const templateExport = (tpl) => (
    <ExportMenu
      compact
      formats={["pdf", "doc"]}
      buildDoc={() =>
        lessonPlanToDoc(
          {
            name: tpl.name,
            subject: tpl.subject,
            grade: tpl.grade,
            duration_minutes: tpl.duration,
            objectives: tpl.objectives,
            main_activity: tpl.flow,
          },
          t
        )
      }
    />
  );

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/templates/${deleting.id}`, { method: "DELETE" });
      setTemplates((rows) => rows.filter((r) => r.id !== deleting.id));
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
        eyebrow={t("tp.eyebrow")}
        title={<>{t("tp.titlePlain")}<em className="italic font-light text-accent">{t("tp.titleEm")}</em></>}
        subtitle={t("tp.sub")}
        newLabel={t("tp.new")}
        onNewManual={() => onNewTemplate?.()}
        aiKind="lesson_plan"
        mode={viewMode}
        onModeChange={setViewMode}
        trashEndpoint="/api/templates"
        trashTitleField="name"
        onTrashChange={reload}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={Object.entries(SORTS).map(([value, { label }]) => ({ value, label }))}
        dateScope={scope}
        onDateScopeChange={setScope}
        extraActions={(
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleImport}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="planner-nav-btn h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink text-[12px] text-ink leading-none whitespace-nowrap disabled:opacity-50"
            >
              <Upload size={12} strokeWidth={2} />
              {importing ? "Importing…" : "Import .docx"}
            </button>
          </>
        )}
      />

      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[240px] bg-paper-cool rounded-lg border border-line px-4 py-2.5 flex items-center gap-2">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="outline-none w-full text-sm bg-transparent text-ink placeholder:text-muted"
            placeholder={t("tp.search")}
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All grades</option>
          {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All subjects</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load templates
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
        {loading ? (
          t("tp.loading")
        ) : (
          <>
            Showing <span className="text-ink">{filtered.length}</span> of {templates.length} templates
          </>
        )}
      </p>

      {loading && (viewMode === "cards" ? <SkeletonCards /> : <SkeletonList />)}

      {!loading && viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((t) => (
            <Card key={t.id} className="hover:border-ink transition flex flex-col">
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <SubjectBadge subject={t.subject} />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {t.starred && <Star size={13} className="text-accent fill-accent" />}
                      used {t.used_count}×
                    </div>
                    {templateExport(t)}
                    <RowActions
                      onEdit={onEditTemplate ? () => onEditTemplate(t) : undefined}
                      onDelete={() => setDeleting(t)}
                    />
                  </div>
                </div>
                <h3 className="font-serif text-xl font-medium text-ink mb-1.5">{t.name}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-3">
                  {t.subject} · {t.duration} min · grade {t.grade}
                </p>
                <p className="text-sm text-ink-soft mb-4 leading-relaxed flex-1">{t.flow}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(t.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-paper border border-line text-ink-soft font-mono text-[9px] uppercase tracking-wider rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="pt-3 border-t border-dashed border-line flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Updated {timeAgo(t.updated_at)}
                  </span>
                  <button
                    onClick={() => onUseTemplate(t)}
                    className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
                  >
                    Use template →
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          <button
            onClick={() => setNewPopupOpen(true)}
            className="border border-dashed border-line bg-paper-cool/50 rounded-xl p-5 flex flex-col items-center justify-center text-muted hover:border-ink hover:text-ink transition min-h-[260px]"
          >
            <div className="h-10 w-10 rounded-full border border-current flex items-center justify-center mb-3">
              <Plus size={18} />
            </div>
            <p className="font-medium text-sm">Create blank template</p>
            <p className="font-mono text-[10px] uppercase tracking-wider mt-1.5">
              Or import from .docx / .pdf
            </p>
          </button>
        </div>
      )}

      {!loading && viewMode === "list" && (
        <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                <th className="text-left py-3 px-5 font-medium">Name</th>
                <th className="text-left py-3 font-medium">Subject</th>
                <th className="text-left py-3 font-medium">Grade</th>
                <th className="text-left py-3 font-medium">Duration</th>
                <th className="text-left py-3 font-medium">Used</th>
                <th className="text-left py-3 font-medium">Updated</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition cursor-pointer" onClick={() => onUseTemplate(t)}>
                  <td className="py-4 px-5 text-ink">{t.name}</td>
                  <td className="py-4 text-muted">{t.subject || "—"}</td>
                  <td className="py-4 text-muted">{t.grade || "—"}</td>
                  <td className="py-4 text-ink-soft">{t.duration ? `${t.duration} min` : "—"}</td>
                  <td className="py-4 text-ink-soft">{t.used_count || 0}×</td>
                  <td className="py-4 text-ink-soft text-xs">{timeAgo(t.updated_at)}</td>
                  <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1">
                      {templateExport(t)}
                      <RowActions
                        onEdit={onEditTemplate ? () => onEditTemplate(t) : undefined}
                        onDelete={() => setDeleting(t)}
                      />
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    {t("tp.empty")}
                  </td>
                </tr>
              )}
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
        title={deleting ? `Delete "${deleting.name}"?` : ""}
        message={
          deleting
            ? `This template (${deleting.subject}, ${deleting.duration} min) will be removed permanently.`
            : ""
        }
      />
    </div>
  );
}
