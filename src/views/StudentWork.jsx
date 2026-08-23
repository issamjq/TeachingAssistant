"use client";

// =====================================================================
// One piece of work, opened by the student
//
// Four things arrive here and only three of them ask anything back:
//
//   lesson    read it — and only the notes written for them. The plan
//             and the teaching guide are the teacher's preparation and
//             never leave the database (db/tune.sql §49).
//   slides    read it.
//   quiz      answer it, submit once, see the score.
//   homework  hand in files.
//   activity  hand in files, including video.
//
// A student sees their own submission and their own score. There is no
// prop, route or query on this page that could show them a classmate's:
// every read is scoped by current_student_ids() inside the database.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen, ClipboardList, PencilLine, Sparkles, Presentation as PresentIcon,
  Clock, CheckCircle2, Upload, X, FileText, ArrowLeft, ArrowRight,
} from "lucide-react";
import { api } from "./_shared";
import { Button } from "@/components/ui/button";
import BrandLoader from "../components/BrandLoader";
import { renderMarkdown } from "@/lib/markdown";
import { supabase } from "@/lib/supabaseClient";
import { navigate } from "@/lib/route";
import { SlideFullscreen } from "@/features/studio-ai/artifacts";

const KIND = {
  lesson_plan:  { label: "Lesson",   icon: BookOpen },
  presentation: { label: "Slides",   icon: PresentIcon },
  quiz:         { label: "Quiz",     icon: ClipboardList },
  homework:     { label: "Homework", icon: PencilLine },
  activity:     { label: "Activity", icon: Sparkles },
};

const ACCEPT = {
  homework: "image/*,application/pdf,.doc,.docx,.txt",
  activity: "image/*,video/*,application/pdf,.doc,.docx,.txt",
};

const MAX_BYTES = 50 * 1024 * 1024;

export default function StudentWork({ entryId }) {
  const [w, setW] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/student/work/${entryId}`)
      .then(setW)
      .catch((e) => setError(e.message));
  }, [entryId]);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!w) return <BrandLoader />;

  const kind = KIND[w.type] || { label: w.type, icon: BookOpen };
  const Icon = kind.icon;

  return (
    <div className="max-w-3xl space-y-6">
      <button
        onClick={() =>
          // Back to the subject this belongs to, not browser history —
          // a student who arrived here from the dashboard should still
          // land somewhere that makes sense.
          navigate(w?.student_row_id ? ["student-class", w.student_row_id] : ["student-dashboard"])
        }
        className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink inline-flex items-center gap-1.5 transition"
      >
        <ArrowLeft size={12} /> Back to class
      </button>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" />
          <Icon size={12} /> {kind.label}
          {w.subject ? ` · ${w.subject}` : ""}
        </p>
        <h2 className="font-serif text-3xl font-medium text-ink">{w.title}</h2>
        {w.date && (
          <p className="text-muted mt-2 inline-flex items-center gap-1.5 text-sm">
            <Clock size={12} />
            {new Date(w.date).toLocaleDateString(undefined, {
              weekday: "long", day: "numeric", month: "long",
            })}
            {w.start_time ? ` · ${String(w.start_time).slice(0, 5)}` : ""}
          </p>
        )}
        {w.notes && <p className="text-sm text-ink-soft mt-3">{w.notes}</p>}
      </div>

      {w.type === "quiz" ? (
        <Quiz w={w} onDone={setW} />
      ) : w.type === "presentation" ? (
        <Deck content={w.content} />
      ) : w.type === "homework" || w.type === "activity" ? (
        <>
          <Reading content={w.content} />
          <HandIn w={w} onDone={setW} />
        </>
      ) : (
        <Reading content={w.content} />
      )}
    </div>
  );
}

/**
 * The deck, as the teacher designed it.
 *
 * Rendered by the studio's own presenter rather than flattened to
 * bullets — the layout, the palette and the typography ARE the lesson
 * for a slide deck, and a child reading "1. Title" over a list has been
 * handed a transcript of something they never saw.
 */
function Deck({ content }) {
  const slides = useMemo(() => {
    const list = Array.isArray(content?.slides) ? content.slides : [];
    return list.filter((s) => !s.hidden);
  }, [content]);
  const [open, setOpen] = useState(false);

  if (!slides.length) {
    return (
      <div className="border border-line rounded-xl p-8 text-center">
        <p className="text-sm text-muted">This deck has no slides in it yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-line rounded-xl overflow-hidden bg-paper">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-start p-5 hover:bg-paper-warm transition flex items-center gap-4"
        >
          <span className="text-accent flex-shrink-0"><PresentIcon size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-ink font-medium">Open the slides</p>
            <p className="text-sm text-muted">
              {slides.length} slides · arrow keys to move, Esc to close
            </p>
          </div>
          <ArrowRight size={15} className="text-muted flex-shrink-0" />
        </button>

        {/* A contents list, so they can see what is in it before opening. */}
        <ol className="border-t border-line divide-y divide-line/60">
          {slides.map((sl, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="w-full text-start px-5 py-2.5 hover:bg-paper-warm transition flex items-baseline gap-3"
              >
                <span className="font-mono text-[10px] text-muted flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-ink truncate">{sl.title || "Slide"}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {open !== false && (
        <SlideFullscreen
          slides={slides}
          start={typeof open === "number" ? open : 0}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The readable half of whatever this is.
 *
 * A lesson arrives already cut down to student_notes; a deck arrives as
 * slides. Both are rendered as prose rather than as the teacher's
 * editor, because a student is reading, not authoring.
 */
function Reading({ content }) {
  const body = useMemo(() => {
    if (!content) return null;
    if (typeof content === "string") return content;
    // A lesson arrives as body_md already cut to the Student notes
    // section; everything else that carries prose uses the same key.
    if (content.body_md) return content.body_md;
    if (content.student_notes) {
      return typeof content.student_notes === "string"
        ? content.student_notes
        : JSON.stringify(content.student_notes, null, 2);
    }
    if (Array.isArray(content.slides)) {
      // A deck read as a document. Hidden slides are hidden from the
      // class too, and a title slide with nothing on it is a heading
      // rather than an empty bullet list.
      return content.slides
        .filter((s) => !s.hidden)
        .map((s, i) => {
          const lines = (s.items?.length ? s.items : s.bullets || [])
            .map((b) => (typeof b === "string" ? b : b?.text || ""))
            .filter(Boolean)
            .map((b) => `- ${b}`)
            .join("\n");
          const body = typeof s.body === "string" ? s.body.trim() : "";
          const parts = [`### ${i + 1}. ${s.title || "Slide"}`];
          if (body) parts.push(body);
          if (lines) parts.push(lines);
          return parts.join("\n\n");
        })
        .join("\n\n");
    }
    if (content.markdown) return content.markdown;
    if (content.body) return content.body;
    // Homework and activities carry their instructions here.
    if (content.instructions) return content.instructions;
    if (content.main_activity) return content.main_activity;
    return null;
  }, [content]);

  if (!body) {
    return (
      <div className="border border-line rounded-xl p-8 text-center">
        <p className="text-sm text-muted">
          Your teacher hasn&rsquo;t added anything to read for this one.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-line rounded-xl p-6 bg-paper">
      {renderMarkdown(body)}
    </div>
  );
}

