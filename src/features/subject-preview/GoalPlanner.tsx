"use client";

// =====================================================================
// Goal planner — where a term gets said out loud
//
// This replaces "Studio" in the sidebar, and the swap is the point. The
// studio stopped being a place: it opens in a panel over whatever screen
// you are on, already knowing the class and the kind, because that is
// what the screen you are on already told it. Making a quiz for Grade 9
// Physics should not require going somewhere else and re-answering two
// questions you have already answered by standing where you stand.
//
// What is left needing a page of its own is the longer conversation —
// planning a unit, a term, a book — and that is what this is. Same
// composer, run full width, over the units the teacher already has.
//
// Everything below the composer is real: `goals` rows, which the schema
// describes as "a whole portion of a subject — a term, a unit, a book",
// grouped under the class each one names.
// =====================================================================

import { Target } from "lucide-react";
import { normGrade, normSubject } from "@/shared/lib/classMatch";
import type { RosterClass, SubjectGroup, Unit } from "./types";
import type { Route } from "./route";
import Composer from "./Composer";
import { Empty, SectionHead, classLine } from "./parts";
import s from "./Screens.module.css";

type PlannerUnit = Unit & { subject: string | null; grade: string | null };

const DONE = new Set(["achieved"]);

export default function GoalPlanner({
  classes, rosterClasses, units, go,
}: {
  classes: SubjectGroup[];
  rosterClasses: RosterClass[];
  units: PlannerUnit[];
  go: (r: Route) => void;
}) {
  // Grouped the way the sidebar groups: by the class the unit names, not
  // by the subject alone. A Grade 8 Science term and a Grade 9 Science
  // term are two different plans and must never stack into one list.
  const groups = classes
    .map((cls) => ({ cls, items: units.filter((u) => u.id && belongs(u, cls)) }))
    .filter((g) => g.items.length);

  const orphans = units.filter((u) => !classes.some((cls) => belongs(u, cls)));

  return (
    <div className={`${s.page} ${s.enter}`}>
      <Composer
        classes={classes}
        rosterClasses={rosterClasses}
        variant="page"
        starters={units.filter((u) => !DONE.has(u.status ?? "")).slice(0, 3).map((u) => u.title)}
      />

      <section>
        <SectionHead
          title="What you have planned"
          meta={units.length ? `${units.length} unit${units.length === 1 ? "" : "s"} across ${groups.length} class${groups.length === 1 ? "" : "es"}` : undefined}
        />

        {units.length ? (
          <div style={{ display: "grid", gap: 18 }}>
            {groups.map(({ cls, items }) => (
              <div key={cls.key}>
                <p className={s.sectionMeta} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className={s.sectionLink}
                    onClick={() => go({ v: "subject", s: cls.key })}
                  >
                    {cls.name}
                  </button>
                  {cls.grade ? ` · ${classLine(cls.grade, null)}` : ""}
                </p>
                <div className={`${s.card} ${s.tight}`}>
                  {items.map((u, i) => {
                    const done = DONE.has(u.status ?? "");
                    return (
                      <div key={u.id} className={s.unit}>
                        <span className={`${s.unitMark} ${done ? s.unitDone : ""}`}>{i + 1}</span>
                        <span className={s.unitName}>{u.title}</span>
                        <span className={s.unitMeta}>
                          {done ? "Covered" : u.status === "active" ? "In progress" : "Not started"}
                          {u.days ? ` · ${u.days} days` : ""}
                        </span>
                        <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/goals">Open</a>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {orphans.length > 0 && (
              <div>
                {/* A unit that names no class reaches no subject section,
                    which is exactly the thing the composer's destination
                    exists to stop happening again. */}
                <p className={s.sectionMeta} style={{ marginBottom: 8 }}>Not filed under a class</p>
                <div className={`${s.card} ${s.tight}`}>
                  {orphans.map((u, i) => (
                    <div key={u.id} className={s.unit}>
                      <span className={s.unitMark}>{i + 1}</span>
                      <span className={s.unitName}>{u.title}</span>
                      <span className={s.unitMeta}>No subject or grade set</span>
                      <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/goals">Fix</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Empty
            icon={<Target size={19} />}
            title="Nothing planned yet"
            text="Say what a term or a unit needs to cover and the plan lands under the class it is for. Everything made from it goes to that class's shelves."
          />
        )}
      </section>
    </div>
  );
}

/** Does this unit name this class? Subject AND grade, never subject alone. */
function belongs(u: PlannerUnit, cls: SubjectGroup): boolean {
  const subject = normSubject(u.subject);
  if (!subject) return false;
  return subject === normSubject(cls.name) && normGrade(u.grade) === normGrade(cls.grade);
}
