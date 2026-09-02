"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus, Trash2, Scale, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { DeliveryStatus } from "@/features/delivery";
import { Field, inputClasses, selectClasses, api, useTeacherClasses, DatePicker, AudienceSelect } from "./_shared";
import { quizToDoc } from "../lib/toDoc";
import { useT } from "../lib/i18n";

const QUESTION_TYPES = [
  { value: "mcq",   label: "Multiple choice" },
  { value: "tf",    label: "True / false" },
  { value: "short", label: "Short answer" },
  { value: "essay", label: "Essay" },
];

export default function QuizBuilder({ quiz, onClose }) {
  const t = useT();
  const { grades: teacherGrades, sections: teacherSections } = useTeacherClasses();
  const [meta, setMeta] = useState({
    title: quiz?.title || "",
    subject: quiz?.subject || "",
    grade: quiz?.grade || "",
    section: quiz?.section || "",
    duration_minutes: quiz?.duration_minutes || 30,
    total_marks: quiz?.total_marks || 0,
    status: quiz?.status || "Draft",
    scheduled_for: quiz?.scheduled_for ? quiz.scheduled_for.slice(0, 10) : "",
    // "11:00:00" from Postgres, "11:00" from the studio — the input wants HH:MM.
    start_time: quiz?.start_time ? String(quiz.start_time).slice(0, 5) : "",
    end_time: quiz?.end_time ? String(quiz.end_time).slice(0, 5) : "",
    instructions: quiz?.instructions || "",
  });
  const [quizId, setQuizId] = useState(quiz?.id || null);
  const [questions, setQuestions] = useState([]);
  const [savingMeta, setSavingMeta] = useState(false);
  // A short "Saved" flash on the button — the only confirmation this
  // screen ever gave was the label reverting, which reads as nothing
  // having happened. deliveryKey re-reads the timetable after each save.
  const [savedFlash, setSavedFlash] = useState(false);
  const [deliveryKey, setDeliveryKey] = useState(0);
  const flashTimer = useRef(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const [err, setErr] = useState(null);
  const [tweak, setTweak] = useState("");
  const [tweaking, setTweaking] = useState(false);

  // Load existing meta + questions + scores when editing. Callers may pass
  // just `{ id }` (e.g. the Quizzes list hands us a stub by route), so we
  // always re-fetch the full quiz here and seed the meta state from the
  // server. Without this the title / subject / grade fields all render blank
  // even though the row in the DB has them.
  useEffect(() => {
    if (!quizId) return;
    api(`/api/quizzes/${quizId}`).then((row) => {
      if (!row) return;
      setMeta({
        title: row.title || "",
        subject: row.subject || "",
        grade: row.grade || "",
        section: row.section || "",
        duration_minutes: row.duration_minutes ?? 30,
        total_marks: row.total_marks ?? 0,
        status: row.status || "Draft",
        scheduled_for: row.scheduled_for ? String(row.scheduled_for).slice(0, 10) : "",
        start_time: row.start_time ? String(row.start_time).slice(0, 5) : "",
        end_time: row.end_time ? String(row.end_time).slice(0, 5) : "",
        instructions: row.instructions || "",
      });
    }).catch(() => {});
    api(`/api/quizzes/${quizId}/questions`).then(setQuestions).catch(() => {});
  }, [quizId]);

  const setMetaField = (k, v) => setMeta((m) => ({ ...m, [k]: v }));

  // A fresh blank MCQ — used by both "Create quiz" (which seeds the
  // first question for the teacher) and the "Add question" button.
  const blankQuestion = (position) => ({
    position,
    type: "mcq",
    prompt: "New question",
    choices: ["A", "B", "C", "D"],
    correct_answer: "A",
    marks: 1,
  });
  // Local-only questions (drafted before the quiz is saved) get
  // string ids so we can tell them apart from server rows during
  // update/remove — and so QuestionCard's key={q.id} survives.
  const tempQuestionId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const isLocalQuestion = (q) => typeof q?.id === "string" && q.id.startsWith("local-");

  const postQuestion = async (forQuizId, position) => {
    return api(`/api/quizzes/${forQuizId}/questions`, {
      method: "POST",
      body: blankQuestion(position),
    });
  };

  const saveMeta = async () => {
    setSavingMeta(true); setErr(null);
    try {
      if (quizId) {
        const saved = await api(`/api/quizzes/${quizId}`, { method: "PATCH", body: meta });
        setQuizId(saved.id);
      } else {
        // Brand-new quiz: hand everything (meta + any local questions)
        // to the bulk endpoint so the create + question inserts run in
        // one transaction. If the teacher hasn't drafted any yet, seed
        // a single blank one so they land on an editable card.
        const localQs = (questions.length > 0 ? questions : [blankQuestion(1)])
          .map((q, i) => {
            const { id, ...rest } = q;
            return { ...rest, position: i + 1 };
          });
        const res = await api(`/api/quizzes/bulk`, {
          method: "POST",
          body: { ...meta, questions: localQs },
        });
        setQuizId(res.quiz.id);
        setQuestions(res.questions || []);
      }
      setSavedFlash(true);
      setDeliveryKey((k) => k + 1);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingMeta(false);
    }
  };

  const addQuestion = async () => {
    // Pre-save: just push a local draft. Post-save: POST so the
    // server assigns a real id.
    if (!quizId) {
      setQuestions((qs) => [...qs, { ...blankQuestion(qs.length + 1), id: tempQuestionId() }]);
      return;
    }
    try {
      const next = await postQuestion(quizId, questions.length + 1);
      setQuestions((qs) => [...qs, next]);
    } catch (e) {
      setErr(e.message || "Could not add the question.");
    }
  };

  const updateQuestion = async (q, patch) => {
    // Local draft → mutate in place. Server row → PATCH and replace
    // with the returned row so position / id stay authoritative.
    if (!quizId || isLocalQuestion(q)) {
      setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, ...patch } : x)));
      return;
    }
    try {
      const next = await api(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "PATCH", body: patch });
      setQuestions((qs) => qs.map((x) => (x.id === q.id ? next : x)));
    } catch (e) {
      setErr(e.message || "Could not save the change.");
    }
  };

  const removeQuestion = async (q) => {
    if (!quizId || isLocalQuestion(q)) {
      setQuestions((qs) => qs.filter((x) => x.id !== q.id));
      return;
    }
    try {
      await api(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "DELETE" });
      setQuestions((qs) => qs.filter((x) => x.id !== q.id));
    } catch (e) {
      setErr(e.message || "Could not remove the question.");
    }
  };

  // Hand the whole quiz and one instruction to /api/studio/quiz-tweak;
  // the service streams commentary and puts the full revised quiz on its
  // done frame — questions the instruction doesn't touch come back
  // unchanged. The service speaks "true_false" where this builder stores
  // "tf", so the shape is mapped on the way out and back.
  const runTweak = async () => {
    const instruction = tweak.trim();
    if (!instruction || tweaking || questions.length === 0) return;
    setTweaking(true);
    setErr(null);
    try {
      const { streamSSE, AI_FIRST_BYTE_MS, AI_IDLE_MS } = await import("@/shared/lib/apiStream");
      const toWire = (q) => ({
        position: q.position,
        type: q.type === "tf" ? "true_false" : q.type,
        prompt: q.prompt,
        choices: Array.isArray(q.choices) && q.choices.length ? q.choices : undefined,
        correct_answer: q.correct_answer,
        marks: Number(q.marks) || 1,
      });
      let revised = null;
      await streamSSE("/api/studio/quiz-tweak", {
        body: { quiz: { questions: questions.map(toWire) }, instruction },
        firstByteMs: AI_FIRST_BYTE_MS,
        idleMs: AI_IDLE_MS,
        onEvent: (ev) => {
          if (ev.type === "done" && ev.quiz?.questions?.length) revised = ev.quiz.questions;
        },
      });
      if (!revised) throw new Error("The service answered without a revised quiz — nothing was changed.");
      const fromWire = revised.map((q, i) => ({
        position: i + 1,
        type: q.type === "true_false" ? "tf" : q.type || "mcq",
        prompt: q.prompt || "",
        choices: Array.isArray(q.choices) && q.choices.length ? q.choices : undefined,
        correct_answer: q.correct_answer ?? "",
        marks: Number(q.marks) || 1,
      }));
      if (quizId) {
        // One transactional replace, then re-read so ids stay authoritative.
        await api(`/api/quizzes/${quizId}/sync`, { method: "POST", body: { questions: fromWire } });
        setQuestions(await api(`/api/quizzes/${quizId}/questions`));
      } else {
        setQuestions(fromWire.map((q) => ({ ...q, id: tempQuestionId() })));
      }
      setTweak("");
    } catch (e) {
      setErr(
        e?.code === "no_backend"
          ? "AI tweaks need the Murchid API service, which isn't connected yet. Your questions are untouched."
          : e.message || "The tweak failed — your questions are untouched.",
      );
    } finally {
      setTweaking(false);
    }
  };

  // Distribute the target Score evenly across every question. When the
  // total doesn't divide cleanly, the remainder lands on the earliest
  // questions (e.g. 10 marks over 3 → 4, 3, 3) so the per-question marks
  // stay whole numbers and still sum to exactly the target.
  const splitMarksEqually = async () => {
    const n = questions.length;
    const total = Number(meta.total_marks) || 0;
    if (n === 0 || total <= 0) return;
    const base = Math.floor(total / n);
    let remainder = total - base * n;
    const nextMarks = questions.map(() => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return base + extra;
    });
    // Local drafts (and unsaved quizzes) update in one state pass; saved
    // quizzes PATCH each question so the server stays authoritative.
    if (!quizId) {
      setQuestions((qs) => qs.map((q, i) => ({ ...q, marks: nextMarks[i] })));
      return;
    }
    setErr(null);
    try {
      await Promise.all(
        questions.map((q, i) =>
          isLocalQuestion(q)
            ? Promise.resolve()
            : api(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "PATCH", body: { marks: nextMarks[i] } })
        )
      );
      setQuestions((qs) => qs.map((q, i) => ({ ...q, marks: nextMarks[i] })));
    } catch (e) {
      setErr(e.message || "Could not split the marks.");
    }
  };

  // Live score allocation: sum of per-question marks against the
  // target Score. The hint sits beside the Score label so the teacher
  // sees, at a glance, how many marks they still need to assign.
  const assignedMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const targetMarks = Number(meta.total_marks) || 0;
  const remainingMarks = targetMarks - assignedMarks;
  const scoreHint = targetMarks <= 0
    ? `${assignedMarks} assigned`
    : remainingMarks === 0
      ? <span className="text-sage">balanced · {assignedMarks} / {targetMarks}</span>
      : remainingMarks > 0
        ? <span className="text-muted">{remainingMarks} mark{remainingMarks === 1 ? "" : "s"} left · {assignedMarks} / {targetMarks}</span>
        : <span className="text-accent">{-remainingMarks} over · {assignedMarks} / {targetMarks}</span>;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {quizId ? "Edit quiz" : "New quiz"}
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {quizId ? meta.title || "Untitled quiz" : <>Build a <em className="italic font-light text-accent">quiz</em></>}
          </h2>
        </div>
        <div className="flex gap-3 items-center">
          {quizId && (
            <ExportMenu
              formats={["pdf", "doc", "md"]}
              buildDoc={() => quizToDoc(meta, questions, t)}
            />
          )}
          <Button variant="secondary" onClick={onClose}>Back to quizzes</Button>
          <Button onClick={saveMeta} disabled={savingMeta}>
            {savingMeta ? (
              "Saving…"
            ) : savedFlash ? (
              <><CheckCircle2 size={14} className="mr-2" /> Saved</>
            ) : quizId ? (
              "Save changes"
            ) : (
              "Create quiz"
            )}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      {/* Whether the class will actually receive this quiz. The fields
          below (grade, subject, even "Scheduled date") live on the quiz
          row and deliver nothing by themselves — only a timetable slot
          carrying the quiz reaches students, and this says which state
          the quiz is in. */}
      <DeliveryStatus
        draftId={quizId}
        title={meta.title}
        audience={{ grade: meta.grade, subject: meta.subject, section: meta.section }}
        status={meta.status}
        refreshKey={deliveryKey}
        className="mb-4"
      />

      <Card>
        <CardContent className="p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Quiz details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Title">
                <input className={inputClasses} value={meta.title} onChange={(e) => setMetaField("title", e.target.value)} />
              </Field>
            </div>
            <Field label="Subject">
              <input className={inputClasses} value={meta.subject} onChange={(e) => setMetaField("subject", e.target.value)} />
            </Field>
            <Field label="Grade">
              <AudienceSelect
                value={meta.grade}
                onChange={(v) => setMetaField("grade", v)}
                options={teacherGrades}
                allLabel="All grades"
                emptyNote="No grades on your profile"
              />
            </Field>
            <Field label="Section">
              <AudienceSelect
                value={meta.section}
                onChange={(v) => setMetaField("section", v)}
                options={teacherSections}
                allLabel="All sections"
                emptyNote="No sections on your profile"
              />
            </Field>
            <Field label="Status">
              <select className={selectClasses} value={meta.status} onChange={(e) => setMetaField("status", e.target.value)}>
                <option>Draft</option>
                <option>Ready</option>
                <option>Closed</option>
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" className={inputClasses} value={meta.duration_minutes ?? ""} onChange={(e) => setMetaField("duration_minutes", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Score" hint={scoreHint}>
              <input type="number" className={inputClasses} value={meta.total_marks ?? ""} onChange={(e) => setMetaField("total_marks", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Scheduled date">
                <DatePicker value={meta.scheduled_for || ""} onChange={(v) => setMetaField("scheduled_for", v)} />
              </Field>
            </div>
            {/* A quiz opens and it closes, and both times are on the
                timetable. The studio has always collected them — it asks for
                "the hours it runs" before writing a paper — and they were
                stored on the row and shown nowhere, so a teacher opening the
                quiz she had just scheduled found a date and no time on it. */}
            <Field label="Starts">
              <input
                type="time"
                className={inputClasses}
                value={meta.start_time || ""}
                onChange={(e) => setMetaField("start_time", e.target.value || null)}
              />
            </Field>
            <Field label="Ends">
              <input
                type="time"
                className={inputClasses}
                value={meta.end_time || ""}
                onChange={(e) => setMetaField("end_time", e.target.value || null)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Instructions to students">
                <textarea rows={2} className={inputClasses} value={meta.instructions} onChange={(e) => setMetaField("instructions", e.target.value)} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {questions.length} question{questions.length === 1 ? "" : "s"}
              {!quizId && questions.length > 0 && (
                <span className="ms-2 normal-case tracking-normal italic font-serif text-muted/80">
                  · drafts — saved when you press Create quiz
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={splitMarksEqually}
                disabled={questions.length === 0 || targetMarks <= 0}
                title={targetMarks <= 0 ? "Set a Score first" : "Distribute the Score evenly across all questions"}
              >
                <Scale size={14} className="mr-2" /> Split equally
              </Button>
              <Button onClick={addQuestion}>
                <Plus size={14} className="mr-2" /> Add question
              </Button>
            </div>
          </div>
          {questions.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <Wand2 size={14} className="text-muted flex-none" aria-hidden />
              <input
                className={inputClasses}
                placeholder='Tweak the whole quiz with AI — e.g. "make question 3 harder and add two true/false"'
                value={tweak}
                disabled={tweaking}
                onChange={(e) => setTweak(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runTweak(); }}
              />
              <Button variant="secondary" onClick={runTweak} disabled={tweaking || !tweak.trim()}>
                {tweaking ? "Tweaking…" : "Tweak"}
              </Button>
            </div>
          )}
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                index={i + 1}
                q={q}
                onChange={(patch) => updateQuestion(q, patch)}
                onRemove={() => removeQuestion(q)}
              />
            ))}
            {questions.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-muted text-sm">
                  No questions yet. Add one to get started.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </div>
  );
}

