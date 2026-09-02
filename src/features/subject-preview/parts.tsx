"use client";

// Small pieces shared by every screen in the preview. Nothing here holds
// state or fetches — they are the vocabulary the screens are written in.

import type { ReactNode } from "react";
import { ArrowRight, Clock, Printer, Star } from "lucide-react";
import { KIND_BY_KEY, type Item } from "./types";
import { KIND_ICON } from "./Shell";
import s from "./Screens.module.css";

// ── formatting ────────────────────────────────────────────────────────

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "—");

/**
 * How long ago, in the words a teacher would use.
 *
 * Deliberately coarse past a week: "2 weeks ago" is what she needs to
 * know, and "13 days ago" makes her do the arithmetic to find out.
 */
export function ago(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((Date.now() - then) / 864e5);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

export const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

/** "Grade 11 · 11B" — whatever of the class this thing actually names. */
export const classLine = (grade: string | null, section: string | null) =>
  [grade && (/^\d+$/.test(grade) ? `Grade ${grade}` : grade), section].filter(Boolean).join(" · ");

// ── section heading ───────────────────────────────────────────────────

export function SectionHead({
  title, meta, action, onAction,
}: { title: string; meta?: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className={s.sectionHead}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {action ? (
        <button type="button" className={s.sectionLink} onClick={onAction}>{action}</button>
      ) : meta ? (
        <span className={s.sectionMeta}>{meta}</span>
      ) : null}
    </div>
  );
}

// ── the week's prep ring ──────────────────────────────────────────────

/**
 * Real numerator over real denominator — how many of this week's
 * timetabled classes already have a plan behind them.
 */
export function Ring({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  return (
    <svg className={s.ring} width="66" height="66" viewBox="0 0 66 66" role="img"
      aria-label={`${done} of ${total} classes this week have a plan`}>
      <circle className={s.ringTrack} cx="33" cy="33" r={r} fill="none" strokeWidth="6" />
      <circle
        className={s.ringFill} cx="33" cy="33" r={r} fill="none" strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 33 33)"
      />
      <text className={s.ringText} x="33" y="33" textAnchor="middle" dominantBaseline="central">
        {done}/{total}
      </text>
    </svg>
  );
}

// ── one artefact, as a card ───────────────────────────────────────────

export function WorkCard({
  item, subtitle, onOpen,
}: { item: Item; subtitle?: string; onOpen: () => void }) {
  const def = KIND_BY_KEY[item.kind];
  const Icon = KIND_ICON[item.kind];
  const when = ago(item.updatedAt);
  return (
    <article className={s.work}>
      <div className={s.workTop}>
        <span className={s.workKind}>
          <Icon size={13} strokeWidth={2} aria-hidden="true" />
          {def.one[0].toUpperCase() + def.one.slice(1)}
        </span>
        <button type="button" className={s.star} aria-label={`Pin ${item.title}`}>
          <Star size={14} />
        </button>
      </div>

      <h3 className={s.workTitle}>{item.title}</h3>
      {subtitle && <p className={s.workMeta}>{subtitle}</p>}
      {when && (
        <span className={s.workTime}>
          <Clock size={11} aria-hidden="true" />
          {when}
        </span>
      )}

      <div className={s.workActions}>
        <button type="button" className={s.btn} onClick={onOpen}>Open</button>
        <button type="button" className={s.btnIcon} aria-label={`Print ${item.title}`}>
          <Printer size={15} />
        </button>
      </div>
    </article>
  );
}

// ── states ────────────────────────────────────────────────────────────

export function Empty({
  icon, title, text, action,
}: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>{icon}</span>
      <p className={s.emptyTitle}>{title}</p>
      <p className={s.emptyText}>{text}</p>
      {action && <span className={s.emptyAction}>{action}</span>}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className={s.page} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your studio…</span>
      <div className={s.skel} style={{ height: 30, width: 220 }} />
      <div className={s.workGrid}>
        {Array.from({ length: rows * 3 }, (_, i) => (
          <div key={i} className={s.skel} style={{ height: 156 }} />
        ))}
      </div>
    </div>
  );
}

export function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={s.error} role="alert">
      <p className={s.errorTitle}>Your studio did not load</p>
      <p className={s.errorText}>
        {message} This preview reads your real Supabase data, so it needs you signed in
        with a teaching profile.
      </p>
      <span style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button type="button" className={s.btn} onClick={onRetry}>Try again</button>
        <a className={`${s.btn} ${s.btnQuiet}`} href="/signin">Sign in</a>
      </span>
    </div>
  );
}

export function Go() {
  return <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />;
}
