"use client";

// =====================================================================
// The agenda — the calendar as a list, which is how a week is read
//
// The month answers "what is on the 14th" and the time grid answers
// "where in the day does it sit". Neither answers "what is coming",
// which is the question a teacher actually opens a calendar with, and
// which the old Timetable screen's list view was the only place to ask.
// That screen is gone; the question moved here, and got better at being
// asked: every kind is in it, not just schedule entries, and it starts
// at today rather than at whatever the API returned first.
// =====================================================================
import React, { useMemo, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { agendaDays, KIND_BY_KEY, tintOf, toMin } from "./month";
import s from "./Planner.module.css";

export default function Agenda({ eventsByDate, todayIso, locale, onSelect, onNew }) {
  const t = useT();
  const [showEarlier, setShowEarlier] = useState(false);
  const { ahead, earlier } = useMemo(
    () => agendaDays(eventsByDate, todayIso),
    [eventsByDate, todayIso],
  );

  const dayLabel = (key) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const Day = ({ day, past }) => (
    <div className={s.agDay} data-past={past || undefined} data-today={day.key === todayIso || undefined}>
      <p className={s.agDate}>
        {dayLabel(day.key)}
        {day.key === todayIso && <span className={s.agToday}>{t("planner.agenda.today")}</span>}
      </p>
      <div>
        {day.events.map((e) => {
          const start = toMin(e.raw?.start_time);
          return (
            <button
              key={e.id}
              type="button"
              className={s.agRow}
              style={{ "--tint": tintOf(e.kind) }}
              onClick={() => onSelect?.(e)}
            >
              <span className={s.agTime}>
                {start == null ? t("planner.allDay") : e.time}
              </span>
              <span className={s.agBar} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={s.agTitle}>{e.title}</span>
                <span className={s.agMeta}>
                  {[
                    KIND_BY_KEY[e.kind]?.label,
                    e.raw?.subject,
                    [e.raw?.grade, e.raw?.section].filter(Boolean).join(" "),
                    e.raw?.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={s.agenda}>
      {earlier.length > 0 && (
        <>
          <button type="button" className={s.agEarlier} onClick={() => setShowEarlier((v) => !v)}>
            <ChevronDown size={13} className={showEarlier ? s.agChevOpen : undefined} />
            {showEarlier ? t("planner.agenda.hideEarlier") : t("planner.agenda.showEarlier")}
          </button>
          {showEarlier && earlier.map((day) => <Day key={day.key} day={day} past />)}
        </>
      )}

      {ahead.length === 0 ? (
        <div className={s.agEmpty}>
          <p className="font-serif text-[19px] text-ink">{t("planner.agenda.empty")}</p>
          <p className="text-[13px] text-muted mt-1.5 max-w-[380px] mx-auto leading-relaxed">
            {t("planner.agenda.emptyBody")}
          </p>
          <button type="button" className={s.agEmptyAdd} onClick={onNew}>
            <CalendarPlus size={14} /> {t("planner.newEntry")}
          </button>
        </div>
      ) : (
        ahead.map((day) => <Day key={day.key} day={day} />)
      )}
    </div>
  );
}
