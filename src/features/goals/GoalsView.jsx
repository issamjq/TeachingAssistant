"use client";

// =====================================================================
// Goal planner
//
// The biggest thing a teacher can hand the system: a whole portion of a
// subject — a term, a unit, a book — with a deadline. The AI breaks it
// into a week-by-week teaching plan grounded in the teacher's own
// profile (their subjects, grades, qualifications and skills), with the
// lessons, quizzes and materials for each week generated into the
// library as the plan is worked through.
//
// What happens where matters here:
//   - the goal, its brief, its timeline and its attached materials are
//     all saved from the browser, through RLS — that part works today
//   - the PLANNING is a model call, and the model key lives on the API
//     service. Until that service is connected, planning is asked for
//     and honestly declined — but nothing the teacher typed is lost.
//
// Materials go browser → Supabase Storage under the teacher's own
// session, the same path the CV upload takes: the file never passes
// through a server, because a server-side upload would need a
// service-role key nothing in this system holds.
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import {
  Target, Plus, Upload, FileText, Trash2, Sparkles, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "@/views/_shared";
import { supabase } from "@/lib/supabaseClient";
import { facultyId } from "@/lib/data/session";
import s from "./Goals.module.css";

/** Weeks on offer. Days in the row, words on the buttons. */
const TIMELINES = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 42, label: "6 weeks" },
  { days: 84, label: "A term" },
  { days: 168, label: "Two terms" },
];

const STATUS_LABEL = {
  processing: "awaiting plan",
  active: "in progress",
  achieved: "achieved",
  abandoned: "set aside",
  failed: "failed",
};

const safeName = (name) =>
  name.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(-80) || "document";

/**
 * Upload one syllabus/textbook file and register it as a material.
 *
 * Storage first, then the materials row pointing at it — the same
 * two-step the CV upload uses, under the teacher's own session.
 */
async function uploadMaterial(file) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("You're not signed in.");
  const fid = await facultyId();

  const path = `${uid}/goals/${Date.now()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("imports").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("materials")
    .insert({ faculty_id: fid, file_name: file.name, file_path: path, mime_type: file.type, status: "uploaded" })
    .select("id, file_name")
    .single();
  if (error) throw error;
  return data;
}

function NewGoal({ onCreated, onClose }) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [days, setDays] = useState(42);
  const [docs, setDocs] = useState([]);          // { id, file_name }
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) throw new Error(`"${f.name}" is over 25 MB.`);
        const row = await uploadMaterial(f);
        setDocs((d) => [...d, row]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const goal = await api("/api/goals", {
        method: "POST",
        body: { title, brief, timeline_days: days, material_ids: docs.map((d) => d.id) },
      });
      onCreated(goal);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className={`${s.glass} p-5 md:p-6`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className={s.eyebrow}>New goal</p>
          <h2 className="font-serif text-xl font-semibold text-ink mt-1">
            What should your students master?
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid place-items-center w-8 h-8 rounded-full text-muted hover:bg-paper-warm hover:text-ink transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div>
          <label className={s.label} htmlFor="goal-title">Goal</label>
          <input
            id="goal-title"
            className={s.field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Grade 9 — Forces & Motion, full unit"'
            maxLength={140}
          />
        </div>

        <div>
          <label className={s.label} htmlFor="goal-brief">
            What it covers <span className="font-normal text-muted">— the more you say, the better the plan</span>
          </label>
          <textarea
            id="goal-brief"
            className={s.field}
            rows={4}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Chapters, topics, what the class already knows, where they struggle, how you like to teach it…"
            maxLength={4000}
          />
        </div>

        <div>
          <span className={s.label}>Timeline</span>
          <div className={s.seg} role="radiogroup" aria-label="Timeline">
            {TIMELINES.map((t) => (
              <button
                key={t.days}
                type="button"
                role="radio"
                aria-checked={days === t.days}
                className={s.segBtn}
                data-on={days === t.days}
                onClick={() => setDays(t.days)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={s.label}>
            Syllabus or textbook <span className="font-normal text-muted">— optional, PDFs</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {docs.map((d) => (
              <span key={d.id} className={s.doc}>
                <FileText size={13} className="text-accent flex-shrink-0" />
                <span className="max-w-[220px] truncate">{d.file_name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${d.file_name}`}
                  onClick={() => setDocs((x) => x.filter((y) => y.id !== d.id))}
                  className="text-muted hover:text-ink cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`${s.doc} cursor-pointer hover:border-accent transition-colors disabled:opacity-50`}
            >
              <Upload size={13} />
              {uploading ? "Uploading…" : "Attach files"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={pick}
            />
          </div>
        </div>

        {error && <p className="text-sm text-crit">{error}</p>}

        <div className="pt-1">
          <button
            type="button"
            onClick={create}
            disabled={!title.trim() || busy}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40"
          >
            <Target size={15} /> {busy ? "Saving…" : "Create goal"}
          </button>
        </div>
      </div>
    </section>
  );
}

