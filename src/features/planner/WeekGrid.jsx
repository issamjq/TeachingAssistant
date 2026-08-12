"use client";

// =====================================================================
// The time grid — a week (or one day) the way a calendar drawer sees it
//
// The month answers "what is on the 14th"; this answers "where in the
// day does it sit". One time rail on the inline-start edge, one column
// per day, and two layers inside each column: an all-day shelf on top
// for the things that have a date but no clock (a quiz due Thursday is
// due *Thursday*, not due at 09:00), and the timed schedule below it,
// with entries drawn at their hour and sized by their duration.
//
// Interactions follow the calendar conventions everyone already knows:
// click an empty slot to create an entry starting at that hour, click
// an entry to edit it, click a day's header to fall into its day view.
// A hairline marks the current minute across today's column.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import { isoKey, sameYMD, tintOf, KIND_BY_KEY, hourWindow, layoutDay, toMin } from "./month";
import s from "./Planner.module.css";

const HOUR_PX = 52;

/** "13:20" for en, "١٣:٢٠"-style for ar — through Intl, like every other
    label on the page. */
function fmtHour(locale, minutes) {
  const d = new Date(2024, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

export default function WeekGrid({
  days,               // Date[] — 7 for the week, 1 for a day
  eventsByDate,       // Map<iso, event[]>
  locale,
  onSlotClick,        // (iso, "HH:MM") → new entry seeded at that hour
  onEventClick,       // (event) → edit
  onAllDayClick,      // (iso) → the day's list
  onDayClick,         // (Date) → day view
}) {
  const today = new Date();

  // Every visible timed event decides the rail together, so all columns
  // share one scale and 09:00 is the same height in each.
  const allTimed = useMemo(
    () => days.flatMap((d) => (eventsByDate.get(isoKey(d)) || [])),
    [days, eventsByDate],
  );
  const { start, end } = useMemo(() => hourWindow(allTimed), [allTimed]);
  const hours = useMemo(() => {
    const out = [];
    for (let m = start; m < end; m += 60) out.push(m);
    return out;
  }, [start, end]);
  const railH = ((end - start) / 60) * HOUR_PX;

  // The current minute, for the now line. A minute of drift is invisible
  // at 52px per hour, so one tick a minute is plenty.
  const [nowMin, setNowMin] = useState(() => today.getHours() * 60 + today.getMinutes());
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const y = (min) => ((min - start) / 60) * HOUR_PX;

  const slotFromClick = (e, iso) => {
    // Only the empty canvas creates; a click that hit an entry edits it
    // and stops before reaching here.
    const rect = e.currentTarget.getBoundingClientRect();
    const min = start + ((e.clientY - rect.top) / HOUR_PX) * 60;
    const hour = Math.max(0, Math.min(23, Math.floor(min / 60)));
    onSlotClick?.(iso, `${String(hour).padStart(2, "0")}:00`);
  };

  return (
    <div className={s.tg} data-days={days.length}>
      {/* ── day headers ─────────────────────────────────────────── */}
      <div className={s.tgHead}>
        <div className={s.tgGutterHead} aria-hidden="true" />
        {days.map((d) => {
          const isToday = sameYMD(d, today);
          return (
            <button
              key={isoKey(d)}
              type="button"
              className={s.tgDayHead}
              data-today={isToday}
              onClick={() => onDayClick?.(d)}
              aria-label={d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
            >
              <span className={s.tgDow}>
                {d.toLocaleDateString(locale, { weekday: "short" })}
              </span>
              <span className={s.tgDayNum}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* ── the all-day shelf ───────────────────────────────────── */}
      <div className={s.tgAllDay}>
        <div className={s.tgGutterCell} aria-hidden="true">
          <span className={s.tgAllDayLabel}>all day</span>
        </div>
        {days.map((d) => {
          const iso = isoKey(d);
          const dated = (eventsByDate.get(iso) || []).filter((e) => toMin(e.raw?.start_time) == null);
          const shown = dated.slice(0, days.length === 1 ? 8 : 3);
          const more = dated.length - shown.length;
          return (
            <div key={iso} className={s.tgAllDayCol} data-today={sameYMD(d, today)}>
              {shown.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={s.tgChip}
                  style={{ "--tint": tintOf(e.kind) }}
                  title={`${KIND_BY_KEY[e.kind]?.label || e.kind} · ${e.title}`}
                  onClick={() => onAllDayClick?.(iso)}
                >
                  {e.title}
                </button>
              ))}
              {more > 0 && (
                <button type="button" className={s.tgMore} onClick={() => onAllDayClick?.(iso)}>
                  +{more} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── the timed rail ──────────────────────────────────────── */}
      <div className={s.tgBody} style={{ height: railH }}>
        <div className={s.tgGutter} aria-hidden="true">
          {hours.map((m) => (
            <span key={m} className={s.tgHour} style={{ top: y(m) }}>
              {fmtHour(locale, m)}
            </span>
          ))}
        </div>

        {days.map((d) => {
          const iso = isoKey(d);
          const isToday = sameYMD(d, today);
          const laid = layoutDay(eventsByDate.get(iso) || []);
          return (
            <div
              key={iso}
              className={s.tgCol}
              data-today={isToday}
              onClick={(e) => slotFromClick(e, iso)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSlotClick?.(iso, "08:00");
                }
              }}
              aria-label={`${d.toLocaleDateString(locale, { weekday: "long", day: "numeric" })} — click to add an entry`}
            >
              {hours.map((m) => (
                <span key={m} className={s.tgRule} style={{ top: y(m) }} aria-hidden="true" />
              ))}

              {laid.map(({ event: e, startMin, endMin, col, cols }) => (
                <button
                  key={e.id}
                  type="button"
                  className={s.tgEvent}
                  data-done={e.raw?.status === "done"}
                  data-cancelled={e.raw?.status === "cancelled"}
                  style={{
                    "--tint": tintOf(e.kind),
                    top: y(startMin),
                    height: Math.max(24, y(endMin) - y(startMin) - 2),
                    insetInlineStart: `calc(${(col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 5px)`,
                  }}
                  title={`${e.title} · ${fmtHour(locale, startMin)}–${fmtHour(locale, endMin)}`}
                  onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }}
                >
                  <span className={s.tgEventTitle}>{e.title}</span>
                  {endMin - startMin >= 40 && (
                    <span className={s.tgEventTime}>
                      {fmtHour(locale, startMin)}–{fmtHour(locale, endMin)}
                    </span>
                  )}
                </button>
              ))}

              {isToday && nowMin >= start && nowMin <= end && (
                <span className={s.tgNow} style={{ top: y(nowMin) }} aria-hidden="true">
                  <span className={s.tgNowDot} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
