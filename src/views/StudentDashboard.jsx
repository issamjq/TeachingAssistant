"use client";

// Student dashboard — a student's own world. Assigned work with their
// attempt, a scoreline, attendance, and typed-in marks. Reads
// /api/student/dashboard, which maps to the student_dashboard() RPC scoped
// (via current_student_id) to the caller's own rows only.

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Clock, Percent, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "./_shared";
import { LineChart } from "../components/MiniCharts";
import { Skeleton } from "@/components/ui/skeleton";

const pct = (score, max) => (score != null && max ? Math.round((score / max) * 100) : null);

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/student/dashboard")
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const work = data?.work || [];
  const scores = data?.scores || [];
  const att = data?.attendance || {};
  const grades = data?.grades || [];

  const kpis = useMemo(() => {
    const submitted = work.filter((w) => w.submitted_at).length;
    const graded = scores.filter((s) => s.score != null && s.max_score);
    const avg = graded.length
      ? Math.round(graded.reduce((a, s) => a + s.score / s.max_score * 100, 0) / graded.length)
      : null;
    const attRate = att.total ? Math.round((att.present / att.total) * 100) : null;
    return { assigned: work.length, submitted, pending: work.length - submitted, avg, attRate };
  }, [work, scores, att]);

  // Scoreline oldest → newest, as a percentage series for the line chart.
  const scoreSeries = useMemo(
    () =>
      [...scores]
        .filter((s) => s.score != null && s.max_score)
        .reverse()
        .map((s, i) => ({ day: (s.submitted_at || `#${i}`).slice(0, 10), n: pct(s.score, s.max_score) })),
    [scores]
  );

  if (loading) return <StudentSkeleton />;
  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  /**
   * Between classes — invited by nobody, right now.
   *
   * Their teacher removed them, or the term ended. Nothing is wrong with
   * the account and there is nothing for them to do, so the screen says
   * exactly that instead of rendering six empty charts.
   */
  if (data.no_classes) {
    const who = [data.student?.first_name, data.student?.last_name].filter(Boolean).join(" ");
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> No classes yet
        </p>
        <h2 className="font-serif text-3xl text-ink mb-3">
          {who ? `Hello, ${who}` : "You're signed in"}
        </h2>
        <p className="text-muted mb-2">
          You&rsquo;re not in any classes at the moment, so there&rsquo;s nothing here yet.
        </p>
        <p className="text-sm text-muted">
          When a teacher adds you to their class, your lessons, homework and quizzes will
          appear on this page automatically — you won&rsquo;t need to sign up again.
          {data.student?.email ? (
            <> Ask them to invite <span className="text-ink">{data.student.email}</span>.</>
          ) : null}
        </p>
      </div>
    );
  }

  const s = data.student || {};
  // A student can be on several teachers' rosters — each is a separate row
  // with its own subject. One dashboard shows all of it, so the subject and
  // the teacher have to travel with each item or "Unit 4 quiz" tells them
  // nothing about whose it is. With a single teacher none of that is worth
  // the column, and it is hidden.
  const teachers = data.teachers || [];
  const multi = teachers.length > 1;

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> My work
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
          Hi <em className="italic font-light text-accent">{s.first_name || "there"}</em>
        </h2>
        <p className="text-muted mt-2 text-sm md:text-base">
          {[s.grade && `Grade ${s.grade}`, s.section, s.school].filter(Boolean).join(" · ") || "Your assigned work at a glance."}
        </p>
      </div>

      {multi && (
        <div className="flex flex-wrap gap-2">
          {teachers.map((t) => (
            <span
              key={t.student_row_id}
              className="inline-flex items-baseline gap-2 rounded-lg border border-line bg-paper px-3 py-1.5"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink">
                {t.subject || "Class"}
              </span>
              {t.teacher && (
                <span className="font-serif italic text-[12px] text-muted">{t.teacher}</span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={<BookOpen size={14} />} label="Assigned" value={kpis.assigned} sub="pieces of work" />
        <Kpi icon={<CheckCircle2 size={14} />} label="Submitted" value={kpis.submitted} sub="done" />
        <Kpi icon={<Clock size={14} />} label="To do" value={kpis.pending} sub="not yet submitted" accent={kpis.pending > 0} />
        <Kpi icon={<Percent size={14} />} label="Average" value={kpis.avg != null ? `${kpis.avg}%` : "—"} sub="graded work" />
        <Kpi icon={<CalendarCheck size={14} />} label="Attendance" value={kpis.attRate != null ? `${kpis.attRate}%` : "—"} sub={`${att.present || 0}/${att.total || 0} present`} />
      </div>

      {scoreSeries.length > 1 && (
        <Card>
          <CardContent>
            <ChartHeader label="Scores" sub="Your recent results, oldest to newest (%)" />
            <LineChart data={scoreSeries} label="scores" />
          </CardContent>
        </Card>
      )}

      {/* Assigned work with status */}
      <Card>
        <CardContent>
          <ChartHeader
            label="Work"
            sub={multi ? "Everything assigned to you, across all your teachers" : "Everything assigned to your classes"}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-2 font-medium">Title</th>
                  <th className="text-left py-3 font-medium">Type</th>
                  {multi && <th className="text-left py-3 font-medium">Subject</th>}
                  <th className="text-left py-3 font-medium">Class</th>
                  <th className="text-left py-3 font-medium">Due</th>
                  <th className="text-left py-3 font-medium">Status</th>
                  <th className="text-left py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {work.map((w) => {
                  const p = pct(w.score, w.max_score);
                  const done = !!w.submitted_at;
                  return (
                    <tr key={`${w.student_row_id}:${w.assignment_id}`} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                      <td className="py-3 px-2 text-ink">{w.title}</td>
                      <td className="py-3 text-muted text-xs">{w.type}</td>
                      {multi && (
                        <td className="py-3 text-muted text-xs">
                          {w.subject || "—"}
                          {w.teacher && <span className="block font-serif italic">{w.teacher}</span>}
                        </td>
                      )}
                      <td className="py-3 text-muted text-xs">{w.class_name || "—"}</td>
                      <td className="py-3 text-muted text-xs">{w.ends_at ? new Date(w.ends_at).toLocaleDateString() : "—"}</td>
                      <td className="py-3">
                        <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border bg-paper ${
                          done ? "border-sage text-sage" : "border-gold text-gold"
                        }`}>
                          {done ? (w.status || "submitted") : "to do"}
                        </span>
                      </td>
                      <td className="py-3 text-ink">{p != null ? `${p}%` : "—"}</td>
                    </tr>
                  );
                })}
                {work.length === 0 && (
                  <tr><td colSpan={multi ? 7 : 6} className="py-12 text-center text-muted">No work assigned yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Typed-in marks, if any */}
      {grades.length > 0 && (
        <Card>
          <CardContent>
            <ChartHeader label="Marks" sub={multi ? "Recorded by your teachers" : "Recorded by your teacher"} />
            <ul className="divide-y divide-line/60">
              {grades.map((g, i) => (
                <li key={i} className="py-3 flex items-center gap-3 text-sm">
                  <span className="text-ink flex-1 min-w-0 truncate">
                    {g.subject || "—"}{g.label ? ` · ${g.label}` : ""}{g.term ? ` · ${g.term}` : ""}
                  </span>
                  <span className="text-ink">{g.score != null ? `${g.score}${g.max_score ? `/${g.max_score}` : ""}` : "—"}</span>
                  <time className="font-mono text-[10px] text-muted whitespace-nowrap">
                    {g.recorded_on ? new Date(g.recorded_on).toLocaleDateString() : ""}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`font-serif font-medium leading-none text-3xl sm:text-4xl ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
        {sub && <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-2 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ChartHeader({ label, sub }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {label}
      </p>
      <h3 className="font-serif text-lg text-ink">{sub}</h3>
    </div>
  );
}

function StudentSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-56" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