function QuestionCard({ index, q, onChange, onRemove }) {
  const [local, setLocal] = useState(q);
  useEffect(() => setLocal(q), [q.id]); // only when the question id changes
  const setLocalField = (k, v) => {
    const next = { ...local, [k]: v };
    setLocal(next);
  };
  const flush = (k, v) => {
    const patch = {};
    patch[k] = v;
    onChange(patch);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Question {index} · {QUESTION_TYPES.find((t) => t.value === local.type)?.label || local.type}
          </p>
          <button
            onClick={onRemove}
            className="text-muted hover:text-accent"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Field label="Type">
            <select
              className={selectClasses}
              value={local.type}
              onChange={(e) => { setLocalField("type", e.target.value); flush("type", e.target.value); }}
            >
              {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Marks">
            <input
              type="number"
              className={inputClasses}
              value={local.marks ?? 1}
              onChange={(e) => setLocalField("marks", Number(e.target.value))}
              onBlur={(e) => flush("marks", Number(e.target.value))}
            />
          </Field>
          <Field label="Position">
            <input
              type="number"
              className={inputClasses}
              value={local.position ?? index}
              onChange={(e) => setLocalField("position", Number(e.target.value))}
              onBlur={(e) => flush("position", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Prompt">
          <textarea
            rows={2}
            className={inputClasses}
            value={local.prompt || ""}
            onChange={(e) => setLocalField("prompt", e.target.value)}
            onBlur={(e) => flush("prompt", e.target.value)}
          />
        </Field>
        {local.type === "mcq" && (
          <div className="mt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Choices</p>
            {(local.choices || []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={local.correct_answer === c}
                  onChange={() => { setLocalField("correct_answer", c); flush("correct_answer", c); }}
                  className="accent-ink"
                />
                <input
                  className={inputClasses}
                  value={c}
                  onChange={(e) => {
                    const next = [...local.choices];
                    next[i] = e.target.value;
                    setLocalField("choices", next);
                  }}
                  onBlur={(e) => {
                    const next = [...local.choices];
                    next[i] = e.target.value;
                    flush("choices", next);
                  }}
                />
                <button
                  onClick={() => {
                    const next = local.choices.filter((_, idx) => idx !== i);
                    setLocalField("choices", next);
                    flush("choices", next);
                  }}
                  className="text-muted hover:text-accent"
                  title="Remove choice"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const next = [...(local.choices || []), ""];
                setLocalField("choices", next);
                flush("choices", next);
              }}
              className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
            >
              + Add choice
            </button>
          </div>
        )}
        {local.type === "tf" && (
          <div className="mt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Correct answer</p>
            <select
              className={selectClasses + " max-w-xs"}
              value={String(local.correct_answer ?? true)}
              onChange={(e) => { const v = e.target.value === "true"; setLocalField("correct_answer", v); flush("correct_answer", v); }}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>
        )}
        {local.type === "short" && (
          <div className="mt-3">
            <Field label="Expected answer (used for auto-grade)">
              <input
                className={inputClasses}
                value={local.correct_answer ?? ""}
                onChange={(e) => setLocalField("correct_answer", e.target.value)}
                onBlur={(e) => flush("correct_answer", e.target.value)}
              />
            </Field>
          </div>
        )}
        {local.type === "essay" && (
          <p className="mt-3 text-xs text-muted">Essays are graded manually after the quiz is taken.</p>
        )}
      </CardContent>
    </Card>
  );
}
