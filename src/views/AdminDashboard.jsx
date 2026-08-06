"use client";

// Admin dashboard — operational view, sub-role aware.
//
// Three sub-roles, three flavors of the same page:
//
//   operations — focus on teacher pipeline (new signups, status, trial→paid
//                conversion). Headline section is the recent signups list.
//   accountant — focus on revenue (MRR/ARR, plan mix, at-risk, billing
//                health). Headline section is the revenue breakdown.
//   support    — focus on health (suspended, expired, ending soon, lapsed
//                logins). Headline section is the at-risk list.
//   (no sub_role) — all of the above stacked.
//
// AdminConsole stays as the teacher-management CRUD table (separate
// nav item). This is the read-with-context dashboard.

import React, { useEffect, useState, useMemo } from "react";
import {
  GraduationCap, TrendingUp, Coins, Calendar, Activity, AlertCircle,
  PiggyBank, HeartHandshake, Wrench, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "./_shared";
import { LineChart, DonutChart, BarChart } from "../components/MiniCharts";
import { useAccount } from "../lib/account";
import { SUB_ROLE_LABELS } from "../lib/role";

const SUBROLE_INTRO = {
  operations: "Pipeline view — new teachers, status, and account health.",
  accountant: "Revenue view — MRR, ARR, plan mix, and billing risk.",
  support:    "Health view — suspended, expired, and at-risk teachers.",
};

const SUBROLE_ICON = {
  operations: <Wrench size={11} />,
  accountant: <PiggyBank size={11} />,
  support:    <HeartHandshake size={11} />,
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [signups, setSignups] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const account = useAccount();
  const subRole = account?.sub_role || null;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/api/admin/dashboard"),
      api(`/api/admin/signups?days=${days}`),
      api("/api/admin/teachers"),
    ])
      .then(([d, s, t]) => {
        setData(d); setSignups(s);
        // Sort newest first, take 10
        const sorted = [...t]
          .filter((r) => r.role === "teacher")
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);
        setRecent(sorted);
        setLoading(false); setError(null);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [days]);

  if (loading && !data) return <AdminSkeleton />;
  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  const aed = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  // Common segments
  const subSegments = [
    { label: "Active",    value: data.subscriptions.active,    color: "var(--color-sage, #6b7f5a)" },
    { label: "Trial",     value: data.subscriptions.trial,     color: "var(--color-gold, #b8893d)" },
    { label: "Expired",   value: data.subscriptions.expired,   color: "var(--color-accent, #c8472b)" },
    { label: "Suspended", value: data.subscriptions.suspended, color: "var(--color-muted, #6b6354)" },
  ];

  const revenueBars = Object.entries(data.revenue.by_plan || {}).map(([plan, aedAmount]) => ({
    label: plan, value: aedAmount,
  }));

  const statusSegments = [
    { label: "Active",    value: data.teachers.active,    color: "var(--color-sage, #6b7f5a)" },
    { label: "Suspended", value: data.teachers.suspended, color: "var(--color-gold, #b8893d)" },
    { label: "Deleted",   value: data.teachers.deleted,   color: "var(--color-accent, #c8472b)" },
  ];

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header — sub-role aware */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" />
            {subRole && SUBROLE_ICON[subRole]} Admin{subRole && ` · ${SUB_ROLE_LABELS[subRole] || subRole}`}
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
            Operational <em className="italic font-light text-accent">overview</em>
          </h2>
          <p className="text-muted mt-2 text-sm md:text-base">
            {SUBROLE_INTRO[subRole] || "Teacher accounts, subscriptions, and revenue at a glance."}
          </p>
        </div>
        <RangeToggle value={days} onChange={setDays} />
      </div>

      {/* Shared KPI row — always visible */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<GraduationCap size={14} />} label="Teachers" value={data.teachers.total} sub="all statuses" />
        <Kpi icon={<Activity size={14} />} label="Active" value={data.teachers.active} sub="signed in window" />
        <Kpi icon={<TrendingUp size={14} />} label="New (7d)" value={data.activity.new_7d} sub="signups" />
        <Kpi icon={<AlertCircle size={14} />} label="Suspended" value={data.teachers.suspended} sub="needs review" accent={data.teachers.suspended > 0} />
        <Kpi icon={<Calendar size={14} />} label="Ending 30d" value={data.subscriptions.ending_30d} sub="subscriptions" accent={data.subscriptions.ending_30d > 0} />
        <Kpi icon={<Activity size={14} />} label="Active today" value={data.activity.active_today} sub="logged in" />
      </div>

      {/* Accountant-specific top: MRR/ARR row + revenue bars */}
      {(subRole === "accountant" || !subRole) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<PiggyBank size={14} />} label="MRR" value={aed(data.revenue.mrr)} sub="monthly recurring" small accent />
            <Kpi icon={<Coins size={14} />} label="ARR (est.)" value={aed(data.revenue.arr)} sub="annualised" small />
            <Kpi icon={<Activity size={14} />} label="Active subs" value={data.subscriptions.active} sub="paying right now" />
            <Kpi icon={<TrendingUp size={14} />} label="Trial" value={data.subscriptions.trial} sub="in 7-day window" />
          </div>
          <Card>
            <CardContent>
              <ChartHeader label="Revenue" sub={`Estimated MRR by plan · ${aed(data.revenue.mrr)} total`} />
              {revenueBars.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">No paid subscriptions yet</p>
                </div>
              ) : (
                <BarChart data={revenueBars} formatValue={aed} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Operations-specific top: signups chart + recent teachers */}
      {(subRole === "operations" || !subRole) && (
        <>
          <Card>
            <CardContent>
              <ChartHeader label="Pipeline" sub={`Daily teacher signups · last ${days} days`} />
              <LineChart data={signups} label="signups" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <ChartHeader label="Recent teachers" sub="Newest 10 accounts" />
              {recent.length === 0 ? (
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-8 text-center">
                  No teachers yet.
                </p>
              ) : (
                <ul className="divide-y divide-line/60">
                  {recent.map((t) => (
                    <li key={t.id} className="py-3 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-ink truncate">{t.first_name} {t.last_name}</p>
                        <p className="font-mono text-[10px] text-muted truncate">{t.email || "—"}</p>
                      </div>
                      <PlanPill plan={t.subscription_plan} status={t.subscription_status} />
                      <time className="font-mono text-[10px] text-muted whitespace-nowrap">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Always show: status + sub donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Teacher status" sub="Account-level state" />
            <DonutChart segments={statusSegments} centerLabel="Teachers" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartHeader label="Subscriptions" sub="By status" />
            <DonutChart segments={subSegments} centerLabel="Subs" />
          </CardContent>
        </Card>
      </div>

      {/* Support-specific: at-risk list (suspended + expired) */}
      {(subRole === "support" || !subRole) && (
        <Card>
          <CardContent>
            <ChartHeader label="At risk" sub="Suspended accounts + subscriptions ending in 30d" />
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-paper-warm rounded-lg p-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1">suspended</p>
                <p className="font-serif text-2xl text-ink">{data.teachers.suspended}</p>
              </div>
              <div className="bg-paper-warm rounded-lg p-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1">expired subs</p>
                <p className="font-serif text-2xl text-ink">{data.subscriptions.expired}</p>
              </div>
              <div className="bg-paper-warm rounded-lg p-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1">ending 30d</p>
                <p className="font-serif text-2xl text-accent">{data.subscriptions.ending_30d}</p>
              </div>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-4 text-center">
              Manage individual accounts from the Teachers tab.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Content footprint — always visible */}
      <Card>
        <CardContent>
          <ChartHeader label="Content" sub="What teachers have created" />
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

      <div className="text-center pt-2 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
          <Sparkles size={11} /> Sub-role specific sections shown above · manage individual accounts in Teachers
        </p>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function Kpi({ icon, label, value, sub, accent, small }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`font-serif font-medium leading-none ${small ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"} ${accent ? "text-accent" : "text-ink"}`}>
          {value}
        </p>
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

function PlanPill({ plan, status }) {
  if (!plan) return <span className="font-mono text-[9px] uppercase text-muted">—</span>;
  const isTrial = status === "trial";
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border bg-paper ${
      isTrial ? "border-gold text-gold" : "border-sage text-sage"
    }`}>
      {plan}
    </span>
  );
}

function AdminSkeleton() {
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
      <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}