function GoalCard({ goal, onDelete, onPlan, planning, planError }) {
  const [open, setOpen] = useState(false);
  const weeks = goal.plan?.weeks;
  const weeksTotal = goal.timeline_days ? Math.round(goal.timeline_days / 7) : null;

  return (
    <section className={`${s.glass} p-5`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-serif text-lg font-semibold text-ink leading-tight">{goal.title}</h3>
            <span className={s.chip} data-status={goal.status}>
              {STATUS_LABEL[goal.status] || goal.status}
            </span>
          </div>
          <p className="text-[12.5px] text-muted mt-1">
            {[
              weeksTotal ? `${weeksTotal} week${weeksTotal === 1 ? "" : "s"}` : null,
              goal.material_ids?.length
                ? `${goal.material_ids.length} file${goal.material_ids.length === 1 ? "" : "s"} attached`
                : null,
              goal.plan?.brief ? null : "no brief",
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(goal.id)}
          aria-label={`Delete goal ${goal.title}`}
          className="grid place-items-center w-8 h-8 rounded-full text-muted hover:text-crit hover:bg-paper-warm transition-colors cursor-pointer flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {goal.plan?.brief && (
        <p className="text-[13px] text-ink-soft mt-3 leading-relaxed line-clamp-2">{goal.plan.brief}</p>
      )}

      {goal.ai_verdict && (
        <p className="text-[13px] text-ink mt-3 border-s-2 border-accent/40 ps-3 italic">
          {goal.ai_verdict}
        </p>
      )}

      {/* The plan itself, once the service has written one. */}
      {Array.isArray(weeks) && weeks.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:text-accent-hover transition-colors cursor-pointer"
            aria-expanded={open}
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {open ? "Hide the plan" : `See the plan — ${weeks.length} weeks`}
          </button>
          {open && (
            <div className="mt-3 space-y-3">
              {weeks.map((w, i) => (
                <div key={i} className={s.week}>
                  <p className={s.weekNum}>Week {w.week ?? i + 1}</p>
                  <p className="text-[13.5px] text-ink mt-0.5">{w.focus}</p>
                  {Array.isArray(w.lessons) && w.lessons.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {w.lessons.map((l, j) => (
                        <li key={j} className="text-[12.5px] text-ink-soft">
                          · {typeof l === "string" ? l : l.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {goal.status === "processing" && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => onPlan(goal.id)}
            disabled={planning === goal.id}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={14} />
            {planning === goal.id ? "Planning…" : "Plan it with AI"}
          </button>
          {planError?.id === goal.id && (
            <p className="text-[12.5px] text-ink-soft flex-1 min-w-[220px]">{planError.message}</p>
          )}
        </div>
      )}
    </section>
  );
}

export default function GoalsView() {
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(null);
  const [planError, setPlanError] = useState(null);

  useEffect(() => {
    let live = true;
    api("/api/goals")
      .then((r) => live && setGoals(r))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  const plan = async (id) => {
    setPlanning(id);
    setPlanError(null);
    try {
      // The planner lives on the API service — it needs the model key and
      // reads the teacher's skills server-side. See todo/backend/01.
      const res = await api("/api/studio/goal-plan", { method: "POST", body: { goal_id: id } });
      // The service answers { goal, unread_materials }. Spreading the raw
      // envelope onto the row left status/plan untouched, so a finished
      // plan looked like the button had done nothing.
      const updated = res?.goal ?? res;
      setGoals((g) => g.map((x) => (x.id === id ? { ...x, ...updated } : x)));
      if (res?.unread_materials?.length) {
        setPlanError({
          id,
          message:
            `Planned — but ${res.unread_materials.length === 1 ? "one attached file" : `${res.unread_materials.length} attached files`} ` +
            `could not be read and did not shape the plan: ${res.unread_materials.join(", ")}.`,
        });
      }
    } catch (e) {
      setPlanError({
        id,
        message:
          e.code === "no_backend"
            ? "The AI planner isn't connected yet. Your goal and files are saved — planning will work the moment the API service is up."
            : e.message,
      });
    } finally {
      setPlanning(null);
    }
  };

  const remove = async (id) => {
    const prev = goals;
    setGoals((g) => g.filter((x) => x.id !== id));
    try {
      await api(`/api/goals/${id}`, { method: "DELETE" });
    } catch (e) {
      setGoals(prev);                       // the delete failed; put it back
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* What this screen IS — worth a loud card because no other LMS
          screen looks like it, and a teacher landing here cold should
          get it in one read. */}
      <section className={`${s.loud} p-6 md:p-7`}>
        <p className={s.loudEyebrow}>Goal planner</p>
        <h1 className="font-serif text-[26px] md:text-[32px] leading-[1.1] font-medium mt-2 max-w-2xl">
          Hand over a whole unit — <em className="italic">get a term taught like an expert planned it.</em>
        </h1>
        <p className={`${s.loudSub} text-sm mt-2.5 max-w-2xl leading-relaxed`}>
          Name the goal, attach the syllabus or textbook, pick a timeline. Murchid breaks it
          into a week-by-week plan built around your subjects and your way of teaching —
          then drafts the lessons, quizzes and materials for each week as you go.
        </p>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-on-accent text-accent text-sm font-semibold hover:shadow-lg transition-shadow cursor-pointer"
          >
            <Plus size={16} /> New goal
          </button>
        )}
      </section>

      {creating && (
        <NewGoal
          onClose={() => setCreating(false)}
          onCreated={(g) => { setGoals((x) => [g, ...(x || [])]); setCreating(false); }}
        />
      )}

      {error && (
        <div className={`${s.glass} p-4`}>
          <p className={s.eyebrow}>Could not load goals</p>
          <p className="text-sm text-ink-soft mt-1">{error}</p>
        </div>
      )}

      {goals === null && !error && (
        <div className={`${s.glass} p-5`}>
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-56 rounded bg-line/50" />
            <div className="h-4 w-40 rounded bg-line/50" />
          </div>
        </div>
      )}

      {goals?.length === 0 && !creating && (
        <div className={`${s.glass} p-6 text-center`}>
          <p className="text-sm text-ink">No goals yet.</p>
          <p className="text-xs text-muted mt-1">
            Start with one unit you're teaching this term — it takes a minute.
          </p>
        </div>
      )}

      {goals?.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          onDelete={remove}
          onPlan={plan}
          planning={planning}
          planError={planError}
        />
      ))}
    </div>
  );
}
