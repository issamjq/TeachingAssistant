import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import { Field, inputClasses, selectClasses, api } from "./_shared";

const QUESTION_TYPES = [
  { value: "mcq",   label: "Multiple choice" },
  { value: "tf",    label: "True / false" },
  { value: "short", label: "Short answer" },
  { value: "essay", label: "Essay" },
];

export default function QuizBuilder({ quiz, onClose }) {
  const [meta, setMeta] = useState({
    title: quiz?.title || "",
    subject: quiz?.subject || "",
    grade: quiz?.grade || "",
    section: quiz?.section || "",
    duration_minutes: quiz?.duration_minutes || 30,
    total_marks: quiz?.total_marks || 0,
    status: quiz?.status || "Draft",
    scheduled_for: quiz?.scheduled_for ? quiz.scheduled_for.slice(0, 10) : "",
    instructions: quiz?.instructions || "",
  });
  const [quizId, setQuizId] = useState(quiz?.id || null);
  const [questions, setQuestions] = useState([]);
  const [scores, setScores] = useState([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("questions");

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
        instructions: row.instructions || "",
      });
    }).catch(() => {});
    api(`/api/quizzes/${quizId}/questions`).then(setQuestions).catch(() => {});
    api(`/api/quizzes/${quizId}/scores`).then(setScores).catch(() => {});
  }, [quizId]);

  const setMetaField = (k, v) => setMeta((m) => ({ ...m, [k]: v }));

  const saveMeta = async () => {
    setSavingMeta(true); setErr(null);
    try {
      const saved = quizId
        ? await api(`/api/quizzes/${quizId}`, { method: "PATCH", body: meta })
        : await api(`/api/quizzes`, { method: "POST", body: meta });
      setQuizId(saved.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingMeta(false);
    }
  };

  const addQuestion = async () => {
    if (!quizId) {
      await saveMeta();
      return;
    }
    const next = await api(`/api/quizzes/${quizId}/questions`, {
      method: "POST",
      body: {
        position: questions.length + 1,
        type: "mcq",
        prompt: "New question",
        choices: ["A", "B", "C", "D"],
        correct_answer: "A",
        marks: 1,
      },
    });
    setQuestions((qs) => [...qs, next]);
  };

  const updateQuestion = async (q, patch) => {
    const next = await api(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "PATCH", body: patch });
    setQuestions((qs) => qs.map((x) => (x.id === q.id ? next : x)));
  };

  const removeQuestion = async (q) => {
    await api(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "DELETE" });
    setQuestions((qs) => qs.filter((x) => x.id !== q.id));
  };

  const recordScore = async (sid, score, maxScore) => {
    await api(`/api/quizzes/${quizId}/scores/${sid}`, {
      method: "PUT",
      body: { score: score === "" ? null : Number(score), max_score: maxScore || meta.total_marks || null },
    });
    api(`/api/quizzes/${quizId}/scores`).then(setScores);
  };

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
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Back to quizzes</Button>
          <Button onClick={saveMeta} disabled={savingMeta}>
            {savingMeta ? "Saving…" : quizId ? "Save changes" : "Create quiz"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

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
              <select className={selectClasses} value={meta.grade} onChange={(e) => setMetaField("grade", e.target.value)}>
                <option value="">—</option>
                {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <input className={inputClasses} value={meta.section} onChange={(e) => setMetaField("section", e.target.value)} />
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
            <Field label="Total marks">
              <input type="number" className={inputClasses} value={meta.total_marks ?? ""} onChange={(e) => setMetaField("total_marks", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Scheduled date">
                <input type="date" className={inputClasses} value={meta.scheduled_for || ""} onChange={(e) => setMetaField("scheduled_for", e.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Instructions to students">
                <textarea rows={2} className={inputClasses} value={meta.instructions} onChange={(e) => setMetaField("instructions", e.target.value)} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {!quizId ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-6">
          Save the quiz first to add questions and record scores.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-line mt-8 mb-6">
            {[
              ["questions", "Questions"],
              ["scores", "Scores"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 transition ${
                  tab === key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "questions" ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {questions.length} question{questions.length === 1 ? "" : "s"}
                </p>
                <Button onClick={addQuestion}>
                  <Plus size={14} className="mr-2" /> Add question
                </Button>
              </div>
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
            </>
          ) : (
            <Card>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                        <th className="text-left py-3 px-5 font-medium">Student</th>
                        <th className="text-left py-3 font-medium">Score</th>
                        <th className="text-left py-3 font-medium">Out of</th>
                        <th className="text-left py-3 px-5 font-medium">Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s) => (
                        <tr key={s.student_id} className="border-b border-line/60 last:border-0">
                          <td className="py-3 px-5 text-ink">
                            {s.first_name} {s.last_name}
                            <span className="font-mono text-[10px] text-muted ml-2">{s.code}</span>
                          </td>
                          <td className="py-3">
                            <input
                              type="number"
                              defaultValue={s.score ?? ""}
                              onBlur={(e) => recordScore(s.student_id, e.target.value, s.max_score)}
                              className="w-20 rounded-md border border-line bg-paper px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="py-3 text-muted">{s.max_score ?? meta.total_marks ?? "—"}</td>
                          <td className="py-3 px-5 text-muted text-xs">
                            {s.recorded_at ? new Date(s.recorded_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                      {scores.length === 0 && (
                        <tr><td colSpan={4} className="py-8 text-center text-muted">No students in your roster yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
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
          <p className="mt-3 text-xs text-muted">Essays are graded manually under the Scores tab.</p>
        )}
      </CardContent>
    </Card>
  );
}
