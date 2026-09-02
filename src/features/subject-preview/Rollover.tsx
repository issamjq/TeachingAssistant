"use client";

// =====================================================================
// A new year for a class the teacher already has
//
// The problem, in the owner's words: a faculty teaches almost the same
// subject at the same school with the same syllabus every year, to
// different students. Today that means emptying the roster by hand and
// deleting a term of homework and activities to make room — destroying
// last year's record in order to start this year's.
//
// So the class gains a YEAR, and a new year is a copy decision rather
// than a clear-out. Material carries over, picked deck by deck if she
// wants; children, attendance, marks and hand-ins do not, because they
// belong to the people who left. Last year's class stays exactly where
// it was, readable, until she deletes it — which is what makes it a
// history rather than a backup.
//
// ── What is real here ───────────────────────────────────────────────
//
// All of it, now. db/tune.sql §102 put `academic_year` on classes,
// students, goals, schedule_entries and ai_studio, backfilled every
// existing row from when it was created, and added roll_class_year() —
// a SECURITY DEFINER copy that duplicates the named material into the
// new year, archives the old class rather than deleting it, and never
// touches students, attendance, marks, hand-ins or the timetable.
//
// The button below is still inert, for one reason only: this preview
// reads and does not write. The call it would make is one line.
// =====================================================================

import { useState } from "react";
import { ArrowRight, Check, ChevronRight, Info, Lock } from "lucide-react";
import { KINDS, type KindKey, type SubjectGroup } from "./types";
import { KIND_ICON } from "./Shell";
import type { Route } from "./route";
import { SectionHead, ago, classLine } from "./parts";
import s from "./Screens.module.css";
import r from "./Rollover.module.css";

/**
 * The year after a given one. "2026-2027" → "2027-2028".
 *
 * The year itself is never computed here — public.current_academic_year()
 * decides it, so a school starting in April rather than September is one
 * function in the database to change and not a second opinion in the
 * browser. This only walks forward from whatever it said.
 */
export function nextYear(year: string): string {
  const [a, b] = year.split("-").map((n) => Number(n));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return year;
  return `${a + 1}-${b + 1}`;
}

/** What a new year deliberately does NOT bring with it, and why. */
const LEFT_BEHIND = [
  ["Students", "They finished the year. The new roll is the children in front of you now."],
  ["Attendance", "A register belongs to the term it was taken in."],
  ["Marks and scores", "Last year's results stay attached to last year's students."],
  ["Hand-ins", "Submissions belong to the child who made them."],
  ["The timetable", "Periods, rooms and dates are set fresh each year."],
];

