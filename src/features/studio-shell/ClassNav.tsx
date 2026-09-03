"use client";

// =====================================================================
// My classes — the sidebar section that replaced the library list
//
// The rail used to carry a section called Materials holding seven
// libraries side by side: Lessons, Quizzes, Homework, Presentations,
// Activities, Templates, Material. Each of them held every class the
// teacher taught, mixed together, and finding "the Grade 9 Physics
// quizzes" meant opening the quiz library and filtering it again every
// single time. The class was never a place you could go.
//
// It is now. Each class opens into the six things it holds, and picking
// one sets the class scope the library screens read, so /quizzes opens
// already showing that class with a chip saying so.
//
// Three behaviours, and each appears only when it earns its place —
// a teacher with one class must not be made to operate machinery built
// for a teacher with sixteen:
//
//   · grade headers past five classes, and only when there is more than
//     one grade to head. Below that they cost more than they save:
//     three classes become three headers over three rows.
//   · only the grade you are working in is open. Sixteen classes then
//     draw as four headers, that grade's few subjects and the open
//     class's six kinds — about fourteen rows however many exist.
//   · a filter past six. Two letters beat any amount of scrolling.
//
// And when there are NO classes it renders the flat library list
// instead. A brand-new teacher with nothing on her roster must not find
// her lesson plans unreachable because the rail is waiting for a class
// to exist.
// =====================================================================

import { Fragment, useMemo, useState } from "react";
import {
  BookOpen, ChevronRight, ClipboardCheck, FileText, MonitorPlay,
  PenLine, Puzzle, Search, X, type LucideIcon,
} from "lucide-react";
import { navigate } from "@/lib/route";
import {
  classScopeLabel, setClassScope, useClassScope,
} from "@/shared/lib/classScope";
import { useClasses, type TeacherClassGroup } from "./useClasses";

/** Past this many classes the rail earns a filter. */
const FILTER_AT = 6;
/** And past this many, grade headers. */
const GROUP_AT = 5;

type Kind = { key: string; label: string; icon: LucideIcon; route: string };

/**
 * The six things a class holds, in the order the product makes them:
 * what you plan with, what students read, what they do, what you assess
 * with, what you present from, and what you uploaded it all against.
 */
const KINDS: Kind[] = [
  { key: "lesson-plans",  label: "Lessons",       icon: BookOpen,       route: "lesson-plans" },
  { key: "quizzes",       label: "Quizzes",       icon: ClipboardCheck, route: "quizzes" },
  { key: "homework",      label: "Homework",      icon: PenLine,        route: "homework" },
  { key: "activities",    label: "Activities",    icon: Puzzle,         route: "activities" },
  { key: "presentations", label: "Presentations", icon: MonitorPlay,    route: "presentations" },
  { key: "materials",     label: "Material",      icon: FileText,       route: "materials" },
];

