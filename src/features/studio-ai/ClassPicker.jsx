"use client";

// =====================================================================
// Which class this generation is for
//
// The studio used to take only the prompt and parse grade/subject back
// out of the generated text — so with five sections a teacher had no
// mental model of where a lesson "went", and the values that decide
// student delivery (db/tune.sql §48) were the model's guess. This is
// the faculty answer: her real classes, read off her roster, one tap.
//
// Deliberately NOT a gate. The owner removed the pre-generation
// questions ("a teacher who types 'a lesson on the water cycle for
// Grade 6' has said enough"), and this respects that: nothing blocks,
// nothing asks. The pick is remembered per browser — a teacher preps
// for the same class in the gaps around teaching it.
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { Users, Check } from "lucide-react";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import { classLabel, normGrade, normSubject } from "@/shared/lib/classMatch";
import { useTeacherClasses } from "@/shared/lib/teacherClasses";
import s from "./Studio.module.css";

const PICK_KEY = "murchid.studio.class";

const keyOf = (c) =>
  [normGrade(c.grade) || "", c.section.trim().toLowerCase(), normSubject(c.subject) || ""].join("§");

/**
 * Composer-bar button + popover, the SkillsPicker shape. Reports the
 * current pick through onSelection(cls | null) whenever it changes; the
 * parent keeps it in a ref and reads it at send time.
 */
export function ClassPicker({ onSelection, preferred = null }) {
  const { classes, ready } = useTeacherClasses();
  /**
   * `preferred` is the class the screen was opened for — the sidebar
   * sends a teacher to /quizzes FROM Physics · Grade 9, and the composer
   * on that screen should already be writing for it.
   *
   * It only decides the FIRST render, and only when it names a class she
   * actually has. After that her own pick wins, including picking "no
   * class": a preference that reasserted itself on every render would be
   * a control that undoes what you just did.
   */
  const [pickedKey, setPickedKey] = useState(() => readStorage(PICK_KEY) || "");
  // Once she has chosen — including choosing "no class" — the screen's
  // preference stops applying. A default that reasserted itself would be
  // a control that undoes what you just did. State, not a ref: it is read
  // while rendering, which is the definition of something React has to
  // know about.
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const onSelectionRef = useRef(onSelection);
  useEffect(() => { onSelectionRef.current = onSelection; });

  // A remembered pick whose class has left the roster resolves to null
  // rather than silently labelling work for a class that no longer exists.
  const stored = classes.find((c) => keyOf(c) === pickedKey) || null;
  /**
   * The class the screen was opened for, matched on grade and subject
   * only.
   *
   * `preferred` comes from the sidebar, which files a class by subject
   * and grade — a lesson is written once for Grade 9 and taught to 9A,
   * 9B and 9C. The roster splits those into one row per division, so
   * matching on the full key would find nothing. The first division is
   * offered and she can change it; what matters is that the grade and
   * subject — the two fields that decide delivery — arrive already set.
   */
  const wanted =
    !stored && !touched && preferred
      ? classes.find(
          (c) =>
            normSubject(c.subject) === normSubject(preferred.subject) &&
            normGrade(c.grade) === normGrade(preferred.grade),
        ) || null
      : null;
  const picked = stored || wanted;

  // Keyed on WHICH class, not on the object holding it — belt and braces
  // with the memo above, and the thing that stays true if the memo ever
  // stops holding.
  const pickedId = picked ? keyOf(picked) : "";
  useEffect(() => {
    onSelectionRef.current?.(picked);
  }, [pickedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // No roster, nothing to offer — the studio stays exactly as it was.
  if (!ready || classes.length === 0) return null;

  const pick = (c) => {
    setTouched(true);
    const next = c && picked && keyOf(c) === keyOf(picked) ? null : c;
    setPickedKey(next ? keyOf(next) : "");
    writeStorage(PICK_KEY, next ? keyOf(next) : "");
    setOpen(false);
  };

  return (
    <div className={s.skillsWrap} ref={wrapRef}>
      <button
        type="button"
        className={s.kindBtn}
        data-on={open || !!picked}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Which class this is for — its grade and subject decide which students receive the work"
        onClick={() => setOpen((v) => !v)}
      >
        <Users size={13} />{" "}
        {picked
          ? `For ${classLabel(picked)}${picked.count ? ` · ${picked.count} student${picked.count === 1 ? "" : "s"}` : ""}`
          : "For · any class"}
      </button>

      {open && (
        <div className={s.skillsPop} role="listbox" aria-label="Your classes">
          <p className={s.skillsPopHead}>Writing for</p>
          <button
            type="button"
            role="option"
            aria-selected={!picked}
            className={s.skillsPopItem}
            data-on={!picked}
            onClick={() => pick(null)}
          >
            <span className={s.skillsPopCheck} aria-hidden>
              {!picked && <Check size={12} />}
            </span>
            <span className={s.skillsPopName}>No class — Murchid reads the brief</span>
          </button>
          {classes.map((c) => {
            const on = picked && keyOf(c) === keyOf(picked);
            return (
              <button
                key={keyOf(c)}
                type="button"
                role="option"
                aria-selected={!!on}
                className={s.skillsPopItem}
                data-on={!!on}
                onClick={() => pick(c)}
              >
                <span className={s.skillsPopCheck} aria-hidden>
                  {on && <Check size={12} />}
                </span>
                <span className={s.skillsPopName}>
                  {classLabel(c)} ·{" "}
                  {c.count
                    ? `${c.count} student${c.count === 1 ? "" : "s"}`
                    : "nobody enrolled yet"}
                </span>
              </button>
            );
          })}
          <div className={s.skillsPopFoot}>
            <span>Sets the grade and subject the class receives work by.</span>
          </div>
        </div>
      )}
    </div>
  );
}
