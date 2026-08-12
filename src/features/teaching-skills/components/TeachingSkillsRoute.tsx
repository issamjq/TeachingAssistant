"use client";

// =====================================================================
// Teaching skills — the interview that teaches the AI how you teach
//
// A ten-question conversation, answered by typing or by voice, that
// compiles into a Markdown profile stored in teaching_skills. The AI
// service reads those rows while generating, so this screen is where a
// teacher makes every future lesson plan, quiz and deck THEIRS.
//
// Deliberately no model in the loop: the questions are scripted and the
// profile is a template over the teacher's own words. That keeps it
// browser→Supabase (frontend-first), working offline, and — more
// importantly — keeps the profile honest. Nothing is in it that the
// teacher did not say.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GraduationCap,
  Mic,
  Volume2,
  VolumeX,
  ArrowUp,
  SkipForward,
  Download,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { useVoice } from "@/shared/hooks/useVoice";
import { useAccount } from "@/lib/account";
import { renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/views/_shared";
import { QUESTIONS, compileProfile, answeredCount } from "../interview";
import type { SkillRow, SkillAssignment } from "../api";
import {
  listSkills, createSkill, updateSkill, deleteSkill,
  listAssignments, createAssignment, deleteAssignment,
} from "../api";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { InterviewOutline } from "./InterviewOutline";
import s from "./TeachingSkills.module.css";

const DRAFT_KEY = "murchid.skills.interview";

type Mode = "home" | "interview" | "review";

// One focused question at a time — no fake chat transcript. `maxStep` is
// the frontier: dots up to it are revisitable, so an earlier answer can
// be edited without losing your place.
interface InterviewState {
  step: number;
  maxStep: number;
  answers: Record<string, string>;
}

const WELCOME =
  "Ten short questions, no wrong answers, skip anything. Your answers become a profile the AI " +
  "studio reads every time it generates for you — so the more this sounds like you, the more " +
  "your materials will too. Type, talk, or tap a suggestion and make it yours.";

const readDraft = (): InterviewState | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.step !== "number" || typeof p?.answers !== "object" || !p.answers) return null;
    return p;
  } catch {
    return null;
  }
};

