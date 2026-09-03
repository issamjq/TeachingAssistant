"use client";

// =====================================================================
// The studio's composer, on the library screen it writes into
//
// Every library — Lessons, Quizzes, Homework, Presentations, Activities
// — now sits inside a class, because the sidebar puts it there. So the
// question "make me one of these, for this class" is answerable on the
// screen a teacher is already standing on, instead of being a trip to
// /studio where she re-answers what she just said by opening Quizzes
// under Physics · Grade 9.
//
// It is the SAME composer, not a copy of one: the kind row, the class
// picker, the material picker, the skills picker, the credit estimate
// and the send button are the studio's own components rendered with the
// studio's own stylesheet. Two composers that merely looked alike would
// drift apart on the first change to either.
//
// It floats at the foot of the list rather than sitting above it, which
// is where the studio keeps its own — a composer is a thing you come
// back to between reading, not a header you scroll past once. It gets
// there by portalling into the content column the shell marks with
// `data-studio-dock`, because a sticky bar has to be the LAST child of
// the column to settle at the bottom of it; mounted where the view
// happens to render it, it would reserve a hole at the top instead.
//
// What it does NOT do is generate. Pressing send parks a `create_work`
// payload — prompt, kinds, class, attachments — and opens the studio,
// which starts on arrival. Generation is a streaming pipeline with
// credits, aborts, retries and a conversation to write into; a second
// implementation of it behind a library screen is the kind of thing
// that works until the day it silently doesn't.
// =====================================================================

import React, { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FileText, Paperclip, Plus, Send, X } from "lucide-react";
import { navigate } from "@/lib/route";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { writeStorage } from "@/shared/lib/storage";
import { normGrade, normSubject } from "@/shared/lib/classMatch";
import { uploadMaterial, MaterialPicker } from "@/features/materials";
import { useCredits, CreditEstimate, chargesRead } from "./CreditMeter";
import { SkillsPicker } from "./SkillsPicker";
import { ClassPicker } from "./ClassPicker";
import { KINDS, KIND_LABEL } from "./kinds";
import s from "./Studio.module.css";
import L from "./StudioLauncher.module.css";

/** The studio remembers its own class pick under this key. */
const STUDIO_PICK_KEY = "murchid.studio.class";

// The column never moves once the shell has rendered it, so there is
// nothing to subscribe to.
const subscribeNever = () => () => {};
const readDock = () => document.querySelector("[data-studio-dock]");
const readDockOnServer = () => null;

