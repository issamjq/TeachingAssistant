import React, { useEffect, useState, useMemo } from "react";
import { Search, ClipboardList, GraduationCap, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, getProfile, timeAgo } from "./_shared";
import { useT, useLocale, useStatusLabel } from "../lib/i18n";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");
const parseHM = (hm) => {
  if (!hm) return null;
  const [h, m] = hm.split(":");
  return { h: Number(h), m: Number(m) };
};

// Find the lesson the teacher is most likely "in" right now: prefer one
// whose start..end window contains the current minute; otherwise the
// next future lesson today. Returns { mode: 'live' | 'next' | 'done', lesson }.
function pickNowLesson(lessons) {
  if (!lessons?.length) return { mode: "done", lesson: null };
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  let next = null;
  let nextDelta = Infinity;
  for (const l of lessons) {
    const a = parseHM(l.start_time);
    const b = parseHM(l.end_time);
    if (!a) continue;
    const startM = a.h * 60 + a.m;
    const endM = b ? b.h * 60 + b.m : startM + 55;
    if (nowM >= startM && nowM < endM) {
      return { mode: "live", lesson: l, startM, endM };
    }
    if (startM > nowM && startM - nowM < nextDelta) {
      next = { lesson: l, startM, endM };
      nextDelta = startM - nowM;
    }
  }
  if (next) return { mode: "next", ...next };
  return { mode: "done", lesson: null };
}

// Tick the clock so live counters stay fresh without re-fetching data.
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
}

// The surprise: a Murchid now-playing hero. Drenched warm surface,
// holds the greeting, current/next class, a live countdown, and the
// two primary actions. Reads as a continuation of the landing.
function NowPlayingHero({ me, todayLessons, onJump }) {
  useMinuteTick();
  const t = useT();
  const locale = useLocale();
  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dash.greeting.morning")
      : hour < 17 ? t("dash.greeting.afternoon")
        : t("dash.greeting.evening");
  const first = me?.first_name || t("dash.there");

  const status = useMemo(() => pickNowLesson(todayLessons), [todayLessons]);
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();

  let headline;
  let meta;
  let cta;
  if (status.mode === "live") {
    const l = status.lesson;
    const left = Math.max(0, status.endM - nowM);
    headline = (
      <>
        {t("dash.now.prefix")} <em>{l.title || t("dash.now.yourClass")}</em>{" "}
        {t("dash.now.with")} {l.section || l.grade || t("dash.now.yourGroup")}.
      </>
    );
    meta = (
      <>
        <span>
          <span className="dash-nowcard-pulse" aria-hidden="true" />
          {t("dash.now.live")} · {t("dash.now.minLeft", { n: left })}
        </span>
        <span>{l.subject ? <b>{l.subject}</b> : null} · {fmtTime(l.start_time)}–{fmtTime(l.end_time)}</span>
        <span>{l.location || t("common.none")}</span>
      </>
    );
    cta = t("dash.cta.openClass");
  } else if (status.mode === "next") {
    const l = status.lesson;
    const until = Math.max(0, status.startM - nowM);
    const inText =
      until < 60
        ? t("dash.next.inMin", { n: until })
        : t("dash.next.atTime", { time: fmtTime(l.start_time) });
    headline = (
      <>
        {t("dash.next.prefix")} <em>{l.title || t("dash.next.yourNextClass")}</em> {inText}.
      </>
    );
    meta = (
      <>
        <span><b>{l.section || l.grade || t("common.none")}</b></span>
        <span>{l.subject || t("common.none")} · {fmtTime(l.start_time)}–{fmtTime(l.end_time)}</span>
        <span>{l.location || t("common.none")}</span>
      </>
    );
    cta = t("dash.cta.seeToday");
  } else {
    headline = (
      <>
        {greeting}, <em>{first}</em>{t("dash.clear.mid")} <em>{t("dash.clear.word")}</em>{" "}
        {t("dash.clear.end")}
      </>
    );
    meta = (
      <>
        <span>{today}</span>
        <span>{t("dash.nothingMore")}</span>
      </>
    );
    cta = t("dash.cta.planTomorrow");
  }

  return (
    <section className="dash-nowcard" aria-label={t("dash.nowPlaying")}>
      <div className="dash-nowcard-eyebrow">{today}</div>
      <h1 className="dash-nowcard-h">{headline}</h1>
      <div className="dash-nowcard-meta">{meta}</div>
      <div>
        <button
          type="button"
          className="dash-nowcard-cta"
          onClick={() => onJump?.(status.mode === "done" ? "planner" : "schedule")}
        >
          {cta} <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="dash-nowcard-ghost"
          onClick={() => onJump?.("planner")}
        >
          {t("dash.cta.openPlanner")}
        </button>
      </div>
    </section>
  );
}

