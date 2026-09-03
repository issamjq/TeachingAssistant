"use client";

// =====================================================================
// The settings that belong to ONE class
//
// Everything on this card is scoped to this subject at this grade, which
// is the whole reason it can exist at all. Teaching skills, divisions and
// roll are held today against a (grade, section, subject) audience —
// they were always per-class — but there has never been a per-class
// screen to read them on, so they live in three global lists a teacher
// filters by hand.
//
// Read-only, like the rest of the preview. Every action hands off to the
// screen that owns the write, so nothing here can put a child on a
// roster or point a skill at a class by accident.
// =====================================================================

import { AlertTriangle, GraduationCap, Layers, Users } from "lucide-react";
import type { SubjectGroup } from "./types";
import type { Route } from "./route";
import { SectionHead, classLine } from "./parts";
import s from "./Screens.module.css";
import x from "./ClassSettings.module.css";
import Link from "next/link";

export default function ClassSettings({
  sub, go,
}: { sub: SubjectGroup; go: (r: Route) => void }) {
  const roll = sub.divisions.reduce((n, d) => n + d.students, 0);
  const emptyDivisions = sub.divisions.filter((d) => d.students === 0);

  return (
    <section>
      <SectionHead
        title="Class settings"
        meta={`${sub.name}${sub.grade ? ` · ${classLine(sub.grade, null)}` : ""}`}
      />

      <div className={x.grid}>
        {/* ── the grade ─────────────────────────────────────────────── */}
        {/* A class with no grade is not a small blemish. Students receive
            work by matching grade AND subject (db/tune.sql §48), so a
            gradeless class delivers to nobody however well it is
            written. It is the first card for that reason. */}
        <article className={`${x.card} ${sub.grade ? "" : x.warn}`}>
          <span className={x.cardIcon}>
            {sub.grade ? <GraduationCap size={16} /> : <AlertTriangle size={16} />}
          </span>
          <div className={x.cardBody}>
            <h3 className={x.cardTitle}>{sub.grade ? classLine(sub.grade, null) : "No grade set"}</h3>
            <p className={x.cardText}>
              {sub.grade
                ? "Work made here is delivered to students on this grade."
                : "Nothing made under this class can reach a student until it has a grade — delivery matches grade and subject together."}
            </p>
          </div>
          <Link className={`${s.btn} ${sub.grade ? s.btnQuiet : s.btnMake} ${s.btnSmall}`} href="/database">
            {sub.grade ? "Change" : "Set the grade"}
          </Link>
        </article>

        {/* ── divisions ─────────────────────────────────────────────── */}
        <article className={x.card}>
          <span className={x.cardIcon}><Layers size={16} /></span>
          <div className={x.cardBody}>
            <h3 className={x.cardTitle}>
              Divisions
              <span className={x.cardCount}>{sub.divisions.length || "none yet"}</span>
            </h3>
            {sub.divisions.length ? (
              <>
                <div className={x.chips}>
                  {sub.divisions.map((d) => (
                    <span key={d.name} className={x.chip} data-empty={d.students === 0}>
                      {d.name}
                      <b>{d.students}</b>
                    </span>
                  ))}
                </div>
                <p className={x.cardText}>
                  {roll} student{roll === 1 ? "" : "s"} across {sub.divisions.length}{" "}
                  division{sub.divisions.length === 1 ? "" : "s"}.
                  {emptyDivisions.length > 0 && (
                    <>
                      {" "}
                      <b>
                        {emptyDivisions.map((d) => d.name).join(", ")} has nobody on the roster
                      </b>
                      , so work aimed at it reaches no one.
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className={x.cardText}>
                No divisions yet. Adding students with a division splits this class into the
                groups you actually teach, and lets you set work for one of them.
              </p>
            )}
          </div>
          <Link className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/database">
            Add students
          </Link>
        </article>

        {/* ── the roll ──────────────────────────────────────────────── */}
        <article className={x.card}>
          <span className={x.cardIcon}><Users size={16} /></span>
          <div className={x.cardBody}>
            <h3 className={x.cardTitle}>
              Students
              <span className={x.cardCount}>{roll}</span>
            </h3>
            <p className={x.cardText}>
              {roll
                ? "Everyone on the roster for this subject at this grade — adding one here does not touch your other classes."
                : "Nobody yet. A student joins one subject at a time, so being on a Physics roster does not put them in Mathematics."}
              {" "}
              <b>A new year starts with an empty roll and keeps the material</b>, so next
              year&rsquo;s batch does not cost you this year&rsquo;s work.
            </p>
          </div>
          <button
            type="button"
            className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`}
            onClick={() => go({ v: "rollover", s: sub.key })}
          >
            Start a new year
          </button>
        </article>

        {/* ── teaching skills ───────────────────────────────────────── */}
        <article className={x.card}>
          <span className={x.cardIcon}><GraduationCap size={16} /></span>
          <div className={x.cardBody}>
            <h3 className={x.cardTitle}>
              Teaching skills
              <span className={x.cardCount}>{sub.skills.length || "none"}</span>
            </h3>
            {sub.skills.length ? (
              <>
                <ul className={x.skills}>
                  {sub.skills.map((sk) => (
                    <li key={sk.id}>
                      <span className={x.skillName}>{sk.name}</span>
                      <span className={x.skillVia}>reaches {sk.via}</span>
                    </li>
                  ))}
                </ul>
                <p className={x.cardText}>
                  These profiles ground everything the studio writes for this class.
                </p>
              </>
            ) : (
              <p className={x.cardText}>
                Nothing recorded for this class. A skill profile is how you teach — pacing,
                the phrasing you use, what you always cover first — and the studio writes
                against it instead of guessing.
              </p>
            )}
          </div>
          <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/teaching-skills">
            {sub.skills.length ? "Manage" : "Add one"}
          </a>
        </article>
      </div>
    </section>
  );
}
