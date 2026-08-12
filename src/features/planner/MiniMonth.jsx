"use client";

// The little month in the sidebar — orientation, not content.
//
// It answers "where am I, and where is the load" at a glance: the
// visible day (or week) is ringed, today is solid, and a day carrying
// work shows a dot. Clicking a day moves the main view there without
// changing which view it is — jumping to the 22nd should not also yank
// a teacher out of week view.
import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGrid, isoKey, sameYMD } from "./month";
import s from "./Planner.module.css";

export default function MiniMonth({ anchor, view, eventsByDate, locale, onPick, onMonthStep }) {
  const today = new Date();
  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const dows = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, 1 + i))),
    [locale],
  );

  // What counts as "where you are" depends on the view: the day itself,
  // or the whole week around it.
  const weekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const inFocus = (d) => {
    if (view === "day") return sameYMD(d, anchor);
    if (view === "week") {
      const diff = (d - weekStart) / 864e5;
      return diff >= 0 && diff < 7;
    }
    return false;
  };

  return (
    <div className={s.mini}>
      <div className={s.miniHead}>
        <span className={s.miniTitle}>
          {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor)}
        </span>
        <span className={s.miniNav}>
          <button type="button" aria-label="Previous month" onClick={() => onMonthStep(-1)}>
            <ChevronLeft size={13} className="rtl:rotate-180" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => onMonthStep(1)}>
            <ChevronRight size={13} className="rtl:rotate-180" />
          </button>
        </span>
      </div>
      <div className={s.miniGrid} aria-hidden="true">
        {dows.map((d, i) => <span key={`h${i}`} className={s.miniDow}>{d}</span>)}
      </div>
      <div className={s.miniGrid}>
        {grid.map((d, i) => {
          const busy = (eventsByDate.get(isoKey(d)) || []).length > 0;
          return (
            <button
              key={i}
              type="button"
              className={s.miniDay}
              data-outside={d.getMonth() !== anchor.getMonth()}
              data-today={sameYMD(d, today)}
              data-focus={inFocus(d)}
              onClick={() => onPick(d)}
              aria-label={d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
            >
              {d.getDate()}
              <span className={s.miniDot} data-on={busy} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
