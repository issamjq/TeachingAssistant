"use client";

// =====================================================================
// Template library — the curated shelf
//
// Ready-made, moderated teaching materials organised by grade, subject
// and chapter. A teacher browses cards, opens one to read its documents,
// then either imports a document straight into their own library
// (browser→Supabase) or sends it to the Studio to adapt.
//
// Unlike most of the app this content is NOT in the teacher's Supabase
// rows — it is published and moderated by the API service, so the whole
// screen degrades to an honest "not connected yet" when that service is
// cold rather than showing an empty shelf.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, LibraryBig, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listTemplates, getFilters } from "../api";
import { KIND_LABEL, subjectLabel } from "../labels";
import type {
  LibraryFilters,
  TemplateSummary,
  TemplateQuery,
  LibrarySort,
  DocKind,
} from "../types";
import { TemplateCard } from "./TemplateCard";
import { TemplateDetail } from "./TemplateDetail";
import { SubmissionsPanel } from "./SubmissionsPanel";
import s from "../TemplateLibrary.module.css";

const PAGE = 24;

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: "curriculum", label: "Curriculum order" },
  { value: "popular", label: "Most used" },
  { value: "newest", label: "Newest" },
  { value: "relevance", label: "Best match" },
];

type Tab = "browse" | "submissions";

