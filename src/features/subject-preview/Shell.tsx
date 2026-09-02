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

import { Fragment, type ReactNode } from "react";
import {
  BookOpen, Bell, ChevronRight, ClipboardCheck, CalendarRange, ExternalLink,
  FolderOpen, HelpCircle, History, LayoutDashboard, MonitorPlay, NotebookPen,
  PenLine, Plus, Puzzle, Search, Settings, Sparkles, User, GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { KINDS, type KindKey } from "./types";
import { roleOf, subjectOf, type Route } from "./route";
import s from "./Shell.module.css";

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
  grade: string | null;
  counts: Record<KindKey, number>;
};

export type Crumb = { label: string; to?: Route };

type Props = {
  route: Route;
  go: (r: Route) => void;
  onRole: (r: "teacher" | "student") => void;
  who: { name: string; initials: string; role: string };
  title: string;
  crumbs?: Crumb[];
  /** Teacher only — the expandable subject list. */
  subjects?: SideSubject[];
  /** Student only — their enrolled subjects, with outstanding work. */
  studentSubjects?: { id: string; name: string; grade: string | null; count: number }[];
  fab?: string;
  children: ReactNode;
};

export default function Shell({
  route, go, onRole, who, title, crumbs = [], subjects = [],
  studentSubjects = [], fab = "Ask for help", children,
}: Props) {
  const role = roleOf(route);
  const openSubject = subjectOf(route);
  const activeKind = route.v === "kind" || route.v === "item" ? route.k : null;

  return (
    <div className={s.frame}>
      <aside className={s.side}>
        <div className={s.brand}>
          <span className={s.brandMark}><Sparkles size={15} strokeWidth={2} /></span>
          <span className={s.brandText}>
            <span className={s.brandName}>Murchid</span>
            <span className={s.brandRole}>
              {role === "teacher" ? "Teacher studio" : "Student portal"}
            </span>
          </span>
        </div>

        <nav className={s.nav} aria-label="Preview navigation">
          {role === "teacher" ? (
            <>
              <NavItem icon={LayoutDashboard} label="Home" on={route.v === "home"} onClick={() => go({ v: "home" })} />
              <NavItem icon={CalendarRange} label="This week" on={route.v === "week"} onClick={() => go({ v: "week" })} />
              <NavItem icon={FolderOpen} label="My library" on={route.v === "library"} onClick={() => go({ v: "library" })} />
              <NavItem icon={Sparkles} label="Studio" href="/studio" />

              <p className={s.groupLabel}>
                <span>My subjects</span>
                <a className={s.groupAction} href="/database">Manage</a>
              </p>

              {subjects.map((sub) => {
                const open = sub.key === openSubject;
                return (
                  <Fragment key={sub.key}>
                    <button
                      type="button"
                      className={s.subject}
                      data-on={open}
                      aria-expanded={open}
                      onClick={() => go(open ? { v: "home" } : { v: "subject", s: sub.key })}
                    >
                      <span className={s.dot} aria-hidden="true" />
                      <span className={s.subjectName}>{sub.name}</span>
                      {sub.grade && <span className={s.grade}>{sub.grade}</span>}
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
                  </Fragment>
                );
              })}

              <a className={s.addSubject} href="/database">
                <Plus size={14} strokeWidth={2} />
                Add a subject
              </a>
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
          <span className={s.roles} role="group" aria-label="Whose studio to preview">
            <button type="button" className={s.role} data-on={role === "teacher"} onClick={() => onRole("teacher")}>Teacher</button>
            <button type="button" className={s.role} data-on={role === "student"} onClick={() => onRole("student")}>Student</button>
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
                </button>
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

        <a className={s.fab} href="/studio">
          {role === "teacher" ? <Sparkles size={15} /> : <GraduationCap size={15} />}
          {fab}
        </a>
      </div>
    </div>
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
