"use client";

// "Start from your curriculum."
//
// The goal planner has always opened with an empty box asking what her
// students should master. A teacher of twelve years does not need help
// deciding that — the syllabus decided it in August. What she needs is
// the production work, and being asked to type the unit name first is
// being asked to do the one part she finds trivial in order to unlock
// the part she finds expensive.
//
// So: pick what you teach, and the unit is already written — its title,
// its outcomes, a pacing hint. She edits from something instead of from
// nothing.
//
// PROVENANCE IS PART OF THE UI, not a footnote. A sequence we drafted
// and one taken from a ministry document are different claims, and
// showing the second when we only have the first is how a veteran ends
// up auditing every week before she can trust any of it — which costs
// her more than building it herself would have.

import React, { useEffect, useMemo, useState } from "react";
import { BookMarked, ChevronRight, Check } from "lucide-react";
import { api } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { GRADE_LEVELS, MAJORS } from "@/lib/enums";
import s from "./Goals.module.css";

const SOURCE_NOTE = {
  derived:
    "Read off your own syllabus just now. Check the order against your scheme of work before you rely on it.",
  derived_low:
    "Read off your own syllabus, but the order had to be guessed — that file may not be a syllabus. Worth checking every unit.",
  starter:
    "A starter sequence, drafted by us — the topics almost every board covers, in the usual order. Check it against your school's scheme and change what differs.",
};