/**
 * Sit the quiz.
 *
 * One attempt, and the lock is in the database — a trigger refuses an
 * update once submitted_at is set. So the disabled fields below are a
 * courtesy to the student, not the thing keeping the rule.
 */
function Quiz({ w, onDone }) {
  const questions = useMemo(() => {
    const c = w.content || {};
    const qs = c.questions || c.items || [];
    return Array.isArray(qs) ? qs : [];
  }, [w]);

  const done = Boolean(w.attempt?.submitted_at);
  const [answers, setAnswers] = useState(() => w.attempt?.answers || {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const answered = Object.keys(answers).filter((k) => String(answers[k] ?? "").trim()).length;

  const submit = async () => {
    if (answered < questions.length) {
      const left = questions.length - answered;
      setErr(`${left} question${left === 1 ? "" : "s"} still to answer.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Marked by the teacher. A score the browser computed would be a
      // score the student could compute differently.
      await api(`/api/student/work/${w.entry_id}/quiz`, {
        method: "POST",
        body: { answers },
      });
      const fresh = await api(`/api/student/work/${w.entry_id}`);
      onDone(fresh);
    } catch (e) {
      setErr(e.message);
    } finally {
      /**
       * Cleared whether it worked or not.
       *
       * It used to be cleared only in the catch, on the assumption that a
       * success replaces this component. It does not — onDone updates the
       * parent's data and this same instance re-renders — so a student
       * who submitted successfully watched "Submitting…" spin forever and
       * had no way to tell whether it had gone.
       */
      setBusy(false);
    }
  };

  if (!questions.length) {
    return (
      <div className="border border-line rounded-xl p-8 text-center">
        <p className="text-sm text-muted">This quiz has no questions in it yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {done && <Result attempt={w.attempt} />}

      {questions.map((q, i) => {
        // The key the marker reads: the question's own id first, its
        // position next, the ordinal last. Answering under a different
        // key than the marker looks up is a silent zero.
        const key = String(q.qid ?? q.id ?? q.position ?? i);
        const options = q.choices || q.options || [];
        return (
          <div key={key} className="border border-line rounded-xl p-5 bg-paper">
            <p className="text-ink mb-3">
              <span className="font-mono text-[10px] text-muted me-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              {q.prompt || q.question || q.text}
            </p>

            {options.length ? (
              <div className="space-y-2">
                {options.map((opt, oi) => {
                  const val = typeof opt === "string" ? opt : opt.text ?? String(oi);
                  const chosen = answers[key] === val;
                  return (
                    <label
                      key={oi}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                        chosen ? "border-ink bg-paper-warm" : "border-line hover:border-ink-soft"
                      } ${done ? "cursor-default opacity-80" : ""}`}
                    >
                      <input
                        type="radio"
                        name={key}
                        disabled={done}
                        checked={chosen}
                        onChange={() => setAnswers((a) => ({ ...a, [key]: val }))}
                        className="mt-1"
                      />
                      <span className="text-sm text-ink">{val}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <textarea
                rows={3}
                disabled={done}
                value={answers[key] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                placeholder="Your answer"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink disabled:opacity-70"
              />
            )}
          </div>
        );
      })}

      {err && (
        <div className="bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      {!done && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="text-xs text-muted">
            {answered} of {questions.length} answered · you can only submit once
          </p>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit quiz"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * What the marking came to.
 *
 * Two numbers that must not be confused: what the multiple choice came
 * to, and what is still with the teacher. Showing "3 out of 10" while
 * seven marks are unmarked reads as a bad result rather than an
 * unfinished one, so the pending half is named rather than folded in.
 */
function Result({ attempt }) {
  const pending = Number(attempt?.flags?.pending_max ?? 0);
  const autoMax = Number(attempt?.flags?.auto_max ?? 0);
  const score = attempt?.score;
  const graded = attempt?.status === "graded";

  return (
    <div className="border border-sage rounded-xl p-4 bg-paper-warm/40">
      <p className="font-mono text-[10px] uppercase tracking-wider text-sage mb-1.5 inline-flex items-center gap-1.5">
        <CheckCircle2 size={12} /> Submitted
      </p>
      {graded && score != null ? (
        <p className="text-sm text-ink">
          You scored <span className="font-medium">{score}</span> out of {attempt.max_score}.
        </p>
      ) : (
        <>
          {autoMax > 0 && (
            <p className="text-sm text-ink">
              {score} out of {autoMax} on the multiple-choice questions.
            </p>
          )}
          {pending > 0 && (
            <p className="text-sm text-muted mt-1">
              Your written {pending === 1 ? "answer is" : "answers are"} with your teacher
              — {pending} more {pending === 1 ? "mark" : "marks"} to come.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Hand in homework or an activity.
 *
 * Files go to a private bucket under the student's own roster id, which
 * is what the storage policy reads to decide ownership — so a path is
 * only writable by the child it belongs to (db/tune.sql §50).
 */
function HandIn({ w, onDone }) {
  const existing = w.submission;
  const [files, setFiles] = useState(existing?.files || []);
  const [note, setNote] = useState(existing?.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const pick = async (list) => {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    const tooBig = chosen.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setErr(`${tooBig.name} is larger than 50 MB. Try a shorter video or a smaller photo.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const uploaded = [];
      for (const f of chosen) {
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `${w.student_row_id}/${w.entry_id}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from("submissions").upload(path, f, {
          upsert: true,
          contentType: f.type || undefined,
        });
        if (error) throw error;
        uploaded.push({ path, name: f.name, type: f.type, size: f.size });
      }
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setErr(e.message || "That file couldn’t be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (path) => setFiles((prev) => prev.filter((f) => f.path !== path));

  const save = async () => {
    if (!files.length) {
      setErr("Add at least one file before handing in.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/student/work/${w.entry_id}/submit`, {
        method: "POST",
        body: { student_row_id: w.student_row_id, files, note },
      });
      const fresh = await api(`/api/student/work/${w.entry_id}`);
      onDone(fresh);
    } catch (e) {
      setErr(e.message);
    } finally {
      // Same as the quiz: success keeps this component mounted, so the
      // button has to be released here rather than by unmounting.
      setBusy(false);
    }
  };

  return (
    <div className="border border-line rounded-xl p-5 bg-paper space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
          {existing ? "Your work" : "Hand in your work"}
        </p>
        {existing?.submitted_at && (
          <p className="text-sm text-sage inline-flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            Handed in {new Date(existing.submitted_at).toLocaleDateString()}
            {" — you can replace it until your teacher marks it."}
          </p>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center gap-2 text-sm text-ink border border-line rounded-lg px-3 py-2"
            >
              <FileText size={13} className="text-muted flex-shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              <button
                type="button"
                onClick={() => remove(f.path)}
                aria-label={`Remove ${f.name}`}
                className="text-muted hover:text-clay transition"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="block border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:border-ink transition">
        <input
          type="file"
          multiple
          accept={ACCEPT[w.type] || ACCEPT.homework}
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
        <Upload size={18} className="mx-auto text-muted mb-2" />
        <p className="text-sm text-ink">
          {w.type === "activity"
            ? "Add photos, a video, or a document"
            : "Add photos or a document"}
        </p>
        <p className="text-xs text-muted mt-1">Up to 50 MB each</p>
      </label>

      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you want to tell your teacher (optional)"
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
      />

      {err && (
        <div className="bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : existing ? "Replace what I handed in" : "Hand in"}
        </Button>
      </div>
    </div>
  );
}
