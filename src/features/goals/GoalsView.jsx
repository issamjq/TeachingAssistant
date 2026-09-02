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
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Target, Plus, Upload, FileText, Trash2, Sparkles, X, ArrowRight,
} from "lucide-react";
import { api } from "@/views/_shared";
import { uploadMaterial } from "@/features/materials";
import s from "./Goals.module.css";
import PlanningProgress from "./PlanningProgress";

/**
 * How long she has, in her own words.
 *
 * This was five fixed buttons — 2 weeks, 4, 6, a term, two terms — and a
 * teacher's real answer is almost never one of them. She has until the mocks
 * on the 30th, or ten days, or three weeks before the trip. Forcing that into
 * the nearest chip either lied to the planner or made her round her own term
 * up by a fortnight.
 *
 * So she types it, and this reads it. Deliberately forgiving: anything it
 * cannot parse falls back to six weeks rather than blocking her, and what it
 * understood is echoed under the box so a misreading is visible before she
 * commits to a plan built on it.
 */
export function daysFromTimeline(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return null;

  const num = (m) => Number(m[1]);
  let m;

  if ((m = t.match(/(\d+)\s*(day|days)\b/))) return num(m);
  if ((m = t.match(/(\d+)\s*(week|weeks|wk|wks)\b/))) return num(m) * 7;
  if ((m = t.match(/(\d+)\s*(month|months)\b/))) return num(m) * 30;
  if ((m = t.match(/(\d+)\s*(term|terms)\b/))) return num(m) * 84;

  // "a week", "a term", "two weeks" — words where a teacher would use them.
  const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  if ((m = t.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month|term)s?\b/))) {
    const n = WORDS[m[1]] ?? 1;
    return n * ({ day: 1, week: 7, month: 30, term: 84 })[m[2]];
  }
  if (/\bfortnight\b/.test(t)) return 14;
  if (/\bterm\b/.test(t)) return 84;
  if (/\bsemester\b/.test(t)) return 126;
  if (/\byear\b/.test(t)) return 252;

  /**
   * A date she is working towards — "by 30 october", "until the 12th".
   * Counted from today, because that is what "how long have I got" means.
   */
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mon = MONTHS.findIndex((x) => new RegExp(`\\b${x}`).test(t));
  const dom = t.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
  if (dom) {
    const day = Number(dom[1]);
    if (day >= 1 && day <= 31) {
      const now = new Date();
      let when = new Date(now.getFullYear(), mon >= 0 ? mon : now.getMonth(), day);
      if (when < now) when = new Date(now.getFullYear() + (mon >= 0 ? 1 : 0), (mon >= 0 ? mon : now.getMonth() + 1), day);
      const diff = Math.ceil((when - now) / 86_400_000);
      if (diff > 0 && diff < 400) return diff;
    }
  }
  return null;
}

