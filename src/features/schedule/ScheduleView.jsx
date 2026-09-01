"use client";

// =====================================================================
// The week, as a timetable rather than as seven lists
//
// What was here before drew seven cards and stacked the day's entries
// inside each one. It answered "what is on Wednesday, and in what
// order" and stopped there — which leaves out most of what a timetable
// is for: when the day starts, where the free period is, whether
// Thursday runs late, how much is actually being taught this week.
//
// So the vertical axis is time now. Blocks sit where they happen, are as
// tall as they last, and the gaps between them are the real gaps. The
// subtitle has always said "pick a slot and assign a lesson"; clicking a
// slot now does that, which it never did.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, Clock3,
  Flame, ArrowRight, LayoutGrid, List as ListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RowActions, ConfirmDelete, api } from "@/views/_shared";
import BrandLoader from "@/components/BrandLoader";
import { isoDay, today as todayIso } from "@/lib/localDate";
import ScheduleModal from "./ScheduleModal";
import {
  minutesOf, fmtTime, fmtMinutes, startOfWeek,
  dayWindow, placement, tintFor, weekSummary,
} from "./timetable";
import s from "./Schedule.module.css";

// Tall enough that an ordinary 45–50 minute period clears the height at
// which the block drops its subject-and-room line. At 56px an hour, every
// real lesson was "short" and the subject never appeared at all — which
// left the colour rule carrying meaning with nothing to decode it against.
const HOUR_PX = 68;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState("week");

  // Re-rendered every minute so the "now" line creeps rather than
  // jumping whenever something else happens to change.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Loaded inside the effect rather than by a function called from it —
  // setting state synchronously as an effect body runs is what makes
  // React warn about cascading renders, and the `live` guard stops a
  // late reply writing to a screen the teacher has already left.
  useEffect(() => {
    let live = true;
    api("/api/schedule")
      .then((data) => { if (live) { setItems(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch((err) => { if (live) { setError(err.message); setLoading(false); } });
    return () => { live = false; };
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [isoDay(d), []]));
    for (const it of items) {
      const key = String(it.date).slice(0, 10);
      if (map.has(key)) map.get(key).push(it);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (minutesOf(a.start_time) ?? 1e9) - (minutesOf(b.start_time) ?? 1e9));
    }
    return map;
  }, [items, days]);

  const weekItems = useMemo(() => [...byDay.values()].flat(), [byDay]);
  const win = useMemo(() => dayWindow(weekItems), [weekItems]);
  const summary = useMemo(() => weekSummary(weekItems, todayIso()), [weekItems]);

  const hours = useMemo(() => {
    const out = [];
    for (let m = Math.ceil(win.from / 60) * 60; m < win.to; m += 60) out.push(m);
    return out;
  }, [win]);

  const gridHeight = ((win.to - win.from) / 60) * HOUR_PX;
  const today = todayIso();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowVisible = days.some((d) => isoDay(d) === today) && nowMins >= win.from && nowMins <= win.to;

  const shiftWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const onSaved = (saved, isNew) => {
    setItems((rows) => (isNew ? [...rows, saved] : rows.map((r) => (r.id === saved.id ? saved : r))));
    setEditing(null);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/schedule/${deleting.id}`, { method: "DELETE" });
      setItems((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  /** Clicking an empty hour opens the editor already filled in. */
  const newAt = (date, minutes) => {
    setEditing({
      __new: true,
      date: isoDay(date),
      start_time: fmtMinutes(minutes),
      end_time: fmtMinutes(Math.min(minutes + 45, 23 * 60 + 59)),
    });
  };

  const label = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      {/* ── header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Timetable
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Your <em className="italic font-light text-accent">week</em>
          </h2>
          <p className={`text-muted mt-2 text-[14.5px] ${s.deskHint}`}>
            Click any empty slot to put a lesson in it.
          </p>
        </div>
        <Button onClick={() => setEditing({ __new: true })}>
          <Plus size={15} className="mr-2" /> New entry
        </Button>
      </div>

      {/* ── what the week adds up to ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={CalendarDays} label="Lessons" value={summary.count} note="this week" />
        <Stat
          icon={Clock3}
          label="Teaching hours"
          value={summary.hours ? summary.hours.toFixed(summary.hours % 1 ? 1 : 0) : "0"}
          note="timetabled"
        />
        <Stat
          icon={Flame}
          label="Busiest day"
          value={summary.busiest
            ? new Date(`${summary.busiest.day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })
            : "—"}
          note={summary.busiest ? `${summary.busiest.n} lessons` : "nothing yet"}
        />
        <Stat
          icon={ArrowRight}
          label="Next up"
          value={summary.next ? fmtTime(summary.next.start_time) || "Any time" : "—"}
          note={summary.next ? summary.next.title : "clear from here"}
          truncate
        />
      </div>

      {/* ── controls ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex bg-paper-warm border border-line rounded-full p-1 text-sm">
          {[["week", LayoutGrid], ["list", ListIcon]].map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3.5 py-1.5 rounded-full font-mono text-[10.5px] uppercase tracking-wider transition inline-flex items-center gap-1.5 cursor-pointer ${
                view === v ? "bg-ink text-paper-cool" : "text-muted hover:text-ink"
              }`}
            >
              <Icon size={12} /> {v}
            </button>
          ))}
        </div>

        {view === "week" && (
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week"
              className="h-8 w-8 rounded-lg border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center cursor-pointer transition"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft min-w-[128px] text-center">
              {label(days[0])} — {label(days[6])}
            </span>
            <button
              type="button" onClick={() => shiftWeek(1)} aria-label="Next week"
              className="h-8 w-8 rounded-lg border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center cursor-pointer transition"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="ms-1 font-mono text-[10px] uppercase tracking-wider text-accent border-b border-accent hover:text-ink hover:border-ink cursor-pointer"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-crit/40 rounded-xl p-3.5">
          <p className="text-sm text-crit">{error}</p>
        </div>
      )}

      {loading ? (
        <BrandLoader compact fullscreen={false} />
      ) : view === "week" ? (
        <>
          <AnytimeStrip days={days} byDay={byDay} onOpen={setEditing} />

          <div className={s.board} style={{ "--hour": `${HOUR_PX}px` }}>
            <div className={s.headCorner} />
            {days.map((d) => {
              const key = isoDay(d);
              const n = (byDay.get(key) || []).length;
              return (
                <div
                  key={`h-${key}`}
                  className={s.head}
                  data-today={key === today}
                  data-weekend={d.getDay() === 0 || d.getDay() === 6}
                >
                  <p className={s.headDow}>{DOW[(d.getDay() + 6) % 7]}</p>
                  <p className={s.headNum}>{d.getDate()}</p>
                  <p className={s.headCount}>{n ? `${n} lesson${n === 1 ? "" : "s"}` : "—"}</p>
                </div>
              );
            })}

            <div className={s.gutter} style={{ height: gridHeight }}>
              {hours.map((m) => (
                <span
                  key={m}
                  className={s.hourLabel}
                  style={{ top: ((m - win.from) / (win.to - win.from)) * 100 + "%" }}
                >
                  {fmtMinutes(m)}
                </span>
              ))}
            </div>

            {days.map((d) => {
              const key = isoDay(d);
              const isToday = key === today;
              const list = (byDay.get(key) || []).filter((e) => minutesOf(e.start_time) != null);
              return (
                <div
                  key={`c-${key}`}
                  className={s.col}
                  data-today={isToday}
                  data-weekend={d.getDay() === 0 || d.getDay() === 6}
                  style={{ height: gridHeight }}
                >
                  {/* One button per hour, underneath the lessons. */}
                  <div className={s.slots} style={{ gridTemplateRows: `repeat(${hours.length + 1}, 1fr)` }}>
                    {Array.from({ length: hours.length + 1 }, (_, i) => {
                      const mins = Math.floor(win.from / 60) * 60 + i * 60;
                      return (
                        <button
                          key={i}
                          type="button"
                          className={s.slot}
                          onClick={() => newAt(d, mins)}
                          aria-label={`Add a lesson on ${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} at ${fmtMinutes(mins)}`}
                        />
                      );
                    })}
                  </div>

                  {list.map((it) => {
                    const pos = placement(it, win);
                    if (!pos) return null;
                    const px = (pos.height / 100) * gridHeight;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        className={s.block}
                        data-status={it.status}
                        data-short={px < 74}
                        data-tiny={px < 42}
                        style={{ top: `${pos.top}%`, height: `${pos.height}%`, "--tint": tintFor(it.subject) }}
                        onClick={() => setEditing(it)}
                        title={`${fmtTime(it.start_time)}–${fmtTime(it.end_time)} · ${it.title}${it.location ? ` · ${it.location}` : ""}`}
                      >
                        {/* Subject rides the time line rather than sitting
                            below the title. A 50-minute period is 57px and
                            a third line does not fit in it — which left the
                            colour rule coding a subject the block never
                            named, and clipped the title trying to. */}
                        <span className={s.blockTime}>
                          {[fmtTime(it.start_time), it.subject].filter(Boolean).join(" \u00b7 ")}
                        </span>
                        <span className={s.blockTitle}>{it.title}</span>
                        {it.location && <span className={s.blockMeta}>{it.location}</span>}
                      </button>
                    );
                  })}

                  {isToday && nowVisible && (
                    <div
                      className={s.now}
                      style={{ top: ((nowMins - win.from) / (win.to - win.from)) * 100 + "%" }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Phones get the same week as a readable agenda. */}
          <div className={s.agenda}>
            {days.map((d) => {
              const key = isoDay(d);
              const list = byDay.get(key) || [];
              if (!list.length) return null;
              return (
                <div key={`a-${key}`} className={s.agendaDay} data-today={key === today}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1.5">
                    {d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                    {key === today && <span className="text-accent"> · today</span>}
                  </p>
                  {list.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className={s.agendaRow}
                      style={{ "--tint": tintFor(it.subject) }}
                      onClick={() => setEditing(it)}
                    >
                      <span className={s.agendaTime}>{fmtTime(it.start_time) || "—"}</span>
                      <span className={s.agendaBar} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-ink leading-tight">{it.title}</span>
                        <span className="block text-[11px] text-muted mt-0.5 truncate">
                          {[it.subject, it.grade, it.location].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
            {weekItems.length === 0 && <EmptyWeek onAdd={() => setEditing({ __new: true })} />}
          </div>

          {weekItems.length === 0 && (
            <div className="hidden md:block">
              <EmptyWeek onAdd={() => setEditing({ __new: true })} />
            </div>
          )}
        </>
      ) : (
        <ListView items={items} onEdit={setEditing} onDelete={setDeleting} />
      )}

      {editing && (
        <ScheduleModal
          initial={editing?.__new ? null : editing}
          prefill={editing?.__new ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        message="This entry will be removed from your schedule."
      />
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────── */

function Stat({ icon: Icon, label, value, note, truncate }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/85 px-4 py-3.5">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted inline-flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </p>
      <p className="font-serif text-[27px] leading-none text-ink mt-1.5">{value}</p>
      <p className={`text-[11.5px] text-muted mt-1 ${truncate ? "truncate" : ""}`}>{note}</p>
    </div>
  );
}

/**
 * Entries with no start time.
 *
 * start_time is nullable, and something without one cannot be placed on
 * a time axis. Hiding it would be the worst answer — it is still a real
 * lesson — so the week keeps a strip above the grid for them.
 */
function AnytimeStrip({ days, byDay, onOpen }) {
  const any = days.some((d) => (byDay.get(isoDay(d)) || []).some((e) => minutesOf(e.start_time) == null));
  if (!any) return null;

  return (
    <div className={s.anytime}>
      <div className={s.anytimeLabel}>Any time</div>
      {days.map((d) => {
        const key = isoDay(d);
        const list = (byDay.get(key) || []).filter((e) => minutesOf(e.start_time) == null);
        return (
          <div key={`u-${key}`} className={s.anytimeCell}>
            {list.map((it) => (
              <button
                key={it.id}
                type="button"
                className={s.anytimeChip}
                style={{ "--tint": tintFor(it.subject) }}
                onClick={() => onOpen(it)}
              >
                {it.title}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function EmptyWeek({ onAdd }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line-strong bg-paper-warm/40 px-6 py-10 text-center">
      <p className="font-serif text-[19px] text-ink">Nothing timetabled this week.</p>
      <p className="text-[13px] text-muted mt-1.5 max-w-[380px] mx-auto leading-relaxed">
        Click any empty slot in the grid to add a lesson at that hour, or start
        from a plan you have already written.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        <Plus size={15} className="mr-2" /> Add a lesson
      </Button>
    </div>
  );
}

const STATUS_STYLE = {
  planned:   "bg-accent-soft text-accent",
  done:      "bg-ok/12 text-ok",
  cancelled: "bg-crit/12 text-crit",
};

/**
 * Every entry, newest day first, grouped under its date.
 *
 * The old table was one flat list in whatever order the API returned it,
 * which for a year of teaching is unreadable. Grouping by day is how a
 * schedule is actually scanned, and past days are dimmed so the eye
 * lands on what is still ahead.
 */
function ListView({ items, onEdit, onDelete }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = String(it.date).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (minutesOf(a.start_time) ?? 1e9) - (minutesOf(b.start_time) ?? 1e9));
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-paper-warm/40 px-6 py-12 text-center">
        <p className="text-muted text-sm">No schedule entries yet.</p>
      </div>
    );
  }

  const today = todayIso();

  return (
    <div className="space-y-4">
      {groups.map(([date, list]) => {
        const d = new Date(`${date}T00:00:00`);
        const past = date < today;
        return (
          <div key={date} className={`rounded-2xl border border-line bg-surface/85 overflow-hidden ${past ? "opacity-70" : ""}`}>
            <div className="flex items-baseline gap-2.5 px-5 py-3 border-b border-line-soft bg-paper-warm/40">
              <span className="font-serif text-[17px] text-ink">
                {d.toLocaleDateString(undefined, { weekday: "long" })}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                {d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {date === today && (
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-accent">· today</span>
              )}
              <span className="ms-auto font-mono text-[10px] text-muted">
                {list.length} lesson{list.length === 1 ? "" : "s"}
              </span>
            </div>

            {list.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3.5 px-5 py-3 border-b border-line-soft last:border-0 hover:bg-paper-warm/50 transition"
              >
                <span
                  className="w-[3px] self-stretch rounded-full flex-shrink-0"
                  style={{ background: tintFor(it.subject) }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[11px] text-ink-soft w-[92px] flex-shrink-0">
                  {it.start_time ? `${fmtTime(it.start_time)}–${fmtTime(it.end_time)}` : "Any time"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink leading-tight truncate">{it.title}</span>
                  <span className="block text-[11.5px] text-muted mt-0.5 truncate">
                    {[it.subject, it.grade && `${it.grade}${it.section ? ` · ${it.section}` : ""}`, it.location]
                      .filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span
                  className={`hidden sm:inline-flex font-mono text-[9.5px] uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0 ${
                    STATUS_STYLE[it.status] || STATUS_STYLE.planned
                  }`}
                >
                  {it.status || "planned"}
                </span>
                <RowActions onEdit={() => onEdit(it)} onDelete={() => onDelete(it)} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
