"use client";

// =====================================================================
// Reports, by student
//
// The first version was one flat feed of everything handed in, newest
// first. That works for six students and collapses at a hundred and
// twenty: to answer "has Aisha done her homework" a teacher had to read
// the whole term.
//
// A teacher thinks in students, so the list is students. Opening one
// shows their work — the files they uploaded, the note they left with
// them, and every word they wrote in a quiz next to the question that
// asked for it. Reading a wrong answer is how she knows whether it was a
// slip or a misconception, which is the whole of marking.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  PencilLine, Sparkles, ClipboardList, Paperclip, ExternalLink, Check,
  Search, ChevronRight, ArrowLeft, AlertCircle, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, inputClasses } from "./_shared";
import BrandLoader from "../components/BrandLoader";

const ICON = { homework: PencilLine, activity: Sparkles, quiz: ClipboardList };

const fullName = (s) => [s?.first_name, s?.last_name].filter(Boolean).join(" ") || "Student";

/**
 * A pre-written update home, computed from the same rows on screen.
 *
 * mailto:, deliberately — it opens in the teacher's own mail client,
 * addressed and drafted, and nothing sends until she presses send. A
 * one-click "Murchid emails the parent" would be a trust decision the
 * owner has not made; a drafted letter is just saved typing.
 */
