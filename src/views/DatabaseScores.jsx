"use client";

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
import { Save, Check, X, Search } from "lucide-react";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";

// "A" should match "Section A" (and vice-versa) so a quiz tagged with
// the long form still surfaces students stored with the short form.
const normSection = (s) =>
  String(s || "").toLowerCase().replace(/^section\s+/, "").trim();

export default function DatabaseScores() {
  const [quizzes, setQuizzes] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});  // student_id → { score, max_score, feedback }
  const [quizId, setQuizId] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savedAt, setSavedAt] = useState({}); // student_id → ms timestamp
  const [error, setError] = useState(null);
  const [matchOnly, setMatchOnly] = useState(true); // filter to quiz's grade+section
  const [query, setQuery] = useState("");           // free-text name search

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

  // A student "matches" the quiz when their grade lines up AND their
  // section either matches (loose — "A" == "Section A") or the quiz
  // is for all sections / they have no section recorded.
  const matchesQuiz = (s) => {
    if (!quiz) return false;
    if (quiz.grade && s.grade && quiz.grade !== s.grade) return false;
    const qSec = quiz.section;
    const sSec = s.section;
    if (qSec && qSec !== "All sections" && sSec) {
      if (normSection(qSec) !== normSection(sSec)) return false;
    }
    return true;
  };

  // Always show every student by default — teachers can score anyone
  // regardless of grade/section. The matchOnly toggle narrows to the
  // quiz's grade + section when on; the search box overlays on top.
  const eligible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students;
    if (quiz && matchOnly) list = list.filter(matchesQuiz);
    if (q) {
      list = list.filter((s) =>
        `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase().includes(q)
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, quiz, matchOnly, query]);

  // How many of the all-students set match the quiz, so the filter
  // chip can show "Matching 4 of 27" instead of just "Matching".
  const matchCount = useMemo(
    () => (quiz ? students.filter(matchesQuiz).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, quiz]
  );

  // Auto-pick the right default per quiz so the teacher never sees a
  // confusing "0 students" screen. If at least one student matches the
  // quiz's grade + section, narrow to them; otherwise just show the
  // full roster with an explanatory note in the chip slot.
  useEffect(() => {
    if (!quiz) return;
    setMatchOnly(matchCount > 0);
  }, [quiz, matchCount]);

  // Rows edited since their last save — what "Save all" writes. Thirty
  // students used to mean thirty Save clicks; now it is one.
  const [dirty, setDirty] = useState(() => new Set());
  const [savingAll, setSavingAll] = useState(false);

  const setCell = (sid, patch) => {
    setScores((m) => ({ ...m, [sid]: { ...(m[sid] || {}), ...patch } }));
    setDirty((d) => new Set(d).add(sid));
  };

  const postRow = (sid) => {
    const row = scores[sid] || {};
    return api("/api/quiz-scores", {
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
  };

  const clearDirty = (sid) =>
    setDirty((d) => {
      const next = new Set(d);
      next.delete(sid);
      return next;
    });

  const saveRow = async (sid) => {
    const row = scores[sid] || {};
    if (row.score === "" || row.score == null) return;
    setSavingId(sid);
    setError(null);
    try {
      await postRow(sid);
      setSavedAt((m) => ({ ...m, [sid]: Date.now() }));
      clearDirty(sid);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Every edited row with a score, in one press. Sequential, and a
   * failure stops with the untouched rows still marked unsaved — so
   * what is green is exactly what reached the database.
   */
  const saveAll = async () => {
    const targets = [...dirty].filter((sid) => {
      const row = scores[sid];
      return row && row.score !== "" && row.score != null;
    });
    if (!targets.length || savingAll) return;
    setSavingAll(true);
    setError(null);
    for (const sid of targets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await postRow(sid);
        setSavedAt((m) => ({ ...m, [sid]: Date.now() }));
        clearDirty(sid);
      } catch (e) {
        setError(`Stopped at a save that failed: ${e.message}. Rows already saved are marked.`);
        break;
      }
    }
    setSavingAll(false);
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
            className="w-full px-3 py-2 rounded-lg border border-line bg-paper-cool text-sm text-ink outline-none focus:border-accent"
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
        {dirty.size > 0 && (
          <button
            type="button"
            onClick={saveAll}
            disabled={savingAll}
            className="murchid-pressable murchid-focus inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper-cool disabled:opacity-60"
          >
            <Save size={13} />
            {savingAll
              ? "Saving…"
              : `Save all changes (${dirty.size})`}
          </button>
        )}
      </div>

      {/* Filter chip + name search — shown once a quiz is picked.
          The chip auto-narrows to the quiz's grade + section IF anyone
          matches; otherwise it sits in "showing all" mode with an
          explanatory note so the teacher never sees a confusing 0-row
          screen. Both states are one click away from the other. */}
      {quizId && (
        <div className="flex flex-wrap items-center gap-2">
          {matchOnly ? (
            <button
              type="button"
              onClick={() => setMatchOnly(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/[0.10] text-accent border border-accent/30 text-[12px] font-medium hover:bg-accent/[0.16] transition-colors"
              title="Click to show all students"
            >
              Matching {quiz?.grade}
              {quiz?.section && quiz.section !== "All sections" ? ` · ${quiz.section}` : ""}
              <span className="opacity-70">({matchCount} of {students.length})</span>
              <X size={12} />
            </button>
          ) : matchCount === 0 ? (
            // Auto-fallback: no one matches this quiz's grade + section,
            // so we're showing all students. Frame it as info, not as
            // an action — teachers don't need to know there's a chip
            // they could have toggled.
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-warm border border-line text-[12px] text-ink-soft">
              No one in your roster is tagged
              {quiz?.grade ? ` ${quiz.grade}` : ""}
              {quiz?.section && quiz.section !== "All sections" ? ` · ${quiz.section}` : ""}
              {" — showing all "}{students.length}{" students."}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setMatchOnly(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-cool border border-line text-[12px] font-medium text-ink-soft hover:border-ink transition-colors"
            >
              Showing all {students.length} — re-apply match ({matchCount})
            </button>
          )}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full ps-9 pe-3 py-1.5 rounded-full border border-line bg-paper-cool text-sm text-ink placeholder:text-muted outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

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

      {quizId && !busy && eligible.length === 0 && students.length === 0 && (
        <p className="text-sm text-muted italic">
          You don't have any students yet — add them under the Students tab first.
        </p>
      )}

      {quizId && !busy && eligible.length === 0 && students.length > 0 && query && (
        <p className="text-sm text-muted italic">
          No students match "{query}".
        </p>
      )}

      {busy && <BrandLoader compact fullscreen={false} />}

      {quizId && !busy && eligible.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
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
                        className="w-20 px-2 py-1 rounded-md border border-line bg-paper text-sm outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        placeholder={String(quiz?.total_marks ?? "")}
                        value={row.max_score ?? ""}
                        onChange={(e) => setCell(s.id, { max_score: e.target.value })}
                        className="w-20 px-2 py-1 rounded-md border border-line bg-paper text-sm outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="Optional"
                        value={row.feedback ?? ""}
                        onChange={(e) => setCell(s.id, { feedback: e.target.value })}
                        className="w-full px-2 py-1 rounded-md border border-line bg-paper text-sm outline-none focus:border-accent"
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
        </div>
      )}
    </div>
  );
}
