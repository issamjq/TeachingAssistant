"use client";

// Who will actually receive this — answered while the teacher types.
//
// The grade / subject / section fields on a work-carrying entry are not
// labels, they are the delivery mechanism: students receive the work only
// when these fields text-match their roster row (db/tune.sql §48). This
// component makes that rule visible at the moment it can still be fixed —
// a live count of matched students under the fields, and the teacher's
// real classes as one-tap chips so the values are copied from roster rows
// instead of retyped from memory.

import { Check, Users } from "lucide-react";
import {
  classLabel,
  distinctClasses,
  matchRoster,
  normGrade,
  normSubject,
  type Audience,
  type TeacherClass,
} from "@/shared/lib/classMatch";
import { useRoster } from "./useRoster";

function sameClass(a: Audience, c: TeacherClass): boolean {
  return (
    normGrade(a.grade) === normGrade(c.grade) &&
    normSubject(a.subject) === normSubject(c.subject) &&
    String(a.section ?? "").trim().toLowerCase() === c.section.trim().toLowerCase()
  );
}

export function AudiencePreview({
  audience,
  onPick,
  idle = false,
}: {
  audience: Audience;
  /** Present makes the class chips render; fills the form with a real class. */
  onPick?: (cls: TeacherClass) => void;
  /** True while the form has no audience typed yet — chips show, no verdict. */
  idle?: boolean;
}) {
  const { roster, ready } = useRoster();
  if (!ready) return null;

  const classes = distinctClasses(roster);
  const matched = matchRoster(audience, roster);
  const hasAudience = Boolean(
    String(audience.grade ?? "").trim() || String(audience.subject ?? "").trim(),
  );

  if (!roster.length) {
    return (
      <p className="text-[12.5px] text-muted mt-1">
        No students on your roster yet — work can be saved, but nobody receives it
        until students are added in My students.
      </p>
    );
  }

  return (
    <div className="mt-1">
      {onPick && classes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Your classes">
          {classes.slice(0, 8).map((c) => {
            const active = sameClass(audience, c);
            return (
              <button
                key={`${c.grade}§${c.section}§${c.subject}`}
                type="button"
                onClick={() => onPick(c)}
                aria-pressed={active}
                className={`murchid-pressable murchid-focus inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  active
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-line bg-paper-cool text-ink-soft hover:border-line-strong hover:text-ink"
                }`}
              >
                {active && <Check size={11} strokeWidth={2.5} aria-hidden />}
                {classLabel(c)}
                <span className={active ? "text-accent-hover/70" : "text-muted"}>{c.count}</span>
              </button>
            );
          })}
        </div>
      )}
      {hasAudience && !idle && (() => {
        if (matched.length) {
          return (
            <p role="status" className="text-[12.5px] mt-1 flex items-center gap-1.5 text-ok">
              <Users size={13} aria-hidden />
              Reaches {matched.length} student{matched.length === 1 ? "" : "s"} —{" "}
              {classLabel(audience) || "your class"}.
            </p>
          );
        }
        // Zero. Say WHY when the blocker is precisely the subject — the
        // commonest silent failure: roster rows saved without a subject
        // can never receive subject-labelled work.
        const gradeOnly = matchRoster({ ...audience, subject: null }, roster);
        const subject = String(audience.subject ?? "").trim();
        return (
          <p role="status" className="text-[12.5px] mt-1 flex items-start gap-1.5 text-warn">
            <Users size={13} className="mt-0.5 flex-none" aria-hidden />
            <span>
              {gradeOnly.length && subject ? (
                <>
                  {gradeOnly.length} student{gradeOnly.length === 1 ? "" : "s"} match the
                  grade, but none carries &ldquo;{subject}&rdquo; as their subject in My
                  students — so nobody receives this. Fix the subject on their roster
                  rows, or match what is written there.
                </>
              ) : (
                <>
                  Matches nobody on your roster — students receive work only when the
                  grade and subject here match their roster row exactly.
                </>
              )}
            </span>
          </p>
        );
      })()}
    </div>
  );
}
