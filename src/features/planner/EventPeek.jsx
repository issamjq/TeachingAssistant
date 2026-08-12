"use client";

// The hover card — depth before commitment.
//
// Chips truncate: a month cell shows twelve characters of a title and
// nothing else, and finding out more used to cost a click into the day.
// Resting the pointer on any item now shows what the item actually is —
// full title, when, for whom, and the couple of numbers that matter for
// its kind — so opening things one by one stops being the only way to
// read the calendar closely.
//
// Info only, deliberately: pointer-events none, so it can never trap
// the pointer or intercept the click it is previewing. It follows
// hover AND keyboard focus (a tabbing teacher gets the same depth),
// appears after a beat so sweeping across a week does not strobe, and
// hides the moment anything is clicked or scrolled — a fixed-position
// card goes stale with the first wheel tick.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, GraduationCap, Users, StickyNote } from "lucide-react";
import { useMounted } from "@/shared/hooks/useMounted";
import { KIND_BY_KEY, tintOf, toMin } from "./month";
import s from "./Planner.module.css";

const STATUS_LABEL = {
  planned: "Planned", done: "Done", cancelled: "Cancelled",
  draft: "Draft", published: "Published", scheduled: "Scheduled",
};

function fmtTime(locale, hhmm) {
  const min = toMin(hhmm);
  if (min == null) return null;
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" })
    .format(new Date(2024, 0, 1, Math.floor(min / 60), min % 60));
}

export default function EventPeek({ peek, locale }) {
  const mounted = useMounted();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const { event, anchor } = peek || {};

  // Measure the card, then place it beside the chip on whichever side
  // has room, clamped to the viewport. Runs before paint so the card
  // never flashes at the wrong corner first.
  useLayoutEffect(() => {
    if (!event || !anchor || !ref.current) { setPos(null); return; }
    const r = anchor;
    const card = ref.current.getBoundingClientRect();
    const M = 12;
    let x = r.right + 10;
    if (x + card.width + M > window.innerWidth) x = r.left - card.width - 10;
    if (x < M) x = Math.min(window.innerWidth - card.width - M, Math.max(M, r.left));
    let y = r.top;
    if (y + card.height + M > window.innerHeight) y = window.innerHeight - card.height - M;
    if (y < M) y = M;
    setPos({ x, y });
  }, [event, anchor]);

  if (!mounted || !event) return null;

  const raw = event.raw || {};
  const meta = KIND_BY_KEY[event.kind];
  const d = new Date(`${event.date}T00:00:00`);
  const dateLine = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const start = fmtTime(locale, raw.start_time);
  const end = fmtTime(locale, raw.end_time);
  const status = STATUS_LABEL[raw.status] || null;

  const people = [raw.subject, raw.grade, raw.section].filter(Boolean).join(" · ");
  const quizFacts = event.kind === "quizzes"
    ? [
        raw.total_marks != null && `${raw.total_marks} marks`,
        raw.duration_minutes != null && `${raw.duration_minutes} min`,
        Array.isArray(raw.questions) && raw.questions.length > 0 && `${raw.questions.length} questions`,
      ].filter(Boolean).join(" · ")
    : null;
  const note = raw.notes || raw.instructions || null;

  return createPortal(
    <div
      ref={ref}
      className={s.peek}
      role="tooltip"
      style={{
        insetInlineStart: 0,
        left: pos ? pos.x : -9999,
        top: pos ? pos.y : -9999,
        "--tint": tintOf(event.kind),
      }}
    >
      <div className={s.peekHead}>
        <span className={s.peekDot} aria-hidden="true" />
        <span className={s.peekKind}>{meta?.label || event.kind}</span>
        {status && <span className={s.peekStatus} data-status={raw.status}>{status}</span>}
      </div>
      <p className={s.peekTitle}>{event.title || "Untitled"}</p>
      <p className={s.peekLine}>
        <Clock size={11} aria-hidden="true" />
        {dateLine}
        {start && <> · {start}{end ? `–${end}` : ""}</>}
      </p>
      {people && (
        <p className={s.peekLine}>
          <Users size={11} aria-hidden="true" />
          {people}
        </p>
      )}
      {quizFacts && (
        <p className={s.peekLine}>
          <GraduationCap size={11} aria-hidden="true" />
          {quizFacts}
        </p>
      )}
      {note && (
        <p className={`${s.peekLine} ${s.peekNote}`}>
          <StickyNote size={11} aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>,
    document.body,
  );
}