function guardianMailto(s, work) {
  const assigned = work.length;
  const returned = work.filter((w) => w.handed_in || w.attempted_at).length;
  const scored = work.filter((w) => w.score != null && w.max_score);
  const avg = scored.length
    ? Math.round(
        (scored.reduce((sum, w) => sum + Number(w.score) / Number(w.max_score), 0) / scored.length) * 100,
      )
    : null;
  const first = s.first_name || "your child";
  const lines = [
    `Dear ${s.guardian_name || "guardian"},`,
    "",
    `A short update on ${first}${s.subject ? ` in ${s.subject}` : ""}:`,
    "",
    `- Work set so far: ${assigned}`,
    `- Handed in: ${returned} of ${assigned}`,
    ...(avg != null ? [`- Average on marked work: ${avg}%`] : []),
    "",
    "Do write back if you would like to talk anything through.",
    "",
    "Kind regards,",
  ];
  const subject = `${fullName(s)}${s.subject ? ` — ${s.subject}` : ""}: an update from school`;
  return `mailto:${encodeURIComponent(s.guardian_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export default function ReportsSubmissions() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);   // the student being read
  const [search, setSearch] = useState("");

  const load = () =>
    api("/api/submissions/by-student").then(setRows).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows || [];
    if (!q) return list;
    return list.filter((r) =>
      `${fullName(r)} ${r.email ?? ""} ${r.subject ?? ""}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const toMark = (rows || []).reduce((n, r) => n + Number(r.to_mark || 0), 0);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!rows) return <BrandLoader />;

  if (open) {
    return <StudentReport studentId={open} onBack={() => { setOpen(null); load(); }} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Handed in
          </p>
          <h3 className="font-serif text-2xl text-ink">
            What your <em className="italic font-light text-accent">students</em> sent back
          </h3>
          {toMark > 0 && (
            <p className="text-sm text-clay mt-1.5 inline-flex items-center gap-1.5">
              <AlertCircle size={13} />
              {toMark} {toMark === 1 ? "paper" : "papers"} waiting for you to mark
            </p>
          )}
        </div>
        <div className="relative">
          <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a student…"
            className={`${inputClasses} ps-8 w-56`}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border border-line rounded-xl p-12 text-center">
          <p className="text-ink mb-1">
            {rows.length === 0 ? "No students yet." : "No student matches that."}
          </p>
          <p className="text-sm text-muted">
            {rows.length === 0
              ? "Add students in My students, then set them work."
              : "Try their first name or email."}
          </p>
        </div>
      ) : (
        <div className="border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                <th className="text-left py-3 px-4 font-medium">Student</th>
                <th className="text-left py-3 font-medium">Class</th>
                <th className="text-left py-3 font-medium">Done</th>
                <th className="text-left py-3 font-medium">To mark</th>
                <th className="text-left py-3 font-medium">Average</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const done = Number(r.handed_in || 0) + Number(r.attempts || 0);
                const assigned = Number(r.assigned || 0);
                return (
                  <tr
                    key={r.student_id}
                    onClick={() => setOpen(r.student_id)}
                    className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition cursor-pointer"
                  >
                    <td className="py-3 px-4 text-ink">
                      {fullName(r)}
                      {r.email && <div className="text-muted text-xs">{r.email}</div>}
                    </td>
                    <td className="py-3 text-muted text-xs">
                      {r.grade}{r.section ? ` ${r.section}` : ""}
                      {r.subject ? ` · ${r.subject}` : ""}
                    </td>
                    <td className="py-3 text-ink">
                      {done}
                      <span className="text-muted"> / {assigned}</span>
                    </td>
                    <td className="py-3">
                      {Number(r.to_mark) > 0 ? (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-clay">
                          {r.to_mark} waiting
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 text-ink">
                      {r.avg_pct != null ? `${r.avg_pct}%` : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-3 pe-3 text-end">
                      <ChevronRight size={14} className="text-muted inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** One student, and everything of theirs. */
function StudentReport({ studentId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    api(`/api/submissions/by-student/${studentId}`).then(setData).catch((e) => setError(e.message));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [studentId]);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!data) return <BrandLoader />;

  const s = data.student || {};
  const work = data.work || [];

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink inline-flex items-center gap-1.5 transition"
      >
        <ArrowLeft size={12} /> All students
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" />
            {s.grade}{s.section ? ` · ${s.section}` : ""}{s.subject ? ` · ${s.subject}` : ""}
          </p>
          <h3 className="font-serif text-2xl text-ink">{fullName(s)}</h3>
          {s.email && <p className="text-muted text-sm mt-1">{s.email}</p>}
        </div>
        {/* Half a teacher's job is communicating home, and the guardian
            details were collected for exactly this. A mailto: opens HER
            mail app with the term summarised — she reads, edits, sends;
            Murchid never emails a family on its own. */}
        {s.guardian_email && (
          <a
            href={guardianMailto(s, work)}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] text-ink-soft hover:border-ink hover:text-ink transition"
          >
            <Send size={13} />
            Email {s.guardian_name ? s.guardian_name.split(/\s+/)[0] : "guardian"}
          </a>
        )}
      </div>

      {work.length === 0 ? (
        <div className="border border-line rounded-xl p-12 text-center">
          <p className="text-sm text-muted">Nothing set for this student yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {work.map((w) => <WorkRow key={w.entry_id} w={w} onGraded={load} />)}
        </div>
      )}
    </div>
  );
}

function WorkRow({ w, onGraded }) {
  const Icon = ICON[w.type] || PencilLine;
  const isQuiz = w.type === "quiz";
  const returned = isQuiz ? Boolean(w.attempted_at) : Boolean(w.handed_in);
  const needsMarking = isQuiz && w.attempted_at && w.attempt_status !== "graded";

  // A paper waiting to be marked opens on its answers — marking IS the
  // job on this screen, and hiding the questions behind a click made
  // the whole attempt a single number box.
  const [expanded, setExpanded] = useState(needsMarking && (w.answers?.length ?? 0) > 0);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState(null);

  /**
   * Per-question marks for the questions only she can judge, keyed the
   * way the answers are (a.key). Auto questions carry their computed
   * marks; her entries fill the rest, and the total writes itself.
   */
  const manual = (w.answers || []).filter((a) => !a.auto);
  const autoEarned = (w.answers || []).reduce(
    (sum, a) => sum + (a.auto && a.verdict?.correct === true ? Number(a.marks) || 0 : 0),
    0,
  );
  const [perQ, setPerQ] = useState(() => {
    const m = {};
    for (const a of manual) {
      if (a.teacher_marks != null && a.teacher_marks !== "") m[a.key] = String(a.teacher_marks);
    }
    return m;
  });
  const perQTotal = Object.values(perQ).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const [score, setScore] = useState(w.score ?? "");
  const [scoreTouched, setScoreTouched] = useState(w.score != null);
  // Until she overrides the total by hand, it follows the breakdown.
  const shownScore = scoreTouched ? score : String(autoEarned + perQTotal);
  const [feedback, setFeedback] = useState(w.feedback ?? "");

  const setMark = (key, v) => setPerQ((m) => ({ ...m, [key]: v }));

  const grade = async () => {
    setBusy(true);
    setRowError(null);
    try {
      const marks = {};
      for (const [k, v] of Object.entries(perQ)) {
        if (v !== "" && v != null) marks[k] = Number(v);
      }
      await api(`/api/submissions/${w.attempt_id}/grade`, {
        method: "POST",
        body: {
          score: Number(shownScore),
          feedback: feedback.trim() || null,
          marks: Object.keys(marks).length ? marks : null,
        },
      });
      await onGraded();
    } catch (e) {
      setRowError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (path, name) => {
    try {
      // Signed and short-lived: the bucket is private, and a child's work
      // should not sit behind a URL that outlives the tab.
      const { url } = await api("/api/submissions/file", { method: "POST", body: { path } });
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      setRowError(`Couldn't open ${name}.`);
    }
  };

  return (
    <div className={`border rounded-xl bg-paper ${needsMarking ? "border-clay/50" : "border-line"}`}>
      <div className="p-4 flex items-start gap-3">
        <span className="mt-0.5 text-accent flex-shrink-0"><Icon size={15} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-ink font-medium">{w.title}</p>
          <p className="text-xs text-muted mt-0.5">
            {w.type}
            {w.date ? ` · set for ${new Date(w.date).toLocaleDateString()}` : ""}
            {returned
              ? ` · returned ${new Date(w.handed_in || w.attempted_at).toLocaleDateString()}`
              : " · nothing back yet"}
          </p>

          {/* Files, and the note that came with them. The note used to be
              dropped entirely, which threw away the one thing a child
              chose to say about their own work. */}
          {w.files?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {w.files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => openFile(f.path, f.name)}
                  className="inline-flex items-center gap-1.5 text-xs text-ink border border-line rounded-lg px-2.5 py-1.5 hover:border-ink transition"
                >
                  <Paperclip size={11} className="text-muted" />
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <ExternalLink size={10} className="text-muted" />
                </button>
              ))}
            </div>
          )}
          {w.note && (
            <div className="mt-2.5 border-s-2 border-line ps-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-0.5">
                They wrote
              </p>
              <p className="text-sm text-ink-soft italic">{w.note}</p>
            </div>
          )}

          {isQuiz && w.answers?.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="font-mono text-[10px] uppercase tracking-wider text-accent hover:text-ink mt-2.5 transition"
            >
              {expanded ? "Hide answers" : `Read their ${w.answers.length} answers`}
            </button>
          )}
        </div>

        <div className="flex-shrink-0 text-end">
          {isQuiz && w.attempted_at ? (
            needsMarking ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={shownScore}
                  onChange={(e) => { setScoreTouched(true); setScore(e.target.value); }}
                  aria-label="Total score"
                  className={`${inputClasses} w-16 text-center`}
                />
                <span className="text-xs text-muted">/ {w.max_score}</span>
                <Button onClick={grade} disabled={busy || shownScore === ""}>
                  {busy ? "…" : "Mark"}
                </Button>
              </div>
            ) : (
              <span className="font-mono text-xs text-sage inline-flex items-center gap-1">
                <Check size={12} /> {w.score} / {w.max_score}
              </span>
            )
          ) : !returned ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Not in
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-sage">
              {w.files?.length || 0} {w.files?.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>
      </div>

      {rowError && (
        <p className="px-4 pb-3 text-[12.5px] text-crit">{rowError}</p>
      )}

      {expanded && isQuiz && (
        <div className="border-t border-line divide-y divide-line/60">
          {w.answers.map((a, i) => {
            const marked = a.verdict;
            const right = marked?.correct === true;
            const pending = marked?.pending === true || !a.auto;
            return (
              <div key={i} className="px-4 py-3">
                <p className="text-sm text-ink mb-1.5">
                  <span className="font-mono text-[10px] text-muted me-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {a.prompt}
                </p>
                <div className="ps-7 space-y-1">
                  <p className="text-sm">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted me-2">
                      Answered
                    </span>
                    <span className={right ? "text-sage" : pending ? "text-ink" : "text-clay"}>
                      {a.given?.trim() ? a.given : <em className="text-muted">left blank</em>}
                    </span>
                  </p>
                  {/* Only where there is a single right answer. A written
                      response has none, and printing one would invite her
                      to mark against a phrasing rather than an idea. */}
                  {a.auto && !right && (
                    <p className="text-sm">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted me-2">
                        Correct
                      </span>
                      <span className="text-ink-soft">{a.correct}</span>
                    </p>
                  )}
                  {a.auto ? (
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
                      {right ? `Correct · ${a.marks} mark${a.marks === 1 ? "" : "s"}` : "Wrong · 0"}
                    </p>
                  ) : needsMarking ? (
                    /* The question she has to judge gets its own marks box —
                       the total above follows these until she overrides it. */
                    <p className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max={a.marks}
                        value={perQ[a.key] ?? ""}
                        onChange={(e) => setMark(a.key, e.target.value)}
                        aria-label={`Marks for question ${i + 1}`}
                        className={`${inputClasses} w-14 py-1 text-center text-xs`}
                      />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                        / {a.marks} mark{a.marks === 1 ? "" : "s"}
                      </span>
                    </p>
                  ) : (
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
                      {a.teacher_marks != null && a.teacher_marks !== ""
                        ? `Marked · ${a.teacher_marks} / ${a.marks}`
                        : `${a.marks} mark${a.marks === 1 ? "" : "s"}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3">
            {needsMarking ? (
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted block mb-1">
                  Feedback to the student
                </span>
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="One line goes a long way — what was strong, what to look at again."
                  className={`${inputClasses} text-sm`}
                />
              </label>
            ) : w.feedback ? (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-0.5">
                  Your feedback
                </p>
                <p className="text-sm text-ink-soft italic">{w.feedback}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