export default function StudioLauncher({ kind, scope = null, existing = [] }) {
  /**
   * The shell's content column.
   *
   * Read through useSyncExternalStore rather than set from an effect:
   * the DOM is an external system, the snapshot is stable (querySelector
   * hands back the same node every call), and the server snapshot is
   * null — which is exactly what the hook is for, and what keeps this
   * out of the cascading-render trap an effect + setState falls into.
   */
  const dock = useSyncExternalStore(subscribeNever, readDock, readDockOnServer);
  // The screen's own kind is on, and the rest are there to be added:
  // "a lesson and the quiz that goes with it" is one request, and asking
  // for it from the Lessons shelf should not mean starting again.
  const base = kind || "lesson_plan";
  const [kinds, setKinds] = useState([base]);
  const [alsoOpen, setAlsoOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [pickedClass, setPickedClass] = useState(null);
  const classSel = useRef(null);
  const skillSel = useRef(null);
  const fileRef = useRef(null);
  const { credits } = useCredits();

  /**
   * The screen's own format is always on and is never offered as a
   * choice — /activities makes activities, and a row of five toggles
   * with Activity already lit asks a teacher to work out what the page
   * she is standing on is for.
   *
   * The other four are still reachable, because "a lesson and the quiz
   * that goes with it" is one request. They are just not shouted on
   * every screen: they appear when she asks for them.
   */
  const extras = KINDS.filter((k) => k.value !== base);
  const toggleExtra = (v) =>
    setKinds((prev) => (prev.includes(v) ? prev.filter((k) => k !== v) : [...prev, v]));

  const attach = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setNotice(null);
    try {
      for (const f of files) {
        // The same upload path as the studio and the shelf, so a file
        // attached here is filed under this class exactly as it would be
        // there — see features/materials/api.ts.
        const att = await uploadMaterial(f, { where: "studio", audience: classSel.current });
        setAttachments((a) => [...a, att]);
      }
    } catch (err) {
      setNotice(err.message);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Hand over to the studio, already set up.
   *
   * `kinds` and `attachments` travel as arrays because send() has always
   * accepted them that way (opts.kinds / opts.attachments) — this is the
   * shape the generator already speaks, not a new one. The class is
   * written into the studio's own remembered pick as well, which is the
   * only thing that survives the navigation on its side.
   */
  const send = () => {
    const prompt = draft.trim();
    if (!prompt && !attachments.length) return;
    const cls = classSel.current;
    try {
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
        action: "create_work",
        prompt,
        kinds,
        kind: kinds[0],
        attachments,
        skills: skillSel.current || undefined,
        subject: cls?.subject, grade: cls?.grade, section: cls?.section,
        autostart: true,
        at: Date.now(),
      }));
    } catch {
      /* private browsing: the studio opens empty, which is the old behaviour */
    }
    if (cls) {
      writeStorage(
        STUDIO_PICK_KEY,
        [normGrade(cls.grade) || "", (cls.section || "").trim().toLowerCase(), normSubject(cls.subject) || ""].join("§"),
      );
    }
    navigate(["studio"]);
  };

  const one = kinds.length === 1 ? KIND_LABEL[kinds[0]] : null;

  /**
   * What is already here, said before she asks for another one.
   *
   * The rows are the ones this screen is showing — already narrowed to
   * the class by the sidebar's scope — so the count is the answer to
   * "have I done this already", which is the question that stops a
   * teacher generating a second copy of Monday's quiz.
   */
  const titles = existing
    .map((it) => it?.title || it?.name)
    .filter(Boolean)
    .slice(0, 3);

  const bar = (
    <div className={L.dock}>
      <div className={`${s.composer} ${L.panel}`}>
        {existing.length > 0 && (
          <p className={L.already}>
            <span className={L.alreadyCount}>
              {existing.length} {KIND_LABEL[base].toLowerCase()}{existing.length === 1 ? "" : "s"}
            </span>
            <span className={L.alreadyList}>
              already here{titles.length ? ` — ${titles.join(", ")}` : ""}
            </span>
          </p>
        )}
        {notice && <p className="text-[12.5px] text-crit px-4 pt-3">{notice}</p>}

        {attachments.length > 0 && (
          <div className={s.attachRow}>
            {attachments.map((a) => (
              <span key={a.path} className={s.attach}>
                <FileText size={12} className="text-accent flex-shrink-0" />
                <span className="truncate flex-1">{a.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => setAttachments((x) => x.filter((y) => y.path !== a.path))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          className={s.input}
          rows={1}
          value={draft}
          placeholder={
            one
              ? `Describe the ${one.toLowerCase()} you need…`
              : `Describe it once — you'll get ${kinds.map((k) => KIND_LABEL[k].toLowerCase()).join(" + ")}…`
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 640) {
              e.preventDefault();
              send();
            }
          }}
        />

        <div className={`${s.composerBar} ${L.bar}`}>
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Attach a syllabus or chapter"
            title="Attach"
          >
            <Paperclip size={17} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,.pdf,.doc,.docx,.txt,.md,.csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,image/*"
            className="hidden"
            onChange={attach}
          />

          <div className={`${s.kindRow} ${L.kinds}`}>
            {alsoOpen || kinds.length > 1 ? (
              extras.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={s.kindBtn}
                  data-on={kinds.includes(k.value)}
                  onClick={() => toggleExtra(k.value)}
                  aria-pressed={kinds.includes(k.value)}
                  title={`Also make a ${k.label.toLowerCase()}`}
                >
                  <k.icon size={13} /> {k.label}
                </button>
              ))
            ) : (
              <button
                type="button"
                className={s.kindBtn}
                onClick={() => setAlsoOpen(true)}
                title="Ask for another format in the same request"
              >
                <Plus size={13} /> Also make
              </button>
            )}
          </div>

          <ClassPicker
            preferred={scope}
            onSelection={(cls) => { classSel.current = cls; setPickedClass(cls); }}
          />
          <MaterialPicker
            attached={attachments}
            audience={pickedClass}
            onPick={(att) =>
              setAttachments((a) => (a.some((x) => x.id === att.id) ? a : [...a, att]))
            }
          />
          <SkillsPicker onSelection={(sel) => { skillSel.current = sel; }} />

          <span className="flex-1" />

          <CreditEstimate
            credits={credits}
            kinds={kinds}
            hasMaterials={attachments.some(chargesRead)}
          />

          <button
            type="button"
            className={s.send}
            disabled={!draft.trim() && !attachments.length}
            onClick={send}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted text-center mt-2 max-w-[760px] mx-auto truncate">
        {pickedClass
          ? "Murchid drafts; you decide. Check anything before it reaches a class."
          : "Pick a class and the grade decides the reading level. Murchid drafts; you decide."}
      </p>
    </div>
  );

  // Before the column is found — the server pass, and the first client
  // render — it renders in place. A composer that appears a tick late is
  // worse than one that moves a tick late.
  return dock ? createPortal(bar, dock) : bar;
}