export default function Rollover({
  sub, currentYear, go,
}: { sub: SubjectGroup; currentYear: string; go: (r: Route) => void }) {
  // Where the class is now, and where a roll would take it. A class
  // already in the current year rolls into the next one; a class still
  // sitting in a past year rolls into the current one, which is the
  // commoner case in September.
  const from = sub.academicYear || currentYear;
  const year = from === currentYear ? nextYear(currentYear) : currentYear;
  // Everything is brought forward unless she says otherwise: the whole
  // point is that she taught this before, so the default is that she
  // keeps what she made.
  const [dropped, setDropped] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<KindKey | null>(null);
  const [carrySyllabus, setCarrySyllabus] = useState(true);
  const [carryUnits, setCarryUnits] = useState(true);
  const [carrySkills, setCarrySkills] = useState(true);
  const [carryDivisions, setCarryDivisions] = useState(true);

  const isOn = (id: string) => !dropped.has(id);
  const toggle = (id: string) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleKind = (k: KindKey) => {
    const items = sub.items[k];
    const allOn = items.every((i) => isOn(i.id));
    setDropped((prev) => {
      const next = new Set(prev);
      for (const i of items) { if (allOn) next.add(i.id); else next.delete(i.id); }
      return next;
    });
  };

  const kinds = KINDS.filter((k) => sub.items[k.key].length);
  const carried = kinds.reduce((n, k) => n + sub.items[k.key].filter((i) => isOn(i.id)).length, 0);
  const roll = sub.divisions.reduce((n, d) => n + d.students, 0);

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        <div className={r.note}>
          <span className={r.noteIcon}><Info size={15} /></span>
          <p>
            This class sits in <b>{from}</b>. <code>db/tune.sql §102</code> put the year on
            classes, students, goals, the timetable and everything the studio makes, and
            added <code>roll_class_year()</code> to do the copy below. The button is inert
            here for one reason: <b>this preview reads and never writes.</b>
          </p>
        </div>
      </section>

      <section className={r.split}>
        <div>
          <SectionHead
            title="What you keep"
            meta={`${carried} of ${sub.total} pieces`}
          />

          <div className={`${s.card} ${s.tight}`}>
            {kinds.map((k) => {
              const Icon = KIND_ICON[k.key];
              const items = sub.items[k.key];
              const on = items.filter((i) => isOn(i.id)).length;
              const open = expanded === k.key;
              return (
                <div key={k.key}>
                  <div className={r.row}>
                    <button
                      type="button"
                      className={r.box}
                      role="checkbox"
                      aria-checked={on === items.length ? "true" : on === 0 ? "false" : "mixed"}
                      aria-label={`Carry over ${k.label}`}
                      data-state={on === items.length ? "on" : on === 0 ? "off" : "some"}
                      onClick={() => toggleKind(k.key)}
                    >
                      {on > 0 && (on === items.length ? <Check size={12} /> : <span className={r.dash} />)}
                    </button>
                    <span className={r.rowIcon}><Icon size={15} strokeWidth={1.9} /></span>
                    <span className={r.rowName}>{k.label}</span>
                    <span className={r.rowCount}>
                      {on} of {items.length}
                    </span>
                    <button
                      type="button"
                      className={r.expand}
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : k.key)}
                    >
                      {open ? "Hide" : "Pick"}
                      <ChevronRight size={12} />
                    </button>
                  </div>

                  {open && (
                    <div className={r.items}>
                      {items.map((it) => (
                        <label key={it.id} className={r.item}>
                          <button
                            type="button"
                            className={r.box}
                            role="checkbox"
                            aria-checked={isOn(it.id)}
                            data-state={isOn(it.id) ? "on" : "off"}
                            onClick={() => toggle(it.id)}
                          >
                            {isOn(it.id) && <Check size={12} />}
                          </button>
                          <span className={r.itemName}>{it.title}</span>
                          <span className={r.itemMeta}>{ago(it.updatedAt)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {[
              ["Syllabus and uploads", sub.materials.length, carrySyllabus, setCarrySyllabus],
              ["Units", sub.units.length, carryUnits, setCarryUnits],
              ["Teaching skills", sub.skills.length, carrySkills, setCarrySkills],
              ["Divisions", sub.divisions.length, carryDivisions, setCarryDivisions],
            ].map(([label, n, on, set]) => (
              <div key={String(label)} className={r.row} data-empty={!Number(n)}>
                <button
                  type="button"
                  className={r.box}
                  role="checkbox"
                  aria-checked={!!on && !!Number(n)}
                  aria-label={`Carry over ${label}`}
                  data-state={on && Number(n) ? "on" : "off"}
                  disabled={!Number(n)}
                  onClick={() => (set as (v: boolean) => void)(!on)}
                >
                  {!!on && !!Number(n) && <Check size={12} />}
                </button>
                <span className={r.rowIcon} />
                <span className={r.rowName}>{String(label)}</span>
                <span className={r.rowCount}>{Number(n) || "none"}</span>
              </div>
            ))}
          </div>

          {!kinds.length && (
            <p className={s.sectionMeta} style={{ marginTop: 10 }}>
              Nothing made under this class yet, so a new year would start empty either way.
            </p>
          )}
        </div>

        <div>
          <SectionHead title="What starts fresh" />
          <div className={s.card}>
            <ul className={r.left}>
              {LEFT_BEHIND.map(([what, why]) => (
                <li key={what}>
                  <span className={r.leftIcon}><Lock size={12} /></span>
                  <span>
                    <b>{what}</b>
                    <span>{why}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={r.leftFoot}>
              {roll
                ? `The ${roll} student${roll === 1 ? "" : "s"} on this roster stay with the year they were taught in.`
                : "Nobody is on this roster, so nothing is left behind."}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className={r.commit}>
          <div className={r.commitText}>
            <p className={r.commitTitle}>
              {sub.name}
              {sub.grade ? ` · ${classLine(sub.grade, null)}` : ""} · {year}
            </p>
            <p className={r.commitNote}>
              Carries <b>{carried}</b> piece{carried === 1 ? "" : "s"} of material forward
              from <b>{from}</b>. That class is archived, not deleted — it keeps its roll,
              its marks and its hand-ins, and stays readable until you remove it yourself.
            </p>
          </div>
          <div className={r.commitActions}>
            <button
              type="button"
              className={`${s.btn} ${s.btnQuiet}`}
              onClick={() => go({ v: "subject", s: sub.key })}
            >
              Back to the class
            </button>
            <button type="button" className={`${s.btn} ${s.btnMake}`} disabled>
              Start {year} <ArrowRight size={13} />
            </button>
          </div>
        </div>
        <p className={r.disabled}>
          Behind the button:{" "}
          <code>
            roll_class_year(&apos;{sub.classIds[0] ?? "<class>"}&apos;, &apos;{year}&apos;,
            [{carried} ids], goals, archive)
          </code>
          {sub.classIds.length === 0 && (
            <> — except this class has no <code>classes</code> row yet, so one is created
            first. Work derived from grade and subject alone has never needed one.</>
          )}
        </p>
      </section>
    </div>
  );
}
