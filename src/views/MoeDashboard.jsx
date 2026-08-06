"use client";

// MoE (Ministry of Education) dashboard — oversight + curriculum view.
//
// Renders four KPI cards + three charts + a schools directory. The
// hero copy adapts to sub_role (head / inspector / staff) so each
// persona feels addressed without changing the underlying data.
//
// Read-only. Per-school scope tables don't exist yet, so every metric
// is system-wide. When the moe→schools assignment lands, the SQL
// narrows automatically.

import React, { useEffect, useState, useMemo } from "react";
import {
  School, GraduationCap, FileText, Activity, MapPin, BookOpen, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "./_shared";
import { LineChart, DonutChart, BarChart } from "../components/MiniCharts";
import { useAccount } from "../lib/account";
import { SUB_ROLE_LABELS } from "../lib/role";

const SUBROLE_INTRO = {
  head:      "Pyramid view of the ministry — schools, teachers, and content output across the system.",
  inspector: "Read-only directory and engagement signals from the schools you oversee.",
  staff:     "Ministry-wide snapshot of school participation and content production.",
};

export default function MoeDashboard() {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [emirateFilter, setEmirateFilter] = useState("");
  const account = useAccount();
  const subRole = account?.sub_role || null;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/api/moe/overview"),
      api(`/api/moe/content-trend?days=${days}`),
      api("/api/moe/schools?limit=25"),
    ])
      .then(([o, t, s]) => {
        setData(o); setTrend(t); setSchools(s); setLoading(false); setError(null);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [days]);

  // Refresh schools when emirate filter changes
  useEffect(() => {
    const qs = emirateFilter ? `?emirate=${encodeURIComponent(emirateFilter)}&limit=25` : "?limit=25";
    api(`/api/moe/schools${qs}`).then(setSchools).catch(() => {});
  }, [emirateFilter]);

  if (loading && !data) return <MoeSkeleton />;
  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  const emirateSegments = data.schools.by_emirate.map((e) => ({
    label: e.emirate, value: e.n,
  }));
  const curriculumBars = data.schools.by_curriculum.map((c) => ({
    label: c.curriculum, value: c.n,
  }));

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header — sub-role aware */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" />
            Ministry{subRole && ` · ${SUB_ROLE_LABELS[subRole] || subRole}`}
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
            Curriculum <em className="italic font-light text-accent">overview</em>
          </h2>
          <p className="text-muted mt-2 text-sm md:text-base">
            {SUBROLE_INTRO[subRole] || SUBROLE_INTRO.staff}
          </p>
        </div>
        <RangeToggle value={days} onChange={setDays} />
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<School size={14} />} label="Schools" value={data.schools.total} sub="catalog" />
        <Kpi icon={<School size={14} />} label="Public" value={data.schools.public} sub="schools" />
        <Kpi icon={<School size={14} />} label="Private" value={data.schools.private} sub="schools" />
        <Kpi icon={<GraduationCap size={14} />} label="Teachers" value={data.teachers.total} sub={`${data.teachers.engaged_7d} engaged 7d`} />
        <Kpi icon={<FileText size={14} />} label="Lesson plans" value={data.content.lesson_plans} sub="across schools" />
        <Kpi icon={<Activity size={14} />} label="Active today" value={data.activity.active_today} sub="teachers" />
      </div>

      {/* Content trend */}
      <Card>
        <CardContent>
          <ChartHeader label="Content output" sub={`Daily new lessons + quizzes + homework + presentations + activities · ${days}d`} />
          <LineChart data={trend} label="items" />
        </CardContent>
      </Card>

      {/* Geography + curriculum split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Geography" sub="Schools by emirate" />
            <DonutChart segments={emirateSegments} centerLabel="Schools" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartHeader label="Curriculum mix" sub="Schools by curriculum framework" />
            {curriculumBars.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  No curriculum data
                </p>
              </div>
            ) : (
              <BarChart data={curriculumBars} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content footprint */}
      <Card>
        <CardContent>
          <ChartHeader label="Content footprint" sub="What teachers have created" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {Object.entries(data.content || {}).map(([k, v]) => (
              <div key={k} className="bg-paper-warm rounded-lg p-2 sm:p-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1 truncate">{k.replace(/_/g, " ")}</p>
                <p className="font-serif text-xl sm:text-2xl text-ink">{v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schools directory — useful for inspector + head sub-roles */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
            <ChartHeader label="Schools" sub={`Directory · ${schools.length} shown`} inline />
            <select
              className="bg-paper border border-line rounded-md px-3 py-1.5 text-xs"
              value={emirateFilter}
              onChange={(e) => setEmirateFilter(e.target.value)}
            >
              <option value="">All emirates</option>
              {data.schools.by_emirate.map((e) => (
                <option key={e.emirate} value={e.emirate}>{e.emirate} ({e.n})</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-2 px-2 font-medium">School</th>
                  <th className="text-left py-2 font-medium">Emirate</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-left py-2 font-medium">Curriculum</th>
                  <th className="text-left py-2 font-medium">Teachers</th>
                  <th className="text-left py-2 font-medium">Students</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-2 px-2 text-ink">
                      <div className="font-medium">{s.name}</div>
                      {s.name_ar && <div className="text-xs text-muted">{s.name_ar}</div>}
                    </td>
                    <td className="py-2 text-ink-soft text-xs">{s.emirate}</td>
                    <td className="py-2 text-ink-soft text-xs">{s.type || "—"}</td>
                    <td className="py-2 text-ink-soft text-xs">{s.curriculum || "—"}</td>
                    <td className="py-2 text-ink-soft font-mono text-xs">{s.teacher_count}</td>
                    <td className="py-2 text-ink-soft font-mono text-xs">{s.student_count}</td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted">No schools match the filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-2 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
          <Sparkles size={11} /> Read-only · per-MoE school scoping lands when the assignment table does
        </p>
      </div>
    </div>
  );
}

// ─── helpers reused from owner dashboard, kept local for clarity ─────

function Kpi({ icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className="font-serif font-medium leading-none text-ink text-2xl sm:text-3xl">{value}</p>
        {sub && <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-2 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ChartHeader({ label, sub, inline }) {
  return (
    <div className={inline ? "" : "mb-5"}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {label}
      </p>
      {sub && <h3 className="font-serif text-lg text-ink">{sub}</h3>}
    </div>
  );
}

function RangeToggle({ value, onChange }) {
  const opts = [7, 30, 90];
  return (
    <div className="inline-flex items-center gap-1 bg-paper-warm border border-line rounded-lg p-1">
      {opts.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded transition ${
            value === d ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

function MoeSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 space-y-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-2 w-20" />
          </CardContent></Card>
        ))}
      </div>
      <Card><CardContent>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-5 w-64 mb-5" />
        <Skeleton className="h-44 w-full" />
      </CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}
