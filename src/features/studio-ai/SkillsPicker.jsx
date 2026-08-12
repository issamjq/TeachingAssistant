"use client";

// =====================================================================
// Which of the teacher's skill profiles ground this generation
//
// A multi-select over teaching_skills, everything selected by default.
// Deselections persist per browser as the teacher's default — stored as
// EXCLUSIONS, so a skill saved tomorrow is included automatically
// instead of silently missing from a stale allowlist.
//
// When everything is selected the request omits skill_ids entirely and
// the service applies its assignment-aware defaults; a customised pick
// is sent explicitly and overrides them. (Contract: todo/backend/08.)
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { GraduationCap, Check, RotateCcw } from "lucide-react";
import { api } from "@/views/_shared";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import s from "./Studio.module.css";

const OFF_KEY = "murchid.studio.skillsOff";

const readOff = () => {
  try {
    return new Set(JSON.parse(readStorage(OFF_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

/**
 * Renders the composer-bar button + popover. Reports the current pick
 * through onSelection({ ids, all }) whenever it changes; the parent
 * keeps it in a ref and reads it at send time.
 */
export function SkillsPicker({ version = 0, onSelection }) {
  const [skills, setSkills] = useState(null); // null = loading
  const [off, setOff] = useState(() => readOff());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const onSelectionRef = useRef(onSelection);
  useEffect(() => { onSelectionRef.current = onSelection; });

  useEffect(() => {
    let live = true;
    api("/api/skills")
      .then((r) => live && setSkills(r || []))
      .catch(() => live && setSkills([]));
    return () => { live = false; };
  }, [version]);

  useEffect(() => {
    if (!skills) return;
    const ids = skills.filter((k) => !off.has(k.id)).map((k) => k.id);
    onSelectionRef.current?.({ ids, all: ids.length === skills.length });
  }, [skills, off]);

  // A popover that survives one click outside is a popover that is
  // always in the way.
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!skills || skills.length === 0) return null; // nothing to pick from

  const selected = skills.filter((k) => !off.has(k.id));
  const label =
    selected.length === skills.length ? "All" : selected.length === 0 ? "None" : `${selected.length}/${skills.length}`;

  const toggle = (id) => {
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeStorage(OFF_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const reset = () => {
    setOff(new Set());
    writeStorage(OFF_KEY, "[]");
  };

  return (
    <div className={s.skillsWrap} ref={wrapRef}>
      <button
        type="button"
        className={s.kindBtn}
        data-on={open || selected.length !== skills.length}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Which of your teaching skills shape this generation"
        onClick={() => setOpen((v) => !v)}
      >
        <GraduationCap size={13} /> Skills · {label}
      </button>

      {open && (
        <div className={s.skillsPop} role="listbox" aria-multiselectable="true" aria-label="Teaching skills">
          <p className={s.skillsPopHead}>Generate with</p>
          {skills.map((k) => {
            const on = !off.has(k.id);
            return (
              <button
                key={k.id}
                type="button"
                role="option"
                aria-selected={on}
                className={s.skillsPopItem}
                data-on={on}
                onClick={() => toggle(k.id)}
              >
                <span className={s.skillsPopCheck} aria-hidden>
                  {on && <Check size={12} />}
                </span>
                <span className={s.skillsPopName}>{k.name || "Teaching profile"}</span>
              </button>
            );
          })}
          <div className={s.skillsPopFoot}>
            <span>Your pick is remembered as your default.</span>
            {off.size > 0 && (
              <button type="button" onClick={reset}>
                <RotateCcw size={11} /> All on
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
