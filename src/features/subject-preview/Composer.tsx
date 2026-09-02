"use client";

// =====================================================================
// The studio composer — and the only place a destination is chosen
//
// The proposal. Today a teacher opening the studio faces an empty box
// and two separate pickers: which class this is for, and which kind of
// thing to make. Both are asked before anything is known, on a screen
// that has no idea where she came from — so she answers them every time,
// and the values that decide student delivery (db/tune.sql §48) are set
// by whoever remembers to set them.
//
// Here the destination is a CONSEQUENCE of where she already is. Open
// the composer from Physics → Quizzes and it is already making a quiz
// for Physics, Grade 9. The controls stay visible so she can correct
// them — never hidden, because a wrong audience reaches nobody — but
// nothing has to be filled in to start typing.
//
// The composer runs in two shapes from one implementation: docked at
// the corner behind the launcher, so the studio is reachable from every
// screen without leaving it, and full width on the goal planner.
//
// Sending is a real hand-off, not a mock. It parks a `create_work`
// payload the shipped StudioChat already consumes, and — this is the
// part the preview is arguing for — carries the class with it, so the
// studio opens on the right one rather than on whatever it remembered.
// =====================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, Plus, Sparkles, X } from "lucide-react";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { classLabel, normGrade, normSubject } from "@/shared/lib/classMatch";
import { KINDS, KIND_BY_KEY, type KindKey, type RosterClass, type SubjectGroup } from "./types";
import { KIND_ICON } from "./Shell";
import c from "./Composer.module.css";

/** Where a generation is headed. `section` empty means the whole grade. */
export type Destination = {
  subject: string;
  grade: string;
  section: string;
  /** True when no class in the library or on the roster matches yet. */
  isNew: boolean;
};

const LAST_KEY = "murchid.preview.destination";
/** The studio's own remembered class, so the hand-off lands on it. */
const STUDIO_PICK_KEY = "murchid.studio.class";

const read = (k: string) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* private browsing */ }
};

export type ComposerProps = {
  /** Every class the teacher has, for the picker. */
  classes: SubjectGroup[];
  /** Distinct roster classes, which is where sections come from. */
  rosterClasses: RosterClass[];
  /** The class the current screen is about, if any. */
  contextClass?: SubjectGroup | null;
  /** The kind the current screen is about, if any. */
  contextKind?: KindKey | null;
  /** Suggested openings, drawn from real units. */
  starters?: string[];
  variant?: "dock" | "page";
  onClose?: () => void;
};