/** Said back to her, so a misreading is caught before it becomes a plan. */
function readableSpan(days) {
  if (!days) return "";
  if (days % 7 === 0 && days >= 7) {
    const w = days / 7;
    return `${days} days — about ${w} week${w === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

const STATUS_LABEL = {
  processing: "awaiting plan",
  active: "in progress",
  achieved: "achieved",
  abandoned: "set aside",
  failed: "failed",
};

// The shared upload — same row, same bucket folder rules, and the file
// lands on her shelf instead of being invisible after this one plan.
// A syllabus attached here is exactly the file the curriculum work will
// want to read later, so it must not be a one-off.
async function uploadGoalMaterial(file) {
  const att = await uploadMaterial(file, { where: "goals", kind: "syllabus" });
  return { id: att.id, file_name: att.name };
}

function NewGoal({ onCreated, onClose }) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [timeline, setTimeline] = useState("");
  // Parsed as she types, so what the planner will be told is always on screen.
  const days = daysFromTimeline(timeline);
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
        const row = await uploadGoalMaterial(f);
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
        // Six weeks when she left it blank — the planner needs a number, and
        // refusing to create the goal over an unparsed phrase would lose the
        // brief and the upload she has already done.
        body: { title, brief, timeline_days: days ?? 42, material_ids: docs.map((d) => d.id) },
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
          <label className={s.label} htmlFor="goal-timeline">
            How long have you got?
          </label>
          <input
            id="goal-timeline"
            className={s.field}
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            placeholder='e.g. "2 weeks", "10 days", "until the mocks on 30 October"'
          />
          <p className="text-[12px] text-muted mt-1.5">
            {days
              ? `Planning for ${readableSpan(days)}.`
              : timeline.trim()
                ? "Not sure what that means — say it as days, weeks, or a date to work towards."
                : "Days, weeks, a term, or the date you are working towards."}
          </p>
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
            {/* Says what it does now that it also plans — a button labelled
                "create" that then spends a minute generating reads as a hang. */}
            <Target size={15} /> {busy ? "Creating…" : "Create goal & plan it"}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * The plan, week by week and day by day.
 *
 * Lifted out of the card so one rendering serves both places it is read:
 * nowhere on the card any more, and in full in the drawer. It used to be
 * an accordion inside the card, which meant a ten-week plan pushed every
 * goal below it off the screen the moment it opened — the list stopped
 * being a list.
 */
function GoalPlan({ weeks }) {
  return (
    <div className="space-y-6">
      {weeks.map((w, i) => (
        <div key={i} className={s.week}>
          <p className={s.weekNum}>Week {w.week ?? i + 1}</p>
          <p className="text-[17px] font-serif font-semibold text-ink mt-1 leading-snug">{w.focus}</p>
          {/* Days are the plan now. `lessons` is what plans made before
              this looked like, and they still open. */}
          {Array.isArray(w.days) && w.days.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {w.days.map((d, j) => (
                <li key={j} className="flex gap-3">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent shrink-0 mt-[5px]">
                    Day {d.day ?? j + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] text-ink font-semibold leading-snug">
                      {d.title}
                    </span>
                    {d.outline && (
                      <span className="block text-[13.5px] text-ink-soft leading-relaxed mt-1">
                        {d.outline}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : Array.isArray(w.lessons) && w.lessons.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {w.lessons.map((l, j) => (
                <li key={j} className="text-[14px] text-ink-soft">
                  · {typeof l === "string" ? l : l.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GoalCard({ goal, onDelete, onPlan, onOpen, planning, planError }) {
  const weeks = goal.plan?.weeks;
  const weeksTotal = goal.timeline_days ? Math.round(goal.timeline_days / 7) : null;

  const hasPlan = Array.isArray(weeks) && weeks.length > 0;

  /**
   * The card IS the button.
   *
   * A link at the bottom made the teacher aim at four words to reach
   * something the whole card is about; everything on it — the title, the
   * brief, the verdict — is a summary of what the drawer holds, so the
   * whole card should open it. The controls inside stop the click from
   * reaching this: deleting a goal and reading it are not the same
   * intention, and a card that opens when you meant to delete is worse
   * than one that never opened at all.
   */
  const openIfPlanned = () => { if (hasPlan) onOpen(goal); };

  return (
    <section
      className={`${s.glass} p-5 ${hasPlan ? s.cardTap : ""}`}
      {...(hasPlan && {
        role: "button",
        tabIndex: 0,
        "aria-label": `Open the plan for ${goal.title}`,
        onClick: openIfPlanned,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIfPlanned(); }
        },
      })}
    >
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
          onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }}
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

      {/* A sign, not a second control. The card already carries the click;
          a button here would be a second tab stop for the same action and
          a smaller target for it. */}
      {hasPlan && (
        <span className={`${s.planHint} mt-4`} aria-hidden="true">
          See the plan — {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
          <ArrowRight size={13} />
        </span>
      )}

      {/* While it is working, the panel replaces the button entirely: a
          disabled button reading "Planning…" is the thing that looked like
          a hang, and leaving it beside a progress panel would say the same
          thing twice. */}
      {goal.status === "processing" && planning === goal.id && (
        <PlanningProgress weeks={weeksTotal} />
      )}

      {goal.status === "processing" && planning !== goal.id && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlan(goal.id); }}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Sparkles size={14} />
            Plan it with AI
          </button>
          {planError?.id === goal.id && (
            <p className="text-[12.5px] text-ink-soft flex-1 min-w-[220px]">{planError.message}</p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The plan, opened beside the list.
 *
 * Modelled on the template library's detail drawer so the two read as the
 * same gesture: click a card, its full contents arrive from the edge, and
 * the list stays exactly where it was underneath. An accordion moved the
 * page out from under the teacher every time she opened one.
 *
 * Escape closes it, the scrim closes it, and the body stops scrolling
 * while it is open — a drawer that lets the page scroll behind it loses
 * the reader's place, which is the one thing this was meant to protect.
 */
function GoalDetail({ goal, onClose }) {
  const weeks = goal.plan?.weeks;
  const weeksTotal = goal.timeline_days ? Math.round(goal.timeline_days / 7) : null;
  const [leaving, setLeaving] = useState(false);

  /**
   * It slides out the way it slid in.
   *
   * Unmounting on the click took the panel off the screen in a single
   * frame, which reads as a crash rather than a close — the eye has
   * nothing to follow back to the list. So the close is announced first,
   * the exit animation runs, and the component goes when it has finished.
   *
   * Reduced motion skips straight to gone: there is no animation to watch
   * and a delay with nothing happening in it is just a slow app.
   */
  const close = useCallback(() => {
    const still = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) { onClose(); return; }
    setLeaving(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <>
      <div
        className={s.overlay}
        data-leaving={leaving || undefined}
        /**
         * Closes on a press that STARTS on the scrim, not on a click that
         * merely ends there.
         *
         * The card's click paints the scrim under the cursor, so the tail
         * of that same press lands on a surface that did not exist when
         * the press began — and closing on it shut the drawer in the act
         * of opening. A mousedown the scrim actually received is always a
         * new intention.
         */
        onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
        aria-hidden="true"
      />
      <aside
        className={s.drawer}
        data-leaving={leaving || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={`Plan for ${goal.title}`}
      >
        <header className={s.drawerHead}>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-serif text-[26px] font-semibold text-ink leading-[1.15]">
                {goal.title}
              </h2>
              <span className={s.chip} data-status={goal.status}>
                {STATUS_LABEL[goal.status] || goal.status}
              </span>
            </div>
            <p className="text-[13.5px] text-muted mt-1.5">
              {[
                weeksTotal ? `${weeksTotal} week${weeksTotal === 1 ? "" : "s"}` : null,
                Array.isArray(weeks) && weeks.length
                  ? `${weeks.length} planned`
                  : null,
                goal.material_ids?.length
                  ? `${goal.material_ids.length} file${goal.material_ids.length === 1 ? "" : "s"} attached`
                  : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={s.closeBtn}
          >
            <X size={16} />
          </button>
        </header>

        <div className={s.drawerBody}>
          {/* Full, not clamped. On the card the brief is two lines because
              the card is a summary; here there is room for what it says. */}
          {goal.plan?.brief && (
            <p className="text-[15px] text-ink-soft leading-relaxed">{goal.plan.brief}</p>
          )}
          {goal.ai_verdict && (
            <p className="text-[14.5px] text-ink mt-4 border-s-2 border-accent/40 ps-4 italic leading-relaxed">
              {goal.ai_verdict}
            </p>
          )}
          {Array.isArray(weeks) && weeks.length > 0 && (
            <div className="mt-5">
              <GoalPlan weeks={weeks} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default function GoalsView() {
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(null);
  const [planError, setPlanError] = useState(null);
  // Which goal's plan is open beside the list, if any.
  const [openGoal, setOpenGoal] = useState(null);

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
      // Not charged here: /api/studio/goal-plan meters itself from the
      // tokens it spent, and billing again from the browser took the
      // credits twice.
      if (res?.unread_materials?.length) {
        setPlanError({
          id,
          message:
            `Planned — but ${res.unread_materials.length === 1 ? "one attached file" : `${res.unread_materials.length} attached files`} ` +
            `could not be read and did not shape the plan: ${res.unread_materials.join(", ")}.`,
        });
      }
    } catch (e) {
      /**
       * A plan that finished after the connection did.
       *
       * Planning a term takes longer than the proxy in front of this app will
       * hold a connection open for — it cuts the request at thirty seconds
       * while the service is still writing. The work is not lost: the planner
       * writes the plan to the goal itself and only then replies, so the row
       * is already correct by the time the browser gives up.
       *
       * So a dropped connection is not reported as a failure until the goal
       * has been asked whether it was, in fact, planned.
       */
      const planned = await waitForPlan(id);
      if (planned) {
        setGoals((g) => g.map((x) => (x.id === id ? { ...x, ...planned } : x)));
        return;
      }
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

  /**
   * Poll the goal until its plan appears, or until waiting stops being
   * reasonable. Four minutes is longer than any plan has taken and short
   * enough that a genuine failure is still reported while she is watching.
   */
  const waitForPlan = async (id) => {
    const deadline = Date.now() + 4 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4_000));
      try {
        const rows = await api("/api/goals");
        const row = (Array.isArray(rows) ? rows : rows?.goals ?? []).find((x) => x.id === id);
        if (row?.plan?.weeks?.length) return row;
      } catch {
        // The service is busy writing the plan; ask again.
      }
    }
    return null;
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
          {/* Says what this screen does, and stops there. It used to promise
              that Murchid "then drafts the lessons, quizzes and materials for
              each week as you go" — it does not: the plan is a teaching
              sequence, and the drafting happens when you take a day into the
              AI Studio yourself. Copy that describes an unbuilt feature reads
              as a broken one. */}
          Name the goal, attach the syllabus or textbook, pick a timeline. Murchid breaks it
          into a week-by-week teaching plan built around your subjects and your way of
          teaching — day by day, with what to cover and what to watch out for. Take any day
          into the AI Studio when you want the materials for it.
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
          /**
           * Creating a goal starts the plan.
           *
           * "Create goal" wrote the row and stopped, leaving a card that said
           * "awaiting plan" beside a second button she had to find and press
           * to get the thing she came for. Nobody creates a goal in order to
           * not plan it. The card appears filled in and already working, and
           * the button below stays for the retries that need it.
           */
          onCreated={(g) => {
            setGoals((x) => [g, ...(x || [])]);
            setCreating(false);
            plan(g.id);
          }}
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
          onOpen={setOpenGoal}
          planning={planning}
          planError={planError}
        />
      ))}

      {/* Read from the LIST, not from the click: re-planning a goal while
          its drawer is open should update what the drawer is showing
          rather than leave a stale copy of the row on screen. */}
      {openGoal && (
        <GoalDetail
          goal={goals?.find((g) => g.id === openGoal.id) ?? openGoal}
          onClose={() => setOpenGoal(null)}
        />
      )}
    </div>
  );
}
