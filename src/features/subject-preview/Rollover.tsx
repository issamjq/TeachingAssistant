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
// ── What is real here, and what is proposed ─────────────────────────
//
// The counts, the titles and the roll are this account's rows. The YEAR
// is not: there is no academic-year column anywhere in db/tune.sql — the
// only thing close is student_grades.term. So this screen is a proposal
// with real material in it, and it says so on the page rather than
// letting a reviewer assume the column exists. Nothing here writes.
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
 * The academic year containing a date. September starts a new one, which
 * is the UAE school calendar and the one the product is built for.
 */
export function academicYear(d = new Date()): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 8 ? y : y - 1;
  return `${start}/${String(start + 1).slice(2)}`;
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
  sub, go,
}: { sub: SubjectGroup; go: (r: Route) => void }) {
  const year = academicYear();
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
            <b>Proposed, not built.</b> The material, counts and roll below are this
            account&rsquo;s real rows, but a class has no academic year in the schema yet —
            there is no column for it in <code>db/tune.sql</code>. This screen is the design
            for one, so it can be judged before anything is migrated.
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
              Carries <b>{carried}</b> piece{carried === 1 ? "" : "s"} of material forward.
              The class you have now is kept, readable, under its own year — and stays until
              you delete it, which is how last year&rsquo;s marks and hand-ins remain
              answerable.
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
          The button is inert: this preview only reads. Building it needs a year on the
          class and a copy that rewrites owner ids — the design is what is being asked
          about here.
        </p>
      </section>
    </div>
  );
}
