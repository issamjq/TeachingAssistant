"use client";

// =====================================================================
// The shell the whole preview renders inside
//
// The proposal lives in the sidebar. Today's studio nav lists seven
// libraries under a "Materials" heading — Lessons, Quizzes, Homework,
// Presentations, Activities, Templates, Material — each of which holds
// every subject the teacher teaches, mixed together, filtered after the
// fact. Here the subject is the container and those libraries are what
// it holds, so "the Biology quizzes" is a place rather than a search.
//
// Everything above the subjects (Home, This week, My library) is
// cross-subject on purpose. A teacher's morning is not filed by
// subject — it is one timetable with four different subjects in it —
// so the day-shaped screens stay flat and the making-shaped screens
// nest. That split is the actual design decision on this page.
// =====================================================================

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  Activity, BarChart3, Building2, Coins, KeyRound, Tags, TrendingDown, Users,
  BookOpen, Bell, ChevronRight, ClipboardCheck, CalendarRange, ExternalLink,
  FolderOpen, HelpCircle, History, LayoutDashboard, MonitorPlay, NotebookPen,
  PenLine, Plus, Puzzle, Search, Settings, Shield, Sparkles, Target, User, X,
  GraduationCap, type LucideIcon,
} from "lucide-react";
import { KINDS, type KindKey } from "./types";
import { roleOf, subjectOf, type Route, type Surface } from "./route";
import s from "./Shell.module.css";
import Link from "next/link";

export const KIND_ICON: Record<KindKey, LucideIcon> = {
  lesson_plan: BookOpen,
  student_notes: NotebookPen,
  homework: PenLine,
  activity: Puzzle,
  quiz: ClipboardCheck,
  presentation: MonitorPlay,
};

export type SideSubject = {
  key: string;
  name: string;
  /** "Grade 9", ready to print. */
  grade: string | null;
  /** Normalised, for grouping — "9". Empty when the class names no grade. */
  gradeKey: string;
  counts: Record<KindKey, number>;
};

/** Past this many classes the rail earns a filter. */
const FILTER_AT = 6;
/**
 * And past this many it earns grade headers.
 *
 * Below the threshold grouping costs more than it saves: three classes
 * become three headers over three rows, and a rail showing nothing but
 * headers is worse than the flat list it replaced. Four or fewer read
 * perfectly well as "Physics · Grade 9", which is also what the design
 * reference does.
 */
const GROUP_AT = 5;

/** Semantic icon key → icon, for the console nav. Mirrors StudioShell's. */
const ADMIN_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  keys: KeyRound,
  students: Users,
  orgs: Building2,
  activity: Activity,
  friction: TrendingDown,
  tokens: BarChart3,
  coins: Coins,
  pricing: Tags,
  shield: Shield,
};

export type Crumb = { label: string; to?: Route };

type Props = {
  route: Route;
  go: (r: Route) => void;
  onRole: (r: Surface) => void;
  /** Admin is offered only when the account actually holds it. */
  showAdmin?: boolean;
  /** The consoles this account is granted, for the admin sidebar. */
  adminSurfaces?: { key: string; label: string; icon?: string }[];
  who: { name: string; initials: string; role: string };
  title: string;
  crumbs?: Crumb[];
  /** Teacher only — the expandable subject list. */
  subjects?: SideSubject[];
  /** Student only — their enrolled subjects, with outstanding work. */
  studentSubjects?: { id: string; name: string; grade: string | null; count: number }[];
  fab?: string;
  /** Pressed instead of navigating: the studio opens in place. */
  onFab?: () => void;
  children: ReactNode;
};

