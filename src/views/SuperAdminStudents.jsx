"use client";

// Super-admin Students dashboard — every student across the platform, and
// what they are doing: quiz attempts and submissions, scores, last-seen.
// Reads the is_super_admin()-gated sa_students_* RPCs; no writes.

import React, { useEffect, useMemo, useState } from "react";
import { Users, UserCheck, ClipboardList, Activity, Percent, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "./_shared";
import { LineChart, DonutChart, BarChart } from "../components/MiniCharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminStudents() {
  const [ov, setOv] = useState(null);
  const [rows, setRows] = useState([]);
  const [activity, setActivity] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/api/superadmin/students-overview"),
      api("/api/superadmin/students?limit=100"),
      api("/api/superadmin/student-activity?limit=20"),
    ])
      .then(([o, r, a]) => { setOv(o); setRows(r); setActivity(a); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // Server-side search on submit; local filter for instant feedback.
  const runSearch = async (q) => {
    const r = await api(`/api/superadmin/students?limit=100${q ? `&search=${encodeURIComponent(q)}` : ""}`);
    setRows(r);
  };

  const gradeBars = useMemo(
    () => Object.entries(ov?.by_grade || {}).map(([label, value]) => ({ label, value })),
    [ov]
  );
  const schoolSegs = useMemo(
    () => Object.entries(ov?.by_school || {}).map(([label, value]) => ({ label, value })),
    [ov]
  );

  if (loading && !ov) return <StudentsSkeleton />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-6 md:space-y-8">
      <Header
        eyebrow="Super admin"
        title="Students"
        lead="Every student across the platform, and what they're doing — attempts, submissions, scores."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<Users size={14} />} label="Total" value={ov.total} sub="all students" />
        <Kpi icon={<UserCheck size={14} />} label="With accounts" value={ov.with_account} sub="signed in" />
        <Kpi icon={<Users size={14} />} label="Roster only" value={ov.roster_only} sub="no account" />
        <Kpi icon={<Activity size={14} />} label="Active (7d)" value={ov.active_7d} sub="attempted work" accent={ov.active_7d > 0} />
        <Kpi icon={<ClipboardList size={14} />} label="Submissions" value={ov.submissions_total} sub="all time" />
        <Kpi icon={<Percent size={14} />} label="Avg score" value={ov.avg_pct != null ? `${ov.avg_pct}%` : "—"} sub="graded work" />
      </div>

      <Card>
        <CardContent>
          <ChartHeader label="Submissions" sub="Daily submitted attempts · last 14 days" />
          <LineChart data={ov.submissions || []} label="submissions" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Students" sub="by grade" />
            {gradeBars.length ? <BarChart data={gradeBars} /> : <Empty>No students yet</Empty>}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartHeader label="Students" sub="by school (top 6)" />
            {schoolSegs.length ? <DonutChart segments={schoolSegs} centerLabel="Students" /> : <Empty>No students yet</Empty>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <ChartHeader label="Activity" sub="What students are doing — latest submissions" />
          <ul className="divide-y divide-line/60">
            {activity.length === 0 && <li className="py-4 text-sm text-muted">No submissions yet.</li>}
            {activity.map((a) => (
              <li key={a.id} className="py-3 flex items-center gap-3 text-sm">
                <span className="text-ink truncate flex-1 min-w-0">
                  {a.first_name} {a.last_name}
                  <span className="text-muted"> · {a.work_type || "work"} “{a.work_title}”</span>
                </span>
                {a.score != null && a.max_score ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-sage text-sage bg-paper whitespace-nowrap">
                    {Math.round((a.score / a.max_score) * 100)}%
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{a.status || "—"}</span>
                )}
                <time className="font-mono text-[10px] text-muted whitespace-nowrap">
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : ""}
                </time>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-5 gap-4">
            <ChartHeader label="All students" sub="Newest activity first" nomargin />
            <form
              onSubmit={(e) => { e.preventDefault(); runSearch(search.trim()); }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="name or school"
                  className="pl-8 pr-3 py-1.5 rounded-full border border-line bg-paper text-ink text-sm outline-none focus:border-ink w-48"
                />
              </div>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-2 font-medium">Name</th>
                  <th className="text-left py-3 font-medium">School</th>
                  <th className="text-left py-3 font-medium">Grade</th>
                  <th className="text-left py-3 font-medium">Attempts</th>
                  <th className="text-left py-3 font-medium">Avg</th>
                  <th className="text-left py-3 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-3 px-2 text-ink">
                      {s.first_name} {s.last_name}
                      {s.has_account && (
                        <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-sage">acct</span>
                      )}
                    </td>
                    <td className="py-3 text-muted text-xs">{s.school || "—"}</td>
                    <td className="py-3 text-muted text-xs">{s.grade || "—"}{s.section ? `·${s.section}` : ""}</td>
                    <td className="py-3 text-ink">{s.attempts}</td>
                    <td className="py-3 text-ink">{s.avg_pct != null ? `${s.avg_pct}%` : "—"}</td>
                    <td className="py-3 text-muted text-xs">
                      {s.last_activity ? new Date(s.last_activity).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted">No students match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── shared bits (kept local; the dashboard's are not exported) ──────────
export function Header({ eyebrow, title, lead }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {eyebrow}
      </p>
      <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
        {title.split(" ")[0]}{" "}
        {title.split(" ").length > 1 && <em className="italic font-light text-accent">{title.split(" ").slice(1).join(" ")}</em>}
      </h2>
      <p className="text-muted mt-2 text-sm md:text-base max-w-2xl">{lead}</p>
    </div>
  );
}

export function Kpi({ icon, label, value, sub, accent }) {
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

export function ChartHeader({ label, sub, nomargin }) {
  return (
    <div className={nomargin ? "" : "mb-5"}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {label}
      </p>
      <h3 className="font-serif text-lg text-ink">{sub}</h3>
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="py-12 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{children}</p>
    </div>
  );
}

export function ErrorBox({ message }) {
  return (
    <div className="bg-paper border border-accent rounded-lg p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{message}</p>
    </div>
  );
}

function StudentsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}
