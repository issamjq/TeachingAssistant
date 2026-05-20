// My students → Scores tab. Lets the teacher record a per-student
// score on a specific quiz.
//
// UX: pick a quiz from the dropdown at the top → see every student that
// matches the quiz's grade + section (or all students if the quiz is
// "all sections") → type a score → Save. Existing scores load in
// pre-filled so the teacher can edit instead of re-entering.
//
// Backend: GET /api/quizzes, GET /api/students?teacher=me,
// GET /api/quiz-scores?quiz_id=<id>, POST /api/quiz-scores.
import React, { useEffect, useMemo, useState } from "react";
import { Save, Check } from "lucide-react";
import { api } from "./_shared";

export default function DatabaseScores() {
  const [quizzes, setQuizzes] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});  // student_id → { score, max_score, feedback }
  const [quizId, setQuizId] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savedAt, setSavedAt] = useState({}); // student_id → ms timestamp
  const [error, setError] = useState(null);

  // Load quizzes + students once.
  useEffect(() => {
    Promise.all([
      api("/api/quizzes"),
      api("/api/students?teacher=me"),
    ])
      .then(([qs, ss]) => {
        setQuizzes(Array.isArray(qs) ? qs : []);
        setStudents(Array.isArray(ss) ? ss : []);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Whenever the picked quiz changes, fetch its existing scores so the
  // grid pre-fills with what the teacher already entered before.
  useEffect(() => {
    if (!quizId) { setScores({}); return; }
    setBusy(true);
    setError(null);
    api(`/api/quiz-scores?quiz_id=${quizId}`)
      .then((rows) => {
        const map = {};
        for (const r of rows || []) {
          map[r.student_id] = {
            score: r.score ?? "",
            max_score: r.max_score ?? "",
            feedback: r.feedback ?? "",
          };
        }
        setScores(map);
        setBusy(false);
      })
      .catch((e) => { setError(e.message); setBusy(false); });
  }, [quizId]);

  const quiz = useMemo(() => quizzes.find((q) => String(q.id) === String(quizId)), [quizzes, quizId]);

  // Filter the roster to only the students who match the quiz's
  // grade + section. If a quiz is grade-only (no section), include
  // every section. If it's "all sections" it covers the whole grade.
  const eligible = useMemo(() => {
    if (!quiz) return [];
    return students.filter((s) => {
      if (quiz.grade && s.grade && quiz.grade !== s.grade) return false;
      if (quiz.section && quiz.section !== "All sections" && s.section && quiz.section !== s.section) return false;
      return true;
    });
  }, [students, quiz]);

  const setCell = (sid, patch) =>
    setScores((m) => ({ ...m, [sid]: { ...(m[sid] || {}), ...patch } }));

  const saveRow = async (sid) => {
    const row = scores[sid] || {};
    if (row.score === "" || row.score == null) return;
    setSavingId(sid);
    setError(null);
    try {
      await api("/api/quiz-scores", {
        method: "POST",
        body: {
          quiz_id: quizId,
          student_id: sid,
          score: Number(row.score),
          max_score: row.max_score === "" || row.max_score == null
            ? (quiz?.total_marks ?? null)
            : Number(row.max_score),
          feedback: row.feedback || null,
        },
      });
      setSavedAt((m) => ({ ...m, [sid]: Date.now() }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quiz picker */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 max-w-md">
          <label className="block text-[11px] font-mono uppercase tracking-[0.16em] text-muted mb-1.5">
            Quiz
          </label>
          <select
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-paper-cool text-sm text-ink outline-none focus:border-ink"
          >
            <option value="">Select a quiz…</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title || "Untitled"}
                {q.grade ? ` · ${q.grade}` : ""}
                {q.section && q.section !== "All sections" ? ` ${q.section}` : ""}
                {q.total_marks ? ` · /${q.total_marks}` : ""}
              </option>
            ))}
          </select>
        </div>
        {quiz && (
          <div className="text-[12px] text-muted">
            {eligible.length} student{eligible.length === 1 ? "" : "s"} match this quiz's grade
            {quiz.section && quiz.section !== "All sections" ? " + section" : ""}.
          </div>
        )}
      </div>

      {error && (
        <div className="bg-paper border border-accent rounded-lg p-3 text-sm text-accent">
          {error}
        </div>
      )}

      {!quizId && !error && (
        <p className="text-sm text-muted italic">
          Pick a quiz above to start entering scores.
        </p>
      )}

      {quizId && !busy && eligible.length === 0 && (
        <p className="text-sm text-muted italic">
          No students match this quiz's grade and section. Add students under the Students tab first.
        </p>
      )}

      {busy && (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Loading scores…
        </p>
      )}

      {quizId && !busy && eligible.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-warm/50">
              <tr className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted">
                <th className="text-start px-4 py-2.5">Student</th>
                <th className="text-start px-4 py-2.5 w-28">Grade · Sec</th>
                <th className="text-start px-4 py-2.5 w-24">Score</th>
                <th className="text-start px-4 py-2.5 w-24">Out of</th>
                <th className="text-start px-4 py-2.5">Feedback</th>
                <th className="px-4 py-2.5 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {eligible.map((s) => {
                const row = scores[s.id] || {};
                const justSaved = savedAt[s.id] && Date.now() - savedAt[s.id] < 2500;
                const saving = savingId === s.id;
                return (
                  <tr key={s.id} className="hover:bg-paper-warm/30">
                    <td className="px-4 py-2.5 text-ink font-medium">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {s.grade}{s.section ? ` · ${s.section}` : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        value={row.score ?? ""}
                        onChange={(e) => setCell(s.id, { score: e.target.value })}
                        className="w-20 px-2 py-1 rounded-md border border-line bg-paper text-sm outline-none focus:border-ink"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        placeholder={String(quiz?.total_marks ?? "")}
                        value={row.max_score ?? ""}
                        onChange={(e) => setCell(s.id, { max_score: e.target.value })}
                        className="w-20 px-2 py-1 rounded-md border border-line bg-paper text-sm outline-none focus:border-ink"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="Optional"
                        value={row.feedback ?? ""}
                        onChange={(e) => setCell(s.id, { feedback: e.target.value })}
                        className="w-full px-2 py-1 rounded-md border border-line bg-paper text-sm outline-none focus:border-ink"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => saveRow(s.id)}
                        disabled={saving || row.score === "" || row.score == null}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-ink text-paper-cool text-[12px] font-medium hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {justSaved ? <Check size={12} /> : <Save size={12} />}
                        {justSaved ? "Saved" : saving ? "…" : "Save"}
                      </button>
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