export default function Composer({
  classes, rosterClasses, contextClass = null, contextKind = null,
  starters = [], variant = "dock", onClose,
}: ComposerProps) {
  const [kind, setKind] = useState<KindKey>(contextKind ?? "lesson_plan");
  const [dest, setDest] = useState<Destination>(() => initialDest(contextClass, classes));
  const [prompt, setPrompt] = useState("");
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) { setMenu(false); setAdding(false); }
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [menu]);

  /** Sections known for the chosen class — blank means every one of them. */
  const sections = useMemo(() => {
    const s = new Set<string>();
    for (const r of rosterClasses) {
      if (normSubject(r.subject) === normSubject(dest.subject)
        && normGrade(r.grade) === normGrade(dest.grade)
        && r.section.trim()) s.add(r.section.trim());
    }
    for (const cls of classes) {
      if (normSubject(cls.name) === normSubject(dest.subject)
        && normGrade(cls.grade) === normGrade(dest.grade)) {
        for (const x of cls.sections) if (x.trim()) s.add(x.trim());
      }
    }
    return [...s].sort();
  }, [rosterClasses, classes, dest.subject, dest.grade]);

  /** The picker's list, grouped by grade the way the sidebar is. */
  const byGrade = useMemo(() => {
    const by = new Map<string, { label: string; items: SubjectGroup[] }>();
    for (const cls of classes) {
      const k = cls.gradeKey;
      if (!by.has(k)) by.set(k, { label: cls.grade ? classLine(cls.grade) : "No grade set", items: [] });
      by.get(k)!.items.push(cls);
    }
    return [...by.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([, v]) => v);
  }, [classes]);

  const def = KIND_BY_KEY[kind];
  const where = classLabel({ grade: dest.grade, subject: dest.subject, section: dest.section });
  const ready = prompt.trim().length > 0 && !!dest.subject.trim();

  function choose(cls: SubjectGroup) {
    setDest({
      subject: cls.name,
      grade: cls.grade ?? "",
      section: cls.sections.length === 1 ? cls.sections[0] : "",
      isNew: false,
    });
    setMenu(false);
    setAdding(false);
  }

  function confirmNew() {
    const s = newSubject.trim();
    if (!s) return;
    const g = newGrade.trim();
    const exists = classes.some(
      (x) => normSubject(x.name) === normSubject(s) && normGrade(x.grade) === normGrade(g),
    );
    setDest({ subject: s, grade: g, section: "", isNew: !exists });
    setNewSubject("");
    setNewGrade("");
    setAdding(false);
    setMenu(false);
  }

  /**
   * Hand over to the shipped studio.
   *
   * `create_work` is the action StudioChat already listens for, and
   * `autostart` is set because the teacher wrote the sentence and
   * pressed send here — asking her to press send again on arrival would
   * be asking her to confirm her own words. The class travels in the
   * payload AND in the studio's own remembered-pick key, which is the
   * only way it survives the navigation today.
   */
  function send() {
    if (!ready) return;
    const audience = { subject: dest.subject, grade: dest.grade, section: dest.section };
    try {
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
        action: "create_work",
        prompt: prompt.trim(),
        kind,
        ...audience,
        autostart: true,
        at: Date.now(),
      }));
    } catch { /* private browsing: the studio opens empty, as it always did */ }
    write(LAST_KEY, JSON.stringify(audience));
    // The studio keys its remembered class on the roster row's exact
    // values, so only write it when this destination IS one of those.
    const match = rosterClasses.find(
      (r) => normSubject(r.subject) === normSubject(dest.subject)
        && normGrade(r.grade) === normGrade(dest.grade)
        && (!dest.section || r.section.trim().toLowerCase() === dest.section.trim().toLowerCase()),
    );
    if (match) {
      write(STUDIO_PICK_KEY, [
        normGrade(match.grade) ?? "",
        match.section.trim().toLowerCase(),
        normSubject(match.subject) ?? "",
      ].join("§"));
    }
    window.location.href = "/studio";
  }

  return (
    <div className={variant === "dock" ? c.dock : `${c.dock} ${c.page}`} role="dialog" aria-label="Studio composer">
      <div className={c.head}>
        <div className={c.headText}>
          <h2 className={c.headTitle}>
            {variant === "page" ? "Tell the studio what you need" : "Studio"}
          </h2>
          <p className={c.headNote}>
            {variant === "page"
              ? "In your own words. The class and the kind are already set from where you are — change them here if this one is for somewhere else."
              : "The class and kind come from the screen you are on."}
          </p>
        </div>
        {onClose && (
          <button type="button" className={c.close} onClick={onClose} aria-label="Close the studio">
            <X size={16} />
          </button>
        )}
      </div>

      <div className={c.body}>
        <div>
          <span className={c.label}>Making</span>
          <div className={c.kinds}>
            {KINDS.map((k) => {
              const Icon = KIND_ICON[k.key];
              return (
                <button
                  key={k.key}
                  type="button"
                  className={c.kind}
                  data-on={kind === k.key}
                  onClick={() => setKind(k.key)}
                >
                  <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={wrap}>
          <span className={c.label}>For</span>
          <div className={c.pickWrap}>
            <button
              type="button"
              className={c.pick}
              aria-expanded={menu}
              onClick={() => { setMenu(!menu); setAdding(false); }}
            >
              <span className={c.pickText}>{where || "Pick a class"}</span>
              {dest.isNew && <span className={c.pickNew}>new</span>}
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {menu && (
              <div className={c.menu}>
                {byGrade.map((g) => (
                  <div key={g.label}>
                    <p className={c.menuHead}>{g.label}</p>
                    {g.items.map((cls) => {
                      const on = normSubject(cls.name) === normSubject(dest.subject)
                        && normGrade(cls.grade) === normGrade(dest.grade);
                      return (
                        <button
                          key={cls.key}
                          type="button"
                          className={c.menuItem}
                          data-on={on}
                          onClick={() => choose(cls)}
                        >
                          <span className={c.menuName}>{cls.name}</span>
                          {cls.students > 0 && <span className={c.menuMeta}>{cls.students}</span>}
                          {on && <Check size={13} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                ))}

                <div className={c.menuRule} />
                {adding ? (
                  <div className={c.newRow}>
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmNew()}
                      placeholder="Subject"
                      aria-label="Subject"
                      autoFocus
                    />
                    <input
                      value={newGrade}
                      onChange={(e) => setNewGrade(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmNew()}
                      placeholder="Grade"
                      aria-label="Grade"
                    />
                    <button type="button" className={c.send} onClick={confirmNew} disabled={!newSubject.trim()}>
                      Use
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${c.menuItem} ${c.menuAdd}`}
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span className={c.menuName}>A class I have not added yet</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {sections.length > 0 && (
            <div className={c.sections} style={{ marginTop: 8 }}>
              <button
                type="button"
                className={c.kind}
                data-on={!dest.section}
                onClick={() => setDest({ ...dest, section: "" })}
              >
                Every section
              </button>
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={c.kind}
                  data-on={dest.section === sec}
                  onClick={() => setDest({ ...dest, section: sec })}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className={c.label}>What you need</span>
          <div className={c.field}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
              }}
              placeholder={`A 45-minute ${def.one} on…`}
              aria-label={`Describe the ${def.one} you want`}
            />
          </div>
        </div>

        {starters.length > 0 && !prompt && (
          <div>
            <span className={c.label}>Or start with</span>
            <div className={c.starters}>
              {starters.slice(0, 3).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={c.starter}
                  onClick={() => setPrompt(`A ${def.one} on ${st}.`)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={c.foot}>
        <p className={c.footText}>
          {dest.subject ? (
            <>
              Files into <b>{dest.subject}</b> › <b>{def.label}</b>
              {dest.isNew && (
                <span className={c.footNew}>
                  {" "}— {classLabel({ grade: dest.grade, subject: dest.subject })} does not exist yet and is created on save.
                </span>
              )}
            </>
          ) : (
            "Pick a class and it will be filed there."
          )}
        </p>
        <button type="button" className={c.send} onClick={send} disabled={!ready}>
          <Sparkles size={14} aria-hidden="true" />
          Create
          <ArrowUp size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** "Grade 9" from "9" — the scheduler stores the bare number. */
function classLine(grade: string) {
  const g = grade.trim();
  return /^\d+$/.test(g) ? `Grade ${g}` : g;
}

/**
 * Where the composer opens.
 *
 * The screen underneath first, then the last class used, then the
 * busiest class. Anything is better than an empty picker on a teacher
 * who has one class and will never pick a different one.
 */
function initialDest(context: SubjectGroup | null, classes: SubjectGroup[]): Destination {
  if (context) {
    return {
      subject: context.name,
      grade: context.grade ?? "",
      section: context.sections.length === 1 ? context.sections[0] : "",
      isNew: false,
    };
  }
  const raw = read(LAST_KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d?.subject) {
        return { subject: d.subject, grade: d.grade ?? "", section: d.section ?? "", isNew: false };
      }
    } catch { /* a corrupt entry is the same as no entry */ }
  }
  const first = classes[0];
  return first
    ? { subject: first.name, grade: first.grade ?? "", section: "", isNew: false }
    : { subject: "", grade: "", section: "", isNew: false };
}