export default function ClassNav({
  section, navT, collapsed, onNavigated,
}: {
  /** The first path segment, for the active state. */
  section: string;
  /** The shell's dictionary lookup, so labels stay translatable. */
  navT: (key: string, fallback: string) => string;
  collapsed: boolean;
  onNavigated?: () => void;
}) {
  const { classes, ready } = useClasses();
  const scope = useClassScope();
  const [filter, setFilter] = useState("");
  // Two sets rather than one, so "the grade I am working in is open"
  // stays true without an effect writing state on every navigation, and
  // so closing that grade by hand actually closes it.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [openKey, setOpenKey] = useState<string | null>(null);

  const here = classes.find((c) => c.key === (openKey ?? scope?.key)) ?? null;
  const q = filter.trim().toLowerCase();

  const matches = useMemo(
    () => (q ? classes.filter((c) => `${c.subject} ${c.grade}`.toLowerCase().includes(q)) : classes),
    [classes, q],
  );

  const grades = useMemo(() => {
    const by = new Map<string, { key: string; label: string; items: TeacherClassGroup[] }>();
    for (const c of matches) {
      if (!by.has(c.gradeKey)) {
        by.set(c.gradeKey, { key: c.gradeKey, label: c.grade || "No grade set", items: [] });
      }
      by.get(c.gradeKey)!.items.push(c);
    }
    return [...by.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [matches]);

  const grouped = grades.length > 1 && classes.length > GROUP_AT;
  const defaultOpen = here?.gradeKey ?? grades[0]?.key ?? "";
  const gradeOpen = (k: string) =>
    !!q || opened.has(k) || (defaultOpen === k && !closed.has(k));

  const toggleGrade = (k: string) => {
    const open = gradeOpen(k);
    setOpened((p) => { const n = new Set(p); if (open) n.delete(k); else n.add(k); return n; });
    setClosed((p) => { const n = new Set(p); if (open) n.add(k); else n.delete(k); return n; });
  };

  const go = (cls: TeacherClassGroup, kind: Kind) => {
    setClassScope({ subject: cls.subject, grade: cls.grade, key: cls.key });
    navigate([kind.route]);
    onNavigated?.();
  };

  // ── nothing to nest under ──────────────────────────────────────────
  // Not an empty state: the same libraries, unfiltered, exactly as the
  // rail carried them before. The section only becomes classes once
  // there are classes.
  if (ready && classes.length === 0) {
    return (
      <section className="murchid-sidebar-section">
        <p className="murchid-sidebar-section-label">{navT("materials", "Materials")}</p>
        <div className="space-y-0.5 px-1">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => { setClassScope(null); navigate([k.route]); onNavigated?.(); }}
              title={navT(k.key, k.label)}
              aria-current={section === k.route ? "page" : undefined}
              className={`murchid-sidebar-item ${section === k.route ? "murchid-sidebar-item-active" : ""}`}
            >
              <span className="murchid-nav-badge" aria-hidden><k.icon size={15} strokeWidth={1.9} /></span>
              <span className="truncate flex-1 text-start">{navT(k.key, k.label)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (!ready) return null;

  return (
    <section className="murchid-sidebar-section">
      <p className="murchid-sidebar-section-label">
        {navT("myclasses", "My classes")}
        {!collapsed && classes.length > 0 && (
          <span className="not-italic font-sans text-[11px] text-muted"> · {classes.length}</span>
        )}
      </p>

      {!collapsed && classes.length > FILTER_AT && (
        <label className="mx-2 mb-1.5 flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-muted focus-within:border-accent">
          <Search size={12} aria-hidden />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={navT("findclass", "Find a class")}
            aria-label={navT("findclass", "Find a class")}
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-muted"
          />
          {filter && (
            <button type="button" onClick={() => setFilter("")} aria-label="Clear" className="text-muted hover:text-ink">
              <X size={12} />
            </button>
          )}
        </label>
      )}

      <div className="space-y-0.5 px-1">
        {grouped
          ? grades.map((g) => (
              <Fragment key={g.key || "none"}>
                <button
                  type="button"
                  onClick={() => toggleGrade(g.key)}
                  aria-expanded={gradeOpen(g.key)}
                  className="murchid-sidebar-item !py-1.5 !text-[11.5px] !text-muted hover:!text-ink"
                >
                  <ChevronRight
                    size={12}
                    className={`flex-shrink-0 transition-transform ${gradeOpen(g.key) ? "rotate-90" : ""}`}
                  />
                  <span className="truncate flex-1 text-start">{g.label}</span>
                  <span className="font-mono text-[9px] flex-shrink-0">{g.items.length}</span>
                </button>
                {gradeOpen(g.key) &&
                  g.items.map((c) => (
                    <ClassRow
                      key={c.key}
                      cls={c}
                      open={c.key === (openKey ?? scope?.key)}
                      onToggle={() => setOpenKey(c.key === (openKey ?? scope?.key) ? "" : c.key)}
                      section={section}
                      scopeKey={scope?.key ?? null}
                      showGrade={false}
                      navT={navT}
                      go={go}
                    />
                  ))}
              </Fragment>
            ))
          : matches.map((c) => (
              <ClassRow
                key={c.key}
                cls={c}
                open={c.key === (openKey ?? scope?.key)}
                onToggle={() => setOpenKey(c.key === (openKey ?? scope?.key) ? "" : c.key)}
                section={section}
                scopeKey={scope?.key ?? null}
                showGrade
                navT={navT}
                go={go}
              />
            ))}

        {q && matches.length === 0 && (
          <p className="px-4 py-2 text-[12px] text-muted">No class matches &ldquo;{filter}&rdquo;.</p>
        )}
      </div>
    </section>
  );
}

function ClassRow({
  cls, open, onToggle, section, scopeKey, showGrade, navT, go,
}: {
  cls: TeacherClassGroup;
  open: boolean;
  onToggle: () => void;
  section: string;
  scopeKey: string | null;
  showGrade: boolean;
  navT: (key: string, fallback: string) => string;
  go: (cls: TeacherClassGroup, kind: Kind) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={classScopeLabel({ subject: cls.subject, grade: cls.grade, key: cls.key })}
        className="murchid-sidebar-item"
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${open ? "bg-accent" : "bg-line"}`}
        />
        <span className="truncate flex-1 text-start">{cls.subject}</span>
        {showGrade && cls.grade && (
          <span className="text-[11px] text-muted flex-shrink-0">{cls.grade}</span>
        )}
        <ChevronRight
          size={12}
          className={`flex-shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="ms-6 ps-2 border-s border-line/70 space-y-0.5">
          {KINDS.map((k) => {
            // Active means both: this library AND this class. Standing in
            // /quizzes scoped to Physics must not light Mathematics too.
            const active = section === k.route && scopeKey === cls.key;
            return (
              <button
                key={k.key}
                type="button"
                onClick={() => go(cls, k)}
                title={`${navT(k.key, k.label)} · ${cls.subject}`}
                aria-current={active ? "page" : undefined}
                className={`murchid-sidebar-item w-full !py-1.5 !text-[13px] ${active ? "murchid-sidebar-item-active" : ""}`}
              >
                <span className="murchid-nav-badge" aria-hidden><k.icon size={14} strokeWidth={1.9} /></span>
                <span className="truncate flex-1 text-start">{navT(k.key, k.label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