export default function Shell({
  route, go, onRole, who, title, crumbs = [], subjects = [],
  studentSubjects = [], showAdmin = false, adminSurfaces = [],
  fab = "Ask for help", onFab, children,
}: Props) {
  const role = roleOf(route);
  const openSubject = subjectOf(route);
  const activeKind = route.v === "kind" || route.v === "item" ? route.k : null;
  const here = subjects.find((x) => x.key === openSubject) ?? null;

  const [filter, setFilter] = useState("");
  // Two sets rather than one, so "the grade I am working in is open"
  // stays true without an effect writing state on every route change —
  // and so closing that grade by hand actually closes it.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [closed, setClosed] = useState<Set<string>>(() => new Set());

  const q = filter.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? subjects.filter((x) => `${x.name} ${x.grade ?? ""}`.toLowerCase().includes(q)) : subjects),
    [subjects, q],
  );

  /** Grades in school order, each carrying its classes. */
  const grades = useMemo(() => {
    const by = new Map<string, { key: string; label: string; items: SideSubject[] }>();
    for (const c of matches) {
      const k = c.gradeKey;
      if (!by.has(k)) by.set(k, { key: k, label: c.grade ?? "No grade set", items: [] });
      by.get(k)!.items.push(c);
    }
    return [...by.values()].sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [matches]);

  const grouped = grades.length > 1 && subjects.length > GROUP_AT;
  const showFilter = subjects.length > FILTER_AT;
  // The grade you are working in is open. With no class open — Home, the
  // planner, the library — the first group opens instead, because a rail
  // of nothing but collapsed headers tells you nothing about your term.
  const defaultOpen = here?.gradeKey ?? grades[0]?.key ?? "";
  const isOpen = (gradeKey: string) =>
    !!q ||
    opened.has(gradeKey) ||
    (defaultOpen === gradeKey && !closed.has(gradeKey));

  const toggleGrade = (gradeKey: string) => {
    const open = isOpen(gradeKey);
    setOpened((prev) => {
      const next = new Set(prev);
      if (open) next.delete(gradeKey); else next.add(gradeKey);
      return next;
    });
    setClosed((prev) => {
      const next = new Set(prev);
      if (open) next.add(gradeKey); else next.delete(gradeKey);
      return next;
    });
  };

  return (
    <div className={s.frame}>
      <aside className={s.side}>
        <div className={s.brand}>
          <span className={s.brandMark}><Sparkles size={15} strokeWidth={2} /></span>
          <span className={s.brandText}>
            <span className={s.brandName}>Murchid</span>
            <span className={s.brandRole}>
              {role === "teacher" ? "Teacher studio"
                : role === "student" ? "Student portal"
                : "Platform console"}
            </span>
          </span>
        </div>

        <nav className={s.nav} aria-label="Preview navigation">
          {role === "teacher" ? (
            <>
              <NavItem icon={LayoutDashboard} label="Home" on={route.v === "home"} onClick={() => go({ v: "home" })} />
              <NavItem icon={CalendarRange} label="This week" on={route.v === "week"} onClick={() => go({ v: "week" })} />
              <NavItem icon={Target} label="Goal planner" on={route.v === "planner"} onClick={() => go({ v: "planner" })} />
              <NavItem icon={FolderOpen} label="My library" on={route.v === "library"} onClick={() => go({ v: "library" })} />

              <p className={s.groupLabel}>
                <span>My classes{subjects.length > 0 && ` · ${subjects.length}`}</span>
                <Link className={s.groupAction} href="/database">Manage</Link>
              </p>

              {showFilter && (
                <label className={s.filterRow}>
                  <Search size={13} aria-hidden="true" />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Find a class"
                    aria-label="Find a class"
                  />
                  {filter && (
                    <button
                      type="button"
                      className={s.filterClear}
                      onClick={() => setFilter("")}
                      aria-label="Clear the filter"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
              )}

              {grouped
                ? grades.map((g) => {
                    const open = isOpen(g.key);
                    const inHere = here?.gradeKey === g.key;
                    return (
                      <Fragment key={g.key || "none"}>
                        <button
                          type="button"
                          className={s.gradeHead}
                          data-here={inHere}
                          aria-expanded={open}
                          onClick={() => toggleGrade(g.key)}
                        >
                          <span className={s.gradeChev} aria-hidden="true"><ChevronRight size={12} /></span>
                          <span className={s.gradeName}>{g.label}</span>
                          <span className={s.gradeCount}>{g.items.length}</span>
                        </button>
                        {open
                          ? g.items.map((sub) => (
                              <ClassRow
                                key={sub.key}
                                sub={sub}
                                open={sub.key === openSubject}
                                activeKind={activeKind}
                                go={go}
                                showGrade={false}
                              />
                            ))
                          : inHere && here && (
                              <p className={s.gradeHint}>{here.name}</p>
                            )}
                      </Fragment>
                    );
                  })
                : matches.map((sub) => (
                    <ClassRow
                      key={sub.key}
                      sub={sub}
                      open={sub.key === openSubject}
                      activeKind={activeKind}
                      go={go}
                      showGrade
                    />
                  ))}

              {q && matches.length === 0 && (
                <p className={s.noMatch}>No class matches &ldquo;{filter}&rdquo;.</p>
              )}

              <Link className={s.addSubject} href="/database">
                <Plus size={14} strokeWidth={2} />
                Add a class
              </Link>
            </>
          ) : role === "admin" ? (
            <>
              <NavItem icon={Shield} label="Overview" on={route.v === "admin"} onClick={() => go({ v: "admin" })} />
              <p className={s.groupLabel}>
                <span>Consoles{adminSurfaces.length > 0 && ` · ${adminSurfaces.length}`}</span>
              </p>
              {adminSurfaces.length ? (
                adminSurfaces.map((x) => (
                  <NavItem
                    key={x.key}
                    icon={ADMIN_ICON[x.icon ?? "dashboard"] ?? LayoutDashboard}
                    label={x.label}
                    href={`/${x.key}`}
                  />
                ))
              ) : (
                <p className={s.noMatch}>Nothing granted to this account yet.</p>
              )}
            </>
          ) : (
            <>
              <NavItem icon={LayoutDashboard} label="Home" on={route.v === "student"} onClick={() => go({ v: "student" })} />
              <p className={s.groupLabel}><span>My subjects</span></p>
              {studentSubjects.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className={s.subject}
                  data-on={route.v === "studentSubject" && route.id === sub.id}
                  onClick={() => go({ v: "studentSubject", id: sub.id })}
                >
                  <span className={s.dot} aria-hidden="true" />
                  <span className={s.subjectName}>{sub.name}</span>
                  {sub.count > 0 && <span className={s.count}>{sub.count}</span>}
                  <span className={s.chev} aria-hidden="true"><ChevronRight size={13} /></span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div className={s.foot}>
          <NavItem icon={User} label="Profile" href="/account" />
          <NavItem icon={HelpCircle} label="Help" href="/account/help" />
          <NavItem icon={Settings} label="Settings" href="/account" />
        </div>
      </aside>

      <div className={s.main}>
        <div className={s.bar}>
          <b className={s.barWord}>Preview</b>
          <span className={s.barText}>
            <b>Preview</b> — subject-first studio. Read-only; nothing here writes to your library.
          </span>
          {/* Teacher and Student are always offered — each explains
              itself when the account does not hold it, and seeing both is
              half the point of a preview. Admin is offered ONLY when the
              account really holds it: a console for someone without the
              capability would be a page whose every request 403s. */}
          <span className={s.roles} role="group" aria-label="Which surface to preview">
            <button type="button" className={s.role} data-on={role === "teacher"} onClick={() => onRole("teacher")}>Teacher</button>
            <button type="button" className={s.role} data-on={role === "student"} onClick={() => onRole("student")}>Student</button>
            {showAdmin && (
              <button type="button" className={s.role} data-on={role === "admin"} onClick={() => onRole("admin")}>Admin</button>
            )}
          </span>
          <a className={s.barLink} href="/preview/studios">Studio design cuts</a>
        </div>

        <header className={s.top}>
          <div className={s.heading}>
            <div className={s.crumbs}>
              {crumbs.map((c, i) => (
                <Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <ChevronRight size={11} aria-hidden="true" />}
                  {c.to ? (
                    <button type="button" className={s.crumbLink} onClick={() => go(c.to!)}>{c.label}</button>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </Fragment>
              ))}
            </div>
            <h1 className={s.pageTitle}>{title}</h1>
          </div>

          <label className={s.search}>
            <Search size={14} aria-hidden="true" />
            <input placeholder="Search everything…" aria-label="Search everything" />
          </label>

          <div className={s.topRight}>
            <button type="button" className={s.iconBtn} aria-label="Notifications"><Bell size={16} /></button>
            <button type="button" className={s.iconBtn} aria-label="Recent"><History size={16} /></button>
            <span className={s.who}>
              <span className={s.face}>{who.initials}</span>
              <span className={s.whoText}>
                <span className={s.whoName}>{who.name}</span>
                <span className={s.whoRole}>{who.role}</span>
              </span>
            </span>
          </div>
        </header>

        {/* Below 820px the sidebar is gone, and the subject list with it.
            The same places, as a rail that scrolls sideways — tapping a
            subject opens its page, where the six kinds are the grid. */}
        <div className={s.mobileNav} aria-label="Sections">
          {role === "teacher" ? (
            <>
              <button type="button" className={s.mobileItem} data-on={route.v === "home"} onClick={() => go({ v: "home" })}>Home</button>
              <button type="button" className={s.mobileItem} data-on={route.v === "week"} onClick={() => go({ v: "week" })}>This week</button>
              <button type="button" className={s.mobileItem} data-on={route.v === "planner"} onClick={() => go({ v: "planner" })}>Goal planner</button>
              <button type="button" className={s.mobileItem} data-on={route.v === "library"} onClick={() => go({ v: "library" })}>My library</button>
              {subjects.length > 0 && <span className={s.mobileRule} aria-hidden="true" />}
              {subjects.map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  className={s.mobileItem}
                  data-on={sub.key === openSubject}
                  onClick={() => go({ v: "subject", s: sub.key })}
                >
                  {sub.name}
                  {sub.grade ? ` · ${sub.grade}` : ""}
                </button>
              ))}
            </>
          ) : role === "admin" ? (
            <>
              <button type="button" className={s.mobileItem} data-on={route.v === "admin"} onClick={() => go({ v: "admin" })}>Overview</button>
              {adminSurfaces.length > 0 && <span className={s.mobileRule} aria-hidden="true" />}
              {adminSurfaces.map((x) => (
                <a key={x.key} className={s.mobileItem} href={`/${x.key}`}>{x.label}</a>
              ))}
            </>
          ) : (
            <>
              <button type="button" className={s.mobileItem} data-on={route.v === "student"} onClick={() => go({ v: "student" })}>Home</button>
              {studentSubjects.length > 0 && <span className={s.mobileRule} aria-hidden="true" />}
              {studentSubjects.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className={s.mobileItem}
                  data-on={route.v === "studentSubject" && route.id === sub.id}
                  onClick={() => go({ v: "studentSubject", id: sub.id })}
                >
                  {sub.name}
                </button>
              ))}
            </>
          )}
        </div>

        <main className={s.content}>{children}</main>

        {role !== "admin" && (
          <button type="button" className={s.fab} onClick={onFab}>
            {role === "teacher" ? <Sparkles size={15} /> : <GraduationCap size={15} />}
            {fab}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One class, and its six kinds when it is the one you are in.
 *
 * `showGrade` is false inside a grade group: the header above already
 * said Grade 9, and repeating it on every row is the noise the grouping
 * exists to remove.
 */
function ClassRow({
  sub, open, activeKind, go, showGrade,
}: {
  sub: SideSubject;
  open: boolean;
  activeKind: KindKey | null;
  go: (r: Route) => void;
  showGrade: boolean;
}) {
  return (
    <>
      <button
        type="button"
        className={s.subject}
        data-on={open}
        aria-expanded={open}
        onClick={() => go(open ? { v: "home" } : { v: "subject", s: sub.key })}
      >
        <span className={s.dot} aria-hidden="true" />
        <span className={s.subjectName}>{sub.name}</span>
        {showGrade && sub.grade && <span className={s.grade}>{sub.grade}</span>}
        <span className={s.chev} aria-hidden="true"><ChevronRight size={13} /></span>
      </button>

      {open && (
        <div className={s.children}>
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k.key];
            const n = sub.counts[k.key] ?? 0;
            return (
              <button
                key={k.key}
                type="button"
                className={s.child}
                data-on={activeKind === k.key}
                aria-current={activeKind === k.key ? "page" : undefined}
                onClick={() => go({ v: "kind", s: sub.key, k: k.key })}
              >
                <span className={s.childIcon}><Icon size={14} strokeWidth={1.9} /></span>
                <span className={s.childText}>{k.label}</span>
                {n > 0 && <span className={s.count}>{n}</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** A flat nav row. `href` makes it a real link out to the shipped route. */
function NavItem({
  icon: Icon, label, on, onClick, href,
}: { icon: LucideIcon; label: string; on?: boolean; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <span className={s.itemIcon}><Icon size={15} strokeWidth={1.9} /></span>
      <span className={s.itemText}>{label}</span>
      {href && <ExternalLink size={12} aria-hidden="true" style={{ opacity: 0.5, flex: "none" }} />}
    </>
  );
  return href ? (
    <a className={s.item} href={href}>{inner}</a>
  ) : (
    <button type="button" className={s.item} data-on={!!on} aria-current={on ? "page" : undefined} onClick={onClick}>
      {inner}
    </button>
  );
}