export function TemplateLibraryRoute() {
  const [tab, setTab] = useState<Tab>("browse");

  const [filters, setFilters] = useState<LibraryFilters | null>(null);
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [open, setOpen] = useState<TemplateSummary | null>(null);

  // query state
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<DocKind | "">("");
  const [sort, setSort] = useState<LibrarySort>("curriculum");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFilters()
      .then(setFilters)
      .catch(() => {}); // the grid's own error is enough; filters just stay minimal
  }, []);

  const buildQuery = useCallback(
    (offset: number): TemplateQuery => ({
      q: q.trim() || undefined,
      grade: grade === "" ? undefined : grade,
      subject: subject || undefined,
      kind: kind || undefined,
      sort,
      limit: PAGE,
      offset,
    }),
    [q, grade, subject, kind, sort],
  );

  // Reload from the top whenever a filter changes. Debounced so typing in
  // the search box doesn't fire a request per keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Reset + fetch inside the debounce so the current results stay put
    // (and don't flash a skeleton) while the teacher is still typing.
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      listTemplates(buildQuery(0))
        .then((page) => {
          setItems(page.items);
          setTotal(page.total);
          setHasMore(page.has_more);
        })
        .catch((e) => {
          setItems([]);
          setError({ message: e.message, code: e.code });
        })
        .finally(() => setLoading(false));
    }, 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buildQuery]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await listTemplates(buildQuery(items.length));
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.has_more);
    } catch (e: any) {
      setError({ message: e.message, code: e.code });
    } finally {
      setLoadingMore(false);
    }
  };

  // Subjects offered narrow to the chosen grade; with no grade picked,
  // every subject the shelf carries, de-duplicated.
  const subjectOptions = (() => {
    if (!filters) return [];
    const pool =
      grade === ""
        ? filters.grades.flatMap((g) => g.subjects)
        : filters.grades.find((g) => g.grade === grade)?.subjects ?? [];
    const seen = new Map<string, number>();
    for (const su of pool) seen.set(su.subject, (seen.get(su.subject) ?? 0) + su.cards);
    return [...seen.keys()].sort();
  })();

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      <section className={`${s.loud} p-6 md:p-7`}>
        <p className={s.loudEyebrow}>Template library</p>
        <h1 className="font-serif text-[26px] md:text-[32px] leading-[1.1] font-medium mt-2 max-w-2xl">
          A shelf of ready lessons — <em className="italic">start from one,</em> make it yours.
        </h1>
        <p className={`${s.loudSub} text-sm mt-2.5 max-w-2xl leading-relaxed`}>
          Curated, moderated teaching materials by grade, subject and chapter — lesson plans,
          notes, quizzes and homework you can import in one tap or send to the Studio to adapt to
          how <em className="italic">you</em> teach.
        </p>
        {filters && total > 0 && (
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <span className={s.loudStat}>
              <b>{total}</b> cards
            </span>
            <span className={s.loudStat}>
              <b>{filters.grades.length}</b> grades
            </span>
            <span className={s.loudStat}>{filters.curriculum.toUpperCase()}</span>
          </div>
        )}
      </section>

      <div className={s.segRow} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "browse"}
          className={s.seg}
          data-on={tab === "browse"}
          onClick={() => setTab("browse")}
        >
          Browse
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "submissions"}
          className={s.seg}
          data-on={tab === "submissions"}
          onClick={() => setTab("submissions")}
        >
          My submissions
        </button>
      </div>

      {tab === "submissions" ? (
        <SubmissionsPanel />
      ) : (
        <>
          {/* filter bar */}
          <div className="space-y-3">
            <div className={s.filterBar}>
              <div className={s.search}>
                <Search size={16} aria-hidden />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search chapters — e.g. photosynthesis, trigonometry…"
                  aria-label="Search templates"
                />
              </div>

              <select
                className={s.select}
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value === "" ? "" : Number(e.target.value));
                  setSubject(""); // subjects depend on grade
                }}
                aria-label="Filter by grade"
              >
                <option value="">All grades</option>
                {(filters?.grades ?? []).map((g) => (
                  <option key={g.grade} value={g.grade}>
                    {g.grade === 0 ? "KG" : `Grade ${g.grade}`} ({g.cards})
                  </option>
                ))}
              </select>

              <select
                className={s.select}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Filter by subject"
              >
                <option value="">All subjects</option>
                {subjectOptions.map((su) => (
                  <option key={su} value={su}>
                    {subjectLabel(su)}
                  </option>
                ))}
              </select>

              <select
                className={s.select}
                value={sort}
                onChange={(e) => setSort(e.target.value as LibrarySort)}
                aria-label="Sort"
              >
                {SORTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {(filters?.kinds?.length ?? 0) > 0 && (
              <div className={s.kindRow}>
                <button
                  type="button"
                  className={s.kindChip}
                  data-on={kind === ""}
                  onClick={() => setKind("")}
                >
                  All formats
                </button>
                {filters!.kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={s.kindChip}
                    data-on={kind === k}
                    onClick={() => setKind((cur) => (cur === k ? "" : k))}
                  >
                    {KIND_LABEL[k] ?? k}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* results */}
          {loading ? (
            <div className={s.table}>
              <div className={s.thead} aria-hidden>
                <span>Chapter</span>
                <span>Grade</span>
                <span>Subject</span>
                <span>Docs</span>
                <span>Used</span>
                <span />
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={s.skelRow} />
              ))}
            </div>
          ) : error ? (
            <section className={`${s.glass} p-8 text-center`}>
              <Plug size={22} className="mx-auto text-muted" aria-hidden />
              <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
                {error.code === "no_backend"
                  ? "The library service isn't connected yet, so the shelf can't load. It comes online with the AI features."
                  : error.message}
              </p>
            </section>
          ) : items.length === 0 ? (
            <section className={`${s.glass} p-8 text-center`}>
              <LibraryBig size={22} className="mx-auto text-muted" aria-hidden />
              <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
                No templates match those filters. Widen the grade or clear the search to see the
                whole shelf.
              </p>
            </section>
          ) : (
            <>
              <div className={s.table}>
                <div className={s.thead} aria-hidden>
                  <span>Chapter</span>
                  <span>Grade</span>
                  <span>Subject</span>
                  <span>Docs</span>
                  <span>Used</span>
                  <span />
                </div>
                {items.map((card) => (
                  <TemplateCard key={card.id} card={card} onOpen={() => setOpen(card)} />
                ))}
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <span className="text-[12.5px] text-muted">
                  Showing {items.length} of {total}
                </span>
                {hasMore && (
                  <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {open && <TemplateDetail key={open.id} card={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default TemplateLibraryRoute;
