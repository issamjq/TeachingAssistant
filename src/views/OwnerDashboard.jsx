// Owner dashboard — business-focused, read-only view of the project.
//
// The owner is the head from a business perspective. They watch
// revenue, growth, retention, and engagement; they don't manage
// accounts or permissions (that's the super admin's job). This
// surface has zero edit affordances — no click-to-drill, no action
// buttons, no drawer.
//
// Endpoints: /api/owner/overview, /signups, /activity
// Per-school scope tables don't exist yet, so every metric is
// system-wide. When scope tables land, the SQL filters by the owner's
// assigned schools and these numbers narrow automatically.

import React, { useEffect, useState } from "react";
import {
  GraduationCap, TrendingUp, Coins, Calendar, Activity,
  Sparkles, PiggyBank, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "./_shared";
import { LineChart, DonutChart, BarChart } from "../components/MiniCharts";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [signups, setSignups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/api/owner/overview"),
      api(`/api/owner/signups?days=${days}`),
      api(`/api/owner/activity?days=${days}`),
    ])
      .then(([o, su, ac]) => {
        setData(o);
        setSignups(su);
        setActivity(ac);
        setLoading(false);
        setError(null);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [days]);

  if (loading && !data) return <OwnerSkeleton />;
  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  const aed = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  // Subscription health donut. Colors picked from the existing palette.
  const subSegments = [
    { label: "Active",    value: data.teachers.active_subs, color: "var(--color-sage, #6b7f5a)" },
    { label: "Trial",     value: data.teachers.trial,       color: "var(--color-gold, #b8893d)" },
    { label: "Expired",   value: data.teachers.expired,     color: "var(--color-accent, #c8472b)" },
    { label: "Suspended", value: data.teachers.suspended,   color: "var(--color-muted, #6b6354)" },
  ];

  const revenueBars = Object.entries(data.revenue.by_plan || {}).map(([plan, amount]) => ({
    label: plan,
    value: amount,
  }));

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Owner
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
            Business <em className="italic font-light text-accent">overview</em>
          </h2>
          <p className="text-muted mt-2 text-sm md:text-base">
            How the product is performing across revenue, growth, and engagement. Read-only.
          </p>
        </div>
        <RangeToggle value={days} onChange={setDays} />
      </div>

      {/* Money KPIs — top row for the owner. Revenue is what they care
          about first. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          icon={<PiggyBank size={14} />}
          label="MRR"
          value={aed(data.revenue.mrr)}
          sub="monthly recurring"
          accent
        />
        <Kpi
          icon={<Coins size={14} />}
          label="ARR (est.)"
          value={aed(data.revenue.arr)}
          sub="annualised"
        />
        <Kpi
          icon={<GraduationCap size={14} />}
          label="Paying teachers"
          value={data.teachers.active_subs}
          sub="active subscriptions"
        />
        <Kpi
          icon={<TrendingUp size={14} />}
          label="Trial"
          value={data.teachers.trial}
          sub="in 7-day window"
        />
      </div>

      {/* Growth + retention row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          icon={<TrendingUp size={14} />}
          label="New (7d)"
          value={data.growth.new_signups_7d}
          sub="teachers signed up"
        />
        <Kpi
          icon={<TrendingUp size={14} />}
          label="New (30d)"
          value={data.growth.new_signups_30d}
          sub="teachers signed up"
        />
        <Kpi
          icon={<Activity size={14} />}
          label="Active today"
          value={data.growth.logged_in_today}
          sub="teachers"
        />
        <Kpi
          icon={<Activity size={14} />}
          label="Active 7d"
          value={data.growth.logged_in_7d}
          sub="teachers"
        />
        <Kpi
          icon={<AlertCircle size={14} />}
          label="At risk"
          value={data.teachers.ending_30d}
          accent={data.teachers.ending_30d > 0}
          sub="ending in 30d"
        />
        <Kpi
          icon={<GraduationCap size={14} />}
          label="All teachers"
          value={data.teachers.total}
          sub="total in system"
        />
      </div>

      {/* Signups trend — the headline growth chart */}
      <Card>
        <CardContent>
          <ChartHeader
            label="Growth"
            sub={`Daily teacher signups · last ${days} days`}
          />
          <LineChart data={signups} label="signups" />
        </CardContent>
      </Card>

      {/* Subscription health + revenue split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Subscription health" sub="Teacher subs by status" />
            <DonutChart segments={subSegments} centerLabel="Teachers" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartHeader label="Revenue" sub={`Estimated MRR by plan · ${aed(data.revenue.mrr)} total`} />
            {revenueBars.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  No paid subscriptions yet
                </p>
              </div>
            ) : (
              <BarChart data={revenueBars} formatValue={aed} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Engagement trend */}
      <Card>
        <CardContent>
          <ChartHeader
            label="Engagement"
            sub={`Daily distinct logins · last ${days} days`}
          />
          <LineChart data={activity} label="logins" />
        </CardContent>
      </Card>

      {/* Content footprint — what teachers are creating */}
      <Card>
        <CardContent>
          <ChartHeader
            label="Content footprint"
            sub="What teachers have created across the platform"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {Object.entries(data.content || {}).map(([k, v]) => (
              <div key={k} className="bg-paper-warm rounded-lg p-2 sm:p-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1 truncate">{k}</p>
                <p className="font-serif text-xl sm:text-2xl text-ink">{v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-2 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
          <Sparkles size={11} /> Read-only · scope tables for per-owner data land later
        </p>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent, sub }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`font-serif font-medium leading-none text-2xl sm:text-3xl ${accent ? "text-accent" : "text-ink"}`}>
          {value}
        </p>
        {sub && (
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-2 truncate">
            {sub}
          </p>
        )}
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

function OwnerSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex-1 space-y-3 min-w-0">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
      <Card><CardContent><ChartSkeleton /></CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent><ChartSkeleton /></CardContent></Card>
        <Card><CardContent><ChartSkeleton /></CardContent></Card>
      </div>
      <Card><CardContent><ChartSkeleton /></CardContent></Card>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-2 w-24" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-5 w-56 max-w-full" />
      </div>
      <Skeleton className="h-44 w-full" />
    </div>
  );
}