export default function Dashboard({ onJump }) {
  const t = useT();
  const locale = useLocale();
  const statusLabel = useStatusLabel();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getProfile().then(setMe).catch(() => {});
    api("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  const counts = data?.counts || {};
  const todayLessons = data?.today_lessons || [];
  const upcomingLessons = data?.upcoming_lessons || [];
  const pendingHomework = data?.pending_homework || [];
  const pendingQuizzes = data?.pending_quizzes || [];
  const recentDrafts = data?.recent_drafts || [];
  const q = query.trim().toLowerCase();
  const filteredDrafts = q
    ? recentDrafts.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.subject || "").toLowerCase().includes(q) ||
          (d.status || "").toLowerCase().includes(q)
      )
    : recentDrafts;

  const kpis = [
    { key: "today",    value: todayLessons.length },
    { key: "ahead",    value: (pendingHomework.length || 0) + (pendingQuizzes.length || 0) },
    { key: "drafts",   value: counts.drafts ?? 0 },
    { key: "students", value: counts.students ?? 0 },
  ];

  // Section header chrome — used by every sub-card so the dashboard
  // reads as one composition rather than five independent cards.
  const SectionHead = ({ title, action, onAction }) => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-serif text-xl md:text-2xl font-medium text-ink">{title}</h2>
      {action && (
        <Button variant="ghost" size="sm" onClick={onAction}>
          {action} <ArrowRight size={13} />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <NowPlayingHero me={me} todayLessons={todayLessons} onJump={onJump} />

      {error && (
        <div className="bg-paper border border-accent/30 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-accent mb-1">
            {t("dash.error")}
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {/* Filter bar — sits above the recent drafts table. Hidden until
          there's anything to filter so it doesn't add noise on a fresh
          account. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.key} className="dash-kpi">
            <p className="dash-kpi-label">{t(`dash.kpi.${k.key}`)}</p>
            <p className="dash-kpi-value">
              {k.value}
              <em className="text-[0.4em] font-serif italic ml-1 text-muted not-italic">
                {" "}{t(`dash.kpi.${k.key}.em`)}
              </em>
            </p>
            <p className="dash-kpi-cap">{t(`dash.kpi.${k.key}.cap`)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <SectionHead
              title={t("dash.today.title")}
              action={t("dash.today.action")}
              onAction={() => onJump?.("schedule")}
            />
            {todayLessons.length === 0 ? (
              <p className="text-sm text-muted py-4">{t("dash.today.empty")}</p>
            ) : (
              <div>
                {todayLessons.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 py-3 ${
                      i < todayLessons.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <span className="text-[11px] font-medium tracking-wider text-muted w-14 mt-1 flex-shrink-0">
                      {fmtTime(s.start_time)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-lg text-ink leading-tight">
                        {s.title} · {s.section || s.grade || ""}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {s.subject ? `${s.subject} · ` : ""}{s.location || t("common.none")} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full border bg-paper-cool text-ink-soft border-line whitespace-nowrap flex-shrink-0">
                      {statusLabel(s.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <SectionHead
              title={t("dash.week.title")}
              action={t("dash.week.action")}
              onAction={() => onJump?.("schedule")}
            />
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-muted py-4">{t("dash.week.empty")}</p>
            ) : (
              <div>
                {upcomingLessons.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 py-2.5 text-sm ${
                      i < upcomingLessons.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted w-20 flex-shrink-0 mt-0.5">
                      {new Date(s.date).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink truncate">{s.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {fmtTime(s.start_time)} · {s.subject || t("common.none")} · {s.section || s.grade || t("common.none")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl md:text-2xl font-medium text-ink inline-flex items-center gap-2">
                <ClipboardList size={18} className="text-accent" /> {t("dash.hw.title")}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => onJump?.("homework")}>
                {t("common.manage")} <ArrowRight size={13} />
              </Button>
            </div>
            {pendingHomework.length === 0 ? (
              <p className="text-sm text-muted py-4">{t("dash.hw.empty")}</p>
            ) : (
              <ul>
                {pendingHomework.map((h, i) => (
                  <li
                    key={h.id}
                    className={`flex items-start justify-between gap-3 py-3 text-sm ${
                      i < pendingHomework.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <div>
                      <p className="text-ink">{h.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {h.subject || t("common.none")} · {h.grade || ""}{h.section ? ` · ${h.section}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted whitespace-nowrap mt-0.5">
                      {h.due_date ? new Date(h.due_date).toLocaleDateString(locale) : t("common.none")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl md:text-2xl font-medium text-ink inline-flex items-center gap-2">
                <GraduationCap size={18} className="text-accent" /> {t("dash.quiz.title")}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => onJump?.("quizzes")}>
                Manage <ArrowRight size={13} />
              </Button>
            </div>
            {pendingQuizzes.length === 0 ? (
              <p className="text-sm text-muted py-4">{t("dash.quiz.empty")}</p>
            ) : (
              <ul>
                {pendingQuizzes.map((q, i) => (
                  <li
                    key={q.id}
                    className={`flex items-start justify-between gap-3 py-3 text-sm ${
                      i < pendingQuizzes.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <div>
                      <p className="text-ink">{q.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {q.subject || t("common.none")} · {q.grade || ""}{q.section ? ` · ${q.section}` : ""} · {t("dash.quiz.marks", { n: q.total_marks ?? "—" })}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted whitespace-nowrap mt-0.5">
                      {q.scheduled_for ? new Date(q.scheduled_for).toLocaleDateString(locale) : t("common.none")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card elevation="flat">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-serif text-xl md:text-2xl font-medium text-ink">{t("dash.drafts.title")}</h2>
            <div className="flex items-center gap-2">
              <div className="bg-paper-cool border border-line rounded-full px-3.5 py-1.5 flex items-center gap-2 w-44 sm:w-56">
                <Search size={14} className="text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("dash.drafts.filter")}
                  className="bg-transparent outline-none text-sm w-full text-ink placeholder:text-muted"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => onJump?.("lesson-plans")}>
                {t("dash.drafts.all")} <ArrowRight size={13} />
              </Button>
            </div>
          </div>
          {filteredDrafts.length === 0 ? (
            <p className="text-sm text-muted py-4">
              {recentDrafts.length === 0
                ? t("dash.drafts.empty")
                : t("dash.drafts.noMatch")}
            </p>
          ) : (
            <div>
              {filteredDrafts.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-4 py-3 text-sm ${
                    i < filteredDrafts.length - 1 ? "border-b border-dashed border-line" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-ink truncate">{d.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {d.subject} · {statusLabel(d.status)} · {d.progress}%
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted whitespace-nowrap">
                    {timeAgo(d.last_edited)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
