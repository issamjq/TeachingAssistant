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
import { useRoster } from "@/features/delivery";
import { classLabel, distinctClasses, normGrade, normSubject } from "@/shared/lib/classMatch";
import s from "./Studio.module.css";

const PICK_KEY = "murchid.studio.class";

const keyOf = (c) =>
  [normGrade(c.grade) || "", c.section.trim().toLowerCase(), normSubject(c.subject) || ""].join("§");

/**
 * Composer-bar button + popover, the SkillsPicker shape. Reports the
 * current pick through onSelection(cls | null) whenever it changes; the
 * parent keeps it in a ref and reads it at send time.
 */
export function ClassPicker({ onSelection }) {
  const { roster, ready } = useRoster();
  const [pickedKey, setPickedKey] = useState(() => readStorage(PICK_KEY) || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const onSelectionRef = useRef(onSelection);
  useEffect(() => { onSelectionRef.current = onSelection; });

  const classes = ready ? distinctClasses(roster) : [];
  // A remembered pick whose class has left the roster resolves to null
  // rather than silently labelling work for a class that no longer exists.
  const picked = classes.find((c) => keyOf(c) === pickedKey) || null;

  useEffect(() => {
    onSelectionRef.current?.(picked);
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Users size={13} /> {picked ? `For ${classLabel(picked)}` : "For · any class"}
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
                  {classLabel(c)} · {c.count} student{c.count === 1 ? "" : "s"}
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
