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
import type { SkillRow } from "../api";
import { listSkills, createSkill, updateSkill, deleteSkill } from "../api";
import s from "./TeachingSkills.module.css";

const DRAFT_KEY = "murchid.skills.interview";

type Turn = { role: "bot" | "user"; text: string; skipped?: boolean };
type Mode = "home" | "interview" | "review";

interface InterviewState {
  step: number;
  answers: Record<string, string>;
  turns: Turn[];
}

const WELCOME =
  "I'm going to ask you ten short questions about how you teach — there are no wrong answers, " +
  "and you can skip any of them. Your answers become a profile the AI studio reads every time " +
  "it generates for you, so the more this sounds like you, the more your materials will too. " +
  "Type your answers, or tap the microphone and just talk.";

const readDraft = (): InterviewState | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.step !== "number" || !Array.isArray(p?.turns)) return null;
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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  const [reviewText, setReviewText] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<SkillRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
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

  const scrollThread = () => {
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const start = () => {
    const saved = readDraft();
    if (saved && saved.step < QUESTIONS.length) {
      setTurns(saved.turns);
      setStep(saved.step);
      setAnswers(saved.answers || {});
    } else {
      setTurns([
        { role: "bot", text: WELCOME },
        { role: "bot", text: QUESTIONS[0].ask },
      ]);
      setStep(0);
      setAnswers({});
    }
    setMode("interview");
    scrollThread();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const finish = (finalAnswers: Record<string, string>) => {
    const name = [account?.profile?.firstName, account?.profile?.lastName]
      .filter(Boolean)
      .join(" ");
    setReviewText(compileProfile(name, finalAnswers));
    setMode("review");
  };

  const advance = (answerText: string | null) => {
    const q = QUESTIONS[step];
    const nextAnswers = answerText ? { ...answers, [q.id]: answerText } : answers;
    const userTurn: Turn = answerText
      ? { role: "user", text: answerText }
      : { role: "user", text: "Skipped", skipped: true };
    const next = step + 1;
    const nextTurns: Turn[] =
      next < QUESTIONS.length
        ? [...turns, userTurn, { role: "bot", text: QUESTIONS[next].ask }]
        : [
            ...turns,
            userTurn,
            { role: "bot", text: "That's all ten. Here is your profile — read it over, edit anything, and save it when it sounds like you." },
          ];

    setAnswers(nextAnswers);
    setTurns(nextTurns);
    setStep(next);
    setDraft("");
    voice.stop();
    persist({ step: next, answers: nextAnswers, turns: nextTurns });
    setHasDraft(true);
    scrollThread();

    if (next >= QUESTIONS.length) finish(nextAnswers);
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
        name: "How I teach — interview",
        source_type: "interview",
        skill_profile: reviewText,
      });
      setRows((r) => [row, ...(r || [])]);
      clearDraftState();
      setMode("home");
      setTurns([]);
      setStep(0);
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
    [draft, step, turns, answers],
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

        {mode === "interview" && (
          <div className={s.progressRail} aria-hidden>
            <div className={s.progressFill} style={{ transform: `scaleX(${progress / QUESTIONS.length})` }} />
          </div>
        )}

        {mode === "interview" ? (
          <>
            <div ref={threadRef} className={s.thread}>
              <div className={s.threadInner}>
                {turns.map((turn, i) => (
                  <div key={i} className={s.turn} data-role={turn.role}>
                    {turn.role === "bot" && (
                      <span className={s.avatar} aria-hidden>
                        <GraduationCap size={15} />
                      </span>
                    )}
                    {turn.role === "bot" ? (
                      <p className={s.botText}>{turn.text}</p>
                    ) : (
                      <p className={s.userBubble} data-skipped={turn.skipped || undefined}>
                        {turn.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className={s.composerWrap}>
              <div className={s.composer}>
                <textarea
                  ref={inputRef}
                  className={s.input}
                  rows={2}
                  value={voice.listening && voice.interim ? `${draft} ${voice.interim}` : draft}
                  placeholder={voice.listening ? "Listening…" : QUESTIONS[Math.min(step, QUESTIONS.length - 1)].hint}
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
                    <SkipForward size={13} /> Skip
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
          </>
        ) : (
          <div className={s.review}>
            <p className="text-sm text-ink-soft max-w-2xl">
              {answeredCount(answers) < QUESTIONS.length
                ? `Compiled from the ${answeredCount(answers)} questions you answered — skipped ones are simply left out. `
                : "Compiled from all ten answers. "}
              This is a plain Markdown document: edit it freely before saving. The AI studio reads
              it on every generation.
            </p>
            <textarea
              className={s.reviewInput}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={18}
              aria-label="Your teaching profile, editable Markdown"
            />
            {error && <p className="text-[13px] text-crit">{error}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={saveProfile} disabled={saving || !reviewText.trim()}>
                {saving ? "Saving…" : "Save my profile"}
              </Button>
              <Button variant="secondary" onClick={() => setMode("interview")}>
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
