"use client";

// =====================================================================
// The studio chrome every design variant renders inside
//
// Sidebar, top bar, and the conversation rail — the whole dashboard
// shell, not just the answer pane. The nav is TEACHER_NAV from
// src/config/nav.ts reproduced item for item, because a preview of the
// studio that invents its own navigation is a preview of a different
// product.
//
// The structure is identical across all ten. Only the material changes:
// every colour, radius, shadow and font here reads from a --f-* custom
// property the variant sets on the root element. That is what makes the
// comparison honest — you are choosing a design, not an IA.
//
// The rail's top two conversations are real: clicking one switches the
// whole content pane to that session's work (a lesson + deck + quiz in
// one, an activity + deck + homework in the other), so each design has
// to prove it handles both shapes rather than the one it was drawn for.
// =====================================================================

import type { ReactNode } from "react";
import {
  LayoutDashboard, Sparkles, CalendarRange, Target, BookOpen, ClipboardCheck,
  PenLine, MonitorPlay, Puzzle, Pin, Users, GraduationCap, BarChart3,
  PanelLeftClose, Search, Bell, HelpCircle, Plus, ChevronRight, MessageSquare,
  FileText, type LucideIcon,
} from "lucide-react";
import {
  ACTIVE_NAV, KIND_LABEL, NAV, SESSIONS, olderSessions, teacher, type Kind,
} from "./fixture";
import f from "./StudioFrame.module.css";

// Same mapping StudioShell uses — semantic key to icon.
const NAV_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  studio: Sparkles,
  scheduler: CalendarRange,
  goals: Target,
  lessons: BookOpen,
  quizzes: ClipboardCheck,
  homework: PenLine,
  presentations: MonitorPlay,
  activities: Puzzle,
  bulletin: Pin,
  students: Users,
  skills: GraduationCap,
  reports: BarChart3,
};

const KIND_ICON: Record<Kind, LucideIcon> = {
  lesson_plan: FileText,
  quiz: GraduationCap,
  homework: ClipboardCheck,
  presentation: MonitorPlay,
  activity: Puzzle,
};

export type FrameProps = {
  /** The variant's own class, carrying its --f-* values. */
  theme: string;
  /** Which of the two open conversations the content pane is showing. */
  session: number;
  onSession: (i: number) => void;
  children: ReactNode;
  /** Labelled rail, or icons only. */
  rail?: "full" | "icons";
  /** A design that owns its own conversation list can turn this one off. */
  history?: boolean;
};

export default function StudioFrame({
  theme, session, onSession, children, rail = "full", history = true,
}: FrameProps) {
  const pct = Math.round((teacher.creditsUsed / teacher.creditsTotal) * 100);

  return (
    <div className={`${f.frame} ${theme}`} data-rail={rail}>
      {/* ── sidebar ───────────────────────────────────────────────── */}
      <aside className={f.side}>
        <div className={f.brand}>
          <span className={f.brandMark}>
            <Sparkles size={15} />
          </span>
          <span className={f.brandName}>
            Murchid
          </span>
          <button type="button" className={f.collapse} aria-label="Collapse sidebar">
            <PanelLeftClose size={15} />
          </button>
        </div>

        <nav className={f.nav} aria-label="Studio sections">
          {NAV.map((group) => (
            <div key={group.section} className={f.navGroup}>
              <span className={f.navLabel}>{group.section}</span>
              {group.items.map((item) => {
                const Icon = NAV_ICON[item.icon] ?? LayoutDashboard;
                const on = item.key === ACTIVE_NAV;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={f.navItem}
                    data-on={on}
                    title={item.label}
                    aria-current={on ? "page" : undefined}
                  >
                    <span className={f.navIcon}>
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                    <span className={f.navText}>{item.label}</span>
                    {item.badge != null && <span className={f.navBadge}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={f.foot}>
          <div className={f.footRow}>
            <span className={f.face}>{teacher.initials}</span>
            <span className={f.footText}>
              <span className={f.footName}>{teacher.name}</span>
              <span className={f.footRole}>{teacher.role}</span>
            </span>
          </div>
          <span className={f.meter}>
            <span className={f.meterFill} style={{ width: `${100 - pct}%` }} />
          </span>
          <span className={f.meterText}>
            {teacher.creditsTotal - teacher.creditsUsed} of {teacher.creditsTotal} credits left
          </span>
        </div>
      </aside>

      {/* ── main ──────────────────────────────────────────────────── */}
      <div className={f.main}>
        <header className={f.top}>
          <span className={f.crumb}>
            Overview
            <ChevronRight size={13} />
            <span className={f.crumbNow}>AI Studio</span>
          </span>
          <span className={f.search}>
            <Search size={13} />
            Search your library…
            <span className={f.searchKey}>⌘K</span>
          </span>
          <span className={f.topRight}>
            <button type="button" className={f.iconBtn} aria-label="Help">
              <HelpCircle size={15} />
            </button>
            <button type="button" className={f.iconBtn} aria-label="Notifications">
              <Bell size={15} />
              <span className={f.ping} />
            </button>
            <button type="button" className={f.newBtn}>
              <Plus size={14} />
              New
            </button>
          </span>
        </header>

        <div className={f.body} data-hist={history}>
          <main className={f.content}>{children}</main>

          {history && (
            <aside className={f.hist} aria-label="Conversations">
              <div className={f.histHead}>
                <span className={f.histTitle}>Conversations</span>
                <span className={f.histCount}>{SESSIONS.length + olderSessions.length}</span>
              </div>

              <button type="button" className={f.histNew}>
                <Plus size={14} />
                New conversation
              </button>

              <div className={f.histList}>
                <span className={f.histGroup}>Open</span>
                {SESSIONS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={f.histItem}
                    data-on={i === session}
                    onClick={() => onSession(i)}
                    aria-current={i === session}
                  >
                    <span className={f.histItemTitle}>{s.title}</span>
                    <span className={f.histMeta}>
                      {s.live && <span className={f.liveDot} />}
                      {s.when}
                      <span className={f.histDot} />
                      {s.turns} turns
                      <span className={f.histMade}>
                        {s.made.map((k) => {
                          const Icon = KIND_ICON[k];
                          return (
                            <span key={k} className={f.histChip} title={KIND_LABEL[k]}>
                              <Icon size={10} />
                            </span>
                          );
                        })}
                      </span>
                    </span>
                  </button>
                ))}

                <span className={f.histGroup}>Earlier</span>
                {olderSessions.map((s) => {
                  const Icon = KIND_ICON[s.kind];
                  return (
                    <button key={s.id} type="button" className={f.histItem}>
                      <span className={f.histItemTitle}>{s.title}</span>
                      <span className={f.histMeta}>
                        <MessageSquare size={10} />
                        {s.turns}
                        <span className={f.histDot} />
                        {s.when}
                        <span className={f.histMade}>
                          <span className={f.histChip} title={KIND_LABEL[s.kind]}>
                            <Icon size={10} />
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}

                <p className={f.histNote}>
                  Conversations are kept for 30 days. Anything you save goes to
                  your library and stays.
                </p>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
