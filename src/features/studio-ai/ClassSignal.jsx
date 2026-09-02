"use client";

// What this class found hard, said once, with the number that says it.
//
// The marks have been in the table the whole time — per-question, from
// her own marking and from auto-marked papers — and nothing has ever
// read them back. So Murchid knew that eight of a class of twenty-four
// missed both questions on terminal velocity, and never mentioned it.
//
// Three rules this is built to keep, and they matter more than the
// feature does:
//
// 1. THE EVIDENCE IS IN THE SENTENCE. Not "your class struggled with
//    forces" but "8 answered, average 31%". She should be able to
//    disagree with the data, not just with the suggestion — and she can
//    check it against her own gradebook in a minute.
//
// 2. IT PROPOSES, IT NEVER APPLIES. Nothing changes because this
//    appeared. An adaptive system that silently rewrites lessons is one
//    a teacher has to police, and the first time it is wrong she stops
//    trusting all of it.
//
// 3. IT SPEAKS ONLY WHEN THE NUMBERS EARN IT. The floor lives in SQL
//    (§98: n >= 5, mean < 60%). Two children missing a question usually
//    means the question was ambiguous.
//
// Never any names. The rows carry no student id by construction, and
// this text is one press away from a prompt.

import React, { useEffect, useState } from "react";
import { TrendingDown, X } from "lucide-react";
import { api } from "@/views/_shared";
import { classLabel } from "@/shared/lib/classMatch";

const DISMISS_KEY = "murchid.studio.signalDismissed";

const keyFor = (cls, spot) =>
  `${cls?.grade || ""}|${cls?.section || ""}|${cls?.subject || ""}|${spot?.question || ""}`;

const readDismissed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

export default function ClassSignal({ cls, onUse }) {
  const [spots, setSpots] = useState(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let live = true;
    if (!cls?.grade) {
      // Cleared in the callback rather than the effect body, so this is
      // never a synchronous setState during render.
      Promise.resolve().then(() => { if (live) setSpots(null); });
      return () => { live = false; };
    }
    const qs = new URLSearchParams({ grade: cls.grade });
    if (cls.subject) qs.set("subject", cls.subject);
    if (cls.section) qs.set("section", cls.section);
    api(`/api/insights/weak-spots?${qs}`)
      .then((r) => { if (live) setSpots(Array.isArray(r) ? r : []); })
      // A signal is a bonus, never an error a teacher has to read.
      .catch(() => { if (live) setSpots([]); });
    return () => { live = false; };
  }, [cls?.grade, cls?.section, cls?.subject]);

  // The weakest one only. A list of everything the class found hard is a
  // report; one sentence is something she can act on before her lesson.
  const spot = spots?.find((sp) => !dismissed.has(keyFor(cls, sp)));
  if (!spot) return null;

  const drop = (sp) => {
    const next = new Set(dismissed);
    next.add(keyFor(cls, sp));
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    } catch { /* a dismissal that does not persist is a small loss */ }
  };

  return (
    <div className="mb-2.5 flex items-start gap-2.5 rounded-lg border border-line bg-paper-warm px-3.5 py-2.5">
      <TrendingDown size={15} className="flex-none mt-0.5 text-warn" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink leading-relaxed">
          {/* The number first: it is the reason this is on screen. */}
          <strong>{spot.n} answered</strong> “{String(spot.question).replace(/\s+/g, " ").slice(0, 90)}
          {String(spot.question).length > 90 ? "…" : ""}” in {spot.quiz}, averaging{" "}
          <strong>{spot.mean_pct}%</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            onUse?.(
              `Start with a short recap of ${spot.question} — the class averaged ` +
              `${spot.mean_pct}% on it last time. Then carry on with: `,
            );
            drop(spot);
          }}
          className="mt-1.5 text-[12.5px] text-accent hover:underline"
        >
          Open {cls ? classLabel(cls) : "the lesson"} with a recap of this
        </button>
      </div>
      <button
        type="button"
        onClick={() => drop(spot)}
        aria-label="Dismiss this suggestion"
        title="Dismiss — it will not come back for this class"
        className="flex-none text-muted hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