export default function CurriculumStart({ onPick }) {
  const [curricula, setCurricula] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [cur, setCur] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [units, setUnits] = useState(null);
  const [open, setOpen] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [derived, setDerived] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      api("/api/curriculum").catch(() => []),
      api("/api/curriculum/coverage").catch(() => []),
    ]).then(([c, cov]) => {
      if (!live) return;
      setCurricula(Array.isArray(c) ? c : []);
      setCoverage(Array.isArray(cov) ? cov : []);
    });
    return () => { live = false; };
  }, []);

  // Only offer combinations that actually have a sequence. A picker that
  // lets her choose three things and then says "nothing here" wasted
  // three decisions to deliver a dead end.
  const grades = useMemo(() => {
    const g = new Set(coverage.filter((r) => !cur || r.curriculum_code === cur).map((r) => r.grade));
    return GRADE_LEVELS.filter((x) => g.has(x));
  }, [coverage, cur]);

  const subjects = useMemo(() => {
    const sub = new Set(
      coverage
        .filter((r) => (!cur || r.curriculum_code === cur) && (!grade || r.grade === grade))
        .map((r) => r.subject),
    );
    return MAJORS.filter((x) => sub.has(x));
  }, [coverage, cur, grade]);

  useEffect(() => {
    let live = true;
    if (!cur || !grade || !subject) {
      // Cleared off the microtask queue, not in the effect body — the
      // same reason as everywhere else in this codebase.
      Promise.resolve().then(() => { if (live) setUnits(null); });
      return () => { live = false; };
    }
    const qs = new URLSearchParams({ curriculum: cur, grade, subject });
    api(`/api/curriculum/units?${qs}`)
      .then((r) => { if (live) setUnits(Array.isArray(r) ? r : []); })
      .catch(() => { if (live) setUnits([]); });
    return () => { live = false; };
  }, [cur, grade, subject]);

  // Nothing seeded at all — say nothing rather than offer an empty shelf.
  if (!coverage.length) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 rounded-lg border border-line px-3.5 py-3 text-start hover:border-ink transition-colors"
      >
        <BookMarked size={16} className="flex-none text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-ink">Start from your curriculum</span>
          <span className="block text-[12px] text-muted">
            Pick the unit you are teaching and its outcomes come with it
          </span>
        </span>
        <ChevronRight size={15} className="flex-none text-muted rtl:rotate-180" aria-hidden />
      </button>
    );
  }

  // Derived units render through the same list as curated ones — same
  // shape, different provenance, and the note below says which.
  const shown = derived?.units?.length
    ? derived.units.map((u, i) => ({ ...u, id: `derived-${i}`, source: "derived" }))
    : units;
  // Confidence decides FIRST. Keying the note off `source` alone meant
  // "derived" always matched and the low-confidence wording could never
  // appear — which is the one case it exists for. The service treats
  // anything that is not exactly "high" as low; so does this.
  const note = !shown?.length
    ? null
    : derived
      ? (derived.confidence === "high" ? SOURCE_NOTE.derived : SOURCE_NOTE.derived_low)
      : SOURCE_NOTE[shown[0].source] || null;

  return (
    <div className="rounded-lg border border-line p-3.5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className={s.eyebrow}>From your curriculum</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-muted hover:text-ink"
        >
          I'll write it myself
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select className={s.field} value={cur} onChange={(e) => setCur(e.target.value)}
                aria-label="Curriculum">
          <option value="">Curriculum…</option>
          {curricula
            .filter((c) => coverage.some((r) => r.curriculum_code === c.code))
            .map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select className={s.field} value={grade} onChange={(e) => setGrade(e.target.value)}
                aria-label="Grade">
          <option value="">Grade…</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={s.field} value={subject} onChange={(e) => setSubject(e.target.value)}
                aria-label="Subject">
          <option value="">Subject…</option>
          {subjects.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      {units && !units.length && !derived && (cur && grade && subject) && (
        <div className="mt-3">
          <p className="text-[12.5px] text-muted leading-relaxed">
            Nobody has written that sequence out yet. If you have the syllabus
            on your shelf, Murchid can read the units straight off it.
          </p>
          <button
            type="button"
            disabled={deriving}
            onClick={async () => {
              setDeriving(true);
              try {
                // Everything on her shelf for this class — usually the
                // syllabus she uploaded when the term started.
                const mats = await api(
                  `/api/materials?${new URLSearchParams({ grade, subject })}`,
                ).catch(() => []);
                const ids = (Array.isArray(mats) ? mats : []).map((m) => m.id);
                // material_ids is required — there is nothing to read
                // without it. Say so here rather than spending a round
                // trip to be told.
                if (!ids.length) {
                  flash(
                    "Nothing on your shelf for that class yet. Add the syllabus under My material, then try again.",
                  );
                  return;
                }
                const r = await api("/api/curriculum/derive", {
                  method: "POST",
                  body: { curriculum: cur, grade, subject, material_ids: ids },
                });
                setDerived(r?.units?.length ? r : null);
                if (r?.unread_materials?.length) {
                  flash(`Couldn't read: ${r.unread_materials.join(", ")}.`);
                }
              } catch (e) {
                // The service distinguishes "that isn't a syllabus" from
                // "we couldn't read the file" from "it read but found
                // nothing usable", and none of them are charged. They
                // need different things from her, so they say different
                // things.
                const said = {
                  not_a_syllabus:
                    "That file doesn't read like a syllabus, so Murchid won't invent units from it — you'd find out in week three. Describe the unit below instead.",
                  derive_empty:
                    "It read the file but couldn't find a sequence in it. The contents pages usually work better than the whole book.",
                  no_readable_material:
                    "There's no text Murchid can read in those files — a scan needs a PDF with selectable text.",
                  no_backend:
                    "Reading a syllabus isn't switched on yet. Describe the unit below and Murchid will plan it from your words.",
                }[e?.code];
                flash(said || e?.message || "Could not read a sequence out of that.");
              } finally {
                setDeriving(false);
              }
            }}
            className="mt-2 text-[12.5px] text-accent hover:underline disabled:opacity-50"
          >
            {deriving ? "Reading your syllabus…" : "Build one from my syllabus"}
          </button>
        </div>
      )}

      {!!shown?.length && (
        <>
          <ol className="mt-3 space-y-1.5">
            {shown.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick({
                      title: u.title,
                      brief: [
                        `Unit ${u.seq} of the ${grade} ${subject} sequence.`,
                        u.outcomes?.length
                          ? `By the end, students should be able to:\n${u.outcomes.map((o) => `— ${o}`).join("\n")}`
                          : "",
                      ].filter(Boolean).join("\n\n"),
                      timeline: u.typical_weeks ? `${u.typical_weeks} weeks` : "",
                      grade,
                      subject,
                    });
                    setOpen(false);
                  }}
                  className="w-full text-start rounded-lg border border-line px-3 py-2.5 hover:border-ink transition-colors"
                >
                  <span className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[10px] text-muted flex-none">
                      {String(u.seq).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] text-ink">{u.title}</span>
                      {!!u.outcomes?.length && (
                        <span className="block text-[12px] text-muted mt-0.5">
                          {u.outcomes.length} outcome{u.outcomes.length === 1 ? "" : "s"}
                          {u.typical_weeks ? ` · about ${u.typical_weeks} weeks` : ""}
                        </span>
                      )}
                    </span>
                    <Check size={13} className="flex-none text-muted mt-1" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {(note || derived?.note) && (
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed border-s-2 border-line ps-3">
              {/* What it actually read — "the last two terms are not in
                  this document" is the sort of thing she must know
                  before building a term on it. */}
              {derived?.note ? `${derived.note} ` : ""}{note}
            </p>
          )}
        </>
      )}
    </div>
  );
}