export function TeachingSkillsRoute() {
  const { dir } = useI18n();
  const account = useAccount();
  const [rows, setRows] = useState<SkillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("home");
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  const [reviewText, setReviewText] = useState("");
  const [skillName, setSkillName] = useState("How I teach");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const [editMd, setEditMd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<SkillAssignment[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<SkillRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lang = dir === "rtl" ? "ar" : "en";
  const voice = useVoice({
    lang,
    onFinal: (text: string) => setDraft((d) => (d ? `${d} ${text}` : text)),
  });
  // say() reads speechOn from a closure; keep the latest in a ref so the
  // step-change effect below doesn't have to re-run when it toggles.
  const sayRef = useRef(voice.say);
  useEffect(() => { sayRef.current = voice.say; });

  useEffect(() => {
    let live = true;
    listSkills()
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(e.message))
      // A half-done interview survives a refresh. Read AFTER mount — never
      // during the render React hydrates against.
      .finally(() => live && setHasDraft(!!readDraft()));
    listAssignments()
      .then((r) => live && setAssignments(r))
      .catch(() => {}); // combos are decoration on this screen; the profiles still work
    return () => {
      live = false;
    };
  }, []);

  const persist = (state: InterviewState) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      /* private mode; the interview still works, it just won't survive a refresh */
    }
  };
  const clearDraftState = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing parked */
    }
    setHasDraft(false);
  };

  const start = () => {
    const saved = readDraft();
    if (saved && saved.step < QUESTIONS.length) {
      const frontier = Math.min(Math.max(saved.maxStep ?? saved.step, saved.step), QUESTIONS.length);
      setStep(saved.step);
      setMaxStep(frontier);
      setAnswers(saved.answers || {});
      setDraft((saved.answers || {})[QUESTIONS[saved.step].id] || "");
    } else {
      setStep(0);
      setMaxStep(0);
      setAnswers({});
      setDraft("");
    }
    setMode("interview");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /** Jump back to an already-visited question; its answer loads into the composer. */
  const go = (i: number) => {
    if (i > maxStep || i >= QUESTIONS.length) return;
    setStep(i);
    setDraft(answers[QUESTIONS[i].id] || "");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // The answers go to the service to be shaped into a real profile —
  // methods named, patterns drawn out, written as one coherent document.
  // The deterministic local compile stays as the fallback, so the
  // interview finishes into an editable draft whether or not the API is
  // reachable. Either way the teacher reads, edits, and approves before
  // anything is saved.
  const finish = async (finalAnswers: Record<string, string>) => {
    const teacherName = [account?.profile?.firstName, account?.profile?.lastName]
      .filter(Boolean)
      .join(" ");
    setMode("review");
    setReviewLoading(true);
    setEditMd(false);
    setRefineNote(null);
    setReviewText("");
    try {
      const { streamSSE } = await import("@/shared/lib/apiStream");
      let acc = "";
      let done: any = null;
      await streamSSE("/api/studio/skill-profile", {
        body: {
          teacher_name: teacherName || undefined,
          answers: QUESTIONS.filter((q) => finalAnswers[q.id]?.trim()).map((q) => ({
            id: q.id,
            heading: q.heading,
            question: q.ask,
            answer: finalAnswers[q.id].trim(),
          })),
        },
        onEvent: (ev) => {
          if (ev.type === "delta" && typeof ev.text === "string") {
            acc += ev.text;
            setReviewText(acc); // the profile writes itself on screen
          } else if (ev.type === "done") {
            done = ev;
          }
        },
      });
      const profile = String(done?.skill_profile || acc).trim();
      if (!profile) throw new Error("empty_profile");
      setReviewText(profile);
      setSkillName(String(done?.name || "").trim() || "How I teach");
    } catch (e: any) {
      setReviewText(compileProfile(teacherName, finalAnswers));
      setSkillName("How I teach");
      setRefineNote(
        e?.code === "no_backend"
          ? "AI refinement isn't connected yet, so this draft is your answers compiled as-is — edit it freely below."
          : "AI refinement didn't answer, so this draft is your answers compiled as-is — edit it freely below.",
      );
    } finally {
      setReviewLoading(false);
    }
  };

  // Answer (or skip) the current question, then move on. From the
  // frontier that means the next question; from a revisited earlier one
  // it means back to the frontier — and past the last question it means
  // the review. A skip on a revisit leaves the old answer standing.
  const advance = (answerText: string | null) => {
    const q = QUESTIONS[step];
    const nextAnswers = answerText ? { ...answers, [q.id]: answerText } : answers;
    const target = step < maxStep ? maxStep : step + 1;
    const frontier = Math.max(maxStep, target);

    setAnswers(nextAnswers);
    setMaxStep(frontier);
    voice.stop();
    persist({ step: Math.min(target, QUESTIONS.length - 1), maxStep: frontier, answers: nextAnswers });
    setHasDraft(true);

    if (target >= QUESTIONS.length) {
      finish(nextAnswers);
      return;
    }
    setStep(target);
    setDraft(nextAnswers[QUESTIONS[target].id] || "");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = () => {
    const text = draft.trim();
    if (!text || step >= QUESTIONS.length) return;
    advance(text);
  };

  // Read each question aloud — only when the teacher turned the voice on.
  useEffect(() => {
    if (mode !== "interview" || step >= QUESTIONS.length) return;
    sayRef.current(QUESTIONS[step].ask);
  }, [mode, step]);

  const saveProfile = async () => {
    if (!reviewText.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const row = await createSkill({
        name: skillName.trim() || "How I teach",
        source_type: "interview",
        skill_profile: reviewText,
      });
      setRows((r) => [row, ...(r || [])]);
      clearDraftState();
      setMode("home");
      setStep(0);
      setMaxStep(0);
      setAnswers({});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const row = await updateSkill(editingId, { skill_profile: editText });
      setRows((r) => (r || []).map((x) => (x.id === row.id ? row : x)));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await deleteSkill(deleting.id);
      setRows((r) => (r || []).filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyDelete(false);
    }
  };

  const download = (row: SkillRow) => {
    const blob = new Blob([row.skill_profile || ""], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(row.name || "teaching-profile").replace(/[^\w؀-ۿ-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 640) {
        e.preventDefault();
        send();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, step, maxStep, answers],
  );

  /* ── interview mode ─────────────────────────────────────────────── */
  if (mode === "interview" || mode === "review") {
    const progress = Math.min(step, QUESTIONS.length);
    return (
      <div className={s.shell}>
        <header className={s.interviewHead}>
          <div>
            <p className={s.eyebrow}>Teaching skills · Interview</p>
            <h1 className="font-serif text-[22px] leading-tight mt-1">
              {mode === "review" ? (
                <>Your profile, <em className="italic text-accent">in your words</em></>
              ) : (
                <>Question {progress + 1} <span className="text-muted">of {QUESTIONS.length}</span></>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {voice.canSpeak && mode === "interview" && (
              <button
                type="button"
                className={s.iconBtn}
                data-on={voice.speechOn}
                aria-pressed={voice.speechOn}
                title={voice.speechOn ? "Stop reading questions aloud" : "Read questions aloud"}
                onClick={() => {
                  const on = !voice.speechOn;
                  voice.setSpeechOn(on);
                  if (!on) voice.hush();
                }}
              >
                {voice.speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            )}
            <Button variant="secondary" onClick={() => { voice.stop(); voice.hush(); setMode("home"); }}>
              {mode === "review" ? "Back later" : "Pause — finish later"}
            </Button>
          </div>
        </header>

        {mode === "interview" ? (
          <>
            {/* One dot per question: filled = answered, hollow = seen,
                faint = still ahead. Every visited dot is a way back —
                tap it, edit the answer, and you return to where you were. */}
            <div className={s.stepDots} aria-label="Interview progress">
              {QUESTIONS.map((qq, i) => {
                const state =
                  i === step ? "current" : answers[qq.id]?.trim() ? "answered" : i < maxStep ? "seen" : "todo";
                return (
                  <button
                    key={qq.id}
                    type="button"
                    className={s.stepDot}
                    data-state={state}
                    disabled={i > maxStep}
                    title={`${i + 1} · ${qq.heading}`}
                    aria-label={`Question ${i + 1}: ${qq.heading}${state === "answered" ? " (answered — tap to edit)" : ""}`}
                    onClick={() => go(i)}
                  />
                );
              })}
            </div>

            <div className={s.stageRow}>
            <div className={s.stage} key={step}>
              <div className={s.stageInner}>
              {step === 0 && maxStep === 0 && <p className={s.stageIntro}>{WELCOME}</p>}
              <p className={s.eyebrow}>{QUESTIONS[step].heading}</p>
              <h2 className={s.stageQuestion}>{QUESTIONS[step].ask}</h2>

              {QUESTIONS[step].options.length > 0 && (
                <div className={s.quickPicks}>
                  {QUESTIONS[step].options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={s.quickPick}
                      onClick={() => {
                        // A starting point, not an answer: it lands in the
                        // composer where it can be edited before sending.
                        setDraft((d) => (d.trim() ? `${d.trim()}; ${opt}` : opt));
                        inputRef.current?.focus();
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              <div className={s.composer}>
                <textarea
                  ref={inputRef}
                  className={s.input}
                  rows={3}
                  value={voice.listening && voice.interim ? `${draft} ${voice.interim}` : draft}
                  placeholder={voice.listening ? "Listening…" : QUESTIONS[step].hint}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                <div className={s.composerBar}>
                  {voice.canListen && (
                    <button
                      type="button"
                      className={s.iconBtn}
                      data-on={voice.listening}
                      aria-pressed={voice.listening}
                      title={voice.listening ? "Stop listening" : "Answer by voice"}
                      onClick={() => (voice.listening ? voice.stop() : voice.listen())}
                    >
                      <Mic size={16} />
                    </button>
                  )}
                  <span className="flex-1" />
                  <button type="button" className={s.skipBtn} onClick={() => advance(null)}>
                    <SkipForward size={13} /> {step < maxStep ? "Keep as is" : "Skip"}
                  </button>
                  <button
                    type="button"
                    className={s.send}
                    disabled={!draft.trim()}
                    aria-label="Send answer"
                    onClick={send}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
              </div>
            </div>

            <InterviewOutline answers={answers} step={step} maxStep={maxStep} onGo={go} />
            </div>
          </>
        ) : (
          <div className={s.review}>
            <p className="text-sm text-ink-soft max-w-2xl">
              {reviewLoading
                ? `Shaping your ${answeredCount(answers)} answers into a teaching profile…`
                : refineNote ||
                  "Shaped from your answers. Read it over, rename it, edit anything — the AI studio reads it on every generation."}
            </p>

            {!reviewLoading && (
              <input
                className={s.nameInput}
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                aria-label="Name this skill profile"
                placeholder="Name this profile — e.g. Inquiry-led physics"
              />
            )}

            {editMd && !reviewLoading ? (
              <textarea
                className={s.reviewInput}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={18}
                aria-label="Your teaching profile, editable Markdown"
              />
            ) : (
              <div className={`${s.glass} p-5 md:p-6`}>
                {reviewLoading && !reviewText && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <span className={s.thinkDot} /><span className={s.thinkDot} /><span className={s.thinkDot} />
                    Writing…
                  </div>
                )}
                <div className={s.profileBody} data-review>
                  {renderMarkdown(reviewText || "")}
                </div>
              </div>
            )}

            {error && <p className="text-[13px] text-crit">{error}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={saveProfile} disabled={saving || reviewLoading || !reviewText.trim()}>
                {saving ? "Saving…" : "Save my profile"}
              </Button>
              {!reviewLoading && (
                <Button variant="secondary" onClick={() => setEditMd((v) => !v)}>
                  {editMd ? "Preview" : "Edit the text"}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={reviewLoading}
                onClick={() => {
                  // Re-enter at the last question; every dot stays open.
                  go(Math.min(step, QUESTIONS.length - 1));
                  setMode("interview");
                }}
              >
                Back to the interview
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── home ───────────────────────────────────────────────────────── */
  const hasProfiles = (rows?.length ?? 0) > 0;
  return (
    <div className="space-y-4 max-w-5xl">
      <section className={`${s.loud} p-6 md:p-7`}>
        <p className={s.loudEyebrow}>Teaching skills</p>
        <h1 className="font-serif text-[26px] md:text-[32px] leading-[1.1] font-medium mt-2 max-w-2xl">
          Teach Murchid <em className="italic">how you teach.</em>
        </h1>
        <p className={`${s.loudSub} text-sm mt-2.5 max-w-2xl leading-relaxed`}>
          A ten-question conversation — type or just talk — becomes a profile of your practice:
          your subjects, how your lessons run, how you assess, what your classroom feels like.
          Every lesson plan, quiz and deck the studio generates is then built around it, so two
          teachers asking for the same topic get two different lessons — each one theirs.
        </p>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button variant="onAccent" onClick={start}>
            {hasDraft ? "Resume the interview" : hasProfiles ? "Retake the interview" : "Start the interview"}
          </Button>
          {voice.canListen && (
            <span className={s.loudHint}>
              <Mic size={13} /> Voice answers work here
            </span>
          )}
        </div>
      </section>

      {error && <p className="text-[13px] text-crit">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-muted">Loading your profiles…</p>
      ) : hasProfiles ? (
        rows.map((row) => (
          <section key={row.id} className={`${s.glass} p-5 md:p-6`}>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <p className={s.eyebrow}>
                  {row.source_type === "interview" ? "From the interview" : row.source_type === "cv" ? "From your CV" : "Uploaded"}
                  {" · "}
                  {new Date(row.updated_at).toLocaleDateString()}
                </p>
                <h2 className="font-serif text-[19px] mt-1">{row.name || "Teaching profile"}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" className={s.iconBtn} title="Download as Markdown" onClick={() => download(row)}>
                  <Download size={15} />
                </button>
                <button
                  type="button"
                  className={s.iconBtn}
                  title="Edit"
                  onClick={() => {
                    setEditingId(row.id);
                    setEditText(row.skill_profile || "");
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button type="button" className={s.iconBtn} title="Delete" onClick={() => setDeleting(row)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {editingId === row.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className={s.reviewInput}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={14}
                  aria-label="Edit profile Markdown"
                />
                <div className="flex items-center gap-2">
                  <Button onClick={saveEdit}>Save changes</Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className={s.profileBody}>{renderMarkdown(row.skill_profile || "")}</div>
            )}

            <AssignmentsPanel
              assignments={assignments.filter((a) => a.skill_id === row.id)}
              others={assignments.filter((a) => a.skill_id !== row.id)}
              onAdd={async (combo) => {
                const created = await createAssignment({ skill_id: row.id, ...combo });
                setAssignments((x) => [...x, created]);
              }}
              onRemove={async (id) => {
                await deleteAssignment(id);
                setAssignments((x) => x.filter((a) => a.id !== id));
              }}
            />
          </section>
        ))
      ) : (
        <section className={`${s.glass} p-6 text-center`}>
          <GraduationCap size={22} className="mx-auto text-muted" aria-hidden />
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
            No profile yet. Until there is one, the studio generates well — but generically.
            Ten questions from now, it generates like <em className="italic">you</em>.
          </p>
        </section>
      )}

      {hasProfiles && (
        <p className="text-[12.5px] text-muted flex items-center gap-1.5">
          <RotateCcw size={13} aria-hidden />
          Practice changes — retake the interview any time; older profiles stay until you delete them.
        </p>
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
        title="Delete this profile?"
        message={`"${deleting?.name || "Teaching profile"}" will stop shaping your generated material. This cannot be undone.`}
      />
    </div>
  );
}

export default TeachingSkillsRoute;
