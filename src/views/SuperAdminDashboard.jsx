"use client";

// Super admin dashboard — everything the head of the project needs at
// a glance:
//
//   Hero KPIs  : accounts, MRR, ARR, trials, ending soon, active today
//   AI spend   : what generation cost us, what we charged, the margin
//   Charts     : signups over time, accounts by role (donut), revenue by plan (bar)
//   Activity   : recent audit-log entries (signups, role changes, suspensions)
//   Quick list : newest 5 accounts (click → open drawer)
//
// Endpoints: /api/superadmin/overview, /signups, /logins, /recent-activity.
// Click a row → opens <AccountDrawer />.

import React, { useEffect, useState } from "react";
import {
  Users, GraduationCap, Briefcase, TrendingUp, Coins, Calendar, Activity, Sparkles,
  Cpu, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "./_shared";
import { LineChart, DonutChart, BarChart } from "../components/MiniCharts";
import { ROLE_LABELS, ROLES } from "../lib/role";
import AccountDrawer from "./AccountDrawer";
import BrandLoader from "../components/BrandLoader";
import { navigate } from "@/lib/route";
import { Skeleton } from "../components/ui/skeleton";

const ROLE_COLORS = {
  super_admin: "var(--color-accent, #c8472b)",
  dev:         "var(--color-ink, #1a1814)",
  admin:       "var(--color-gold, #b8893d)",
  moe:         "var(--color-sage, #6b7f5a)",
  owner:       "var(--color-clay-deep, #6b4633)",
  teacher:     "var(--color-muted, #6b6354)",
};

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [signups, setSignups] = useState([]);
  const [logins, setLogins] = useState([]);
  const [activity, setActivity] = useState([]);
  const [recentAccounts, setRecentAccounts] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [days, setDays] = useState(30);
  const [ai, setAi] = useState(null);

  const reload = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    Promise.all([
      api("/api/superadmin/overview"),
      api(`/api/superadmin/signups?days=${days}`),
      api(`/api/superadmin/logins?days=${days}`),
      api(`/api/superadmin/recent-activity?limit=15`),
      // A dashboard-only sub-admin may not hold the accounts capability;
      // the newest-accounts panel is a nicety, so a refusal here degrades
      // to an empty list rather than failing the whole dashboard.
      api("/api/admin/teachers").catch(() => []),
      api("/api/auth/me"),
      // What the platform's AI actually cost over the same window. Its own
      // failure is survivable — a dashboard without the spend row is worth
      // more than no dashboard.
      api(`/api/superadmin/ai/overview?days=${days}`).catch(() => null),
    ])
      .then(([overview, su, lo, act, accounts, me, aiOverview]) => {
        setAi(aiOverview);
        setData(overview);
        setSignups(su);
        setLogins(lo);
        setActivity(act);
        // Recent accounts — newest 5 by created_at
        const sorted = [...accounts].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setRecentAccounts(sorted.slice(0, 5));
        setMe(me);
        setLoading(false);
        setError(null);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { reload(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return <DashboardSkeleton />;
  }
  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  const aed = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  const accountSegments = ROLES
    .filter((r) => (data.accounts.by_role[r] || 0) > 0)
    .map((r) => ({
      label: ROLE_LABELS[r] || r,
      value: data.accounts.by_role[r] || 0,
      color: ROLE_COLORS[r],
    }));

  const revenueBars = Object.entries(data.revenue.by_plan || {}).map(([plan, aedAmount]) => ({
    label: plan,
    value: aedAmount,
  }));

  const subSegments = [
    { label: "Active",    value: data.subscriptions.active,    color: "var(--color-sage, #6b7f5a)" },
    { label: "Trial",     value: data.subscriptions.trial,     color: "var(--color-gold, #b8893d)" },
    { label: "Expired",   value: data.subscriptions.expired,   color: "var(--color-accent, #c8472b)" },
    { label: "Suspended", value: data.subscriptions.suspended, color: "var(--color-muted, #6b6354)" },
  ];

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
            Project <em className="italic font-light text-accent">overview</em>
          </h2>
          <p className="text-muted mt-2 text-sm md:text-base">
            Everything at a glance — accounts, revenue, activity. Click any row to drill into an account.
          </p>
        </div>
        <RangeToggle value={days} onChange={setDays} />
      </div>

      {/* Hero KPIs — split between people (top row) and money + activity
          (second row). Each card names exactly what it counts, no generic
          "Total" buckets. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          icon={<GraduationCap size={14} />}
          label="Teachers"
          value={data.accounts.by_role.teacher || 0}
          sub="paying users"
        />
        <Kpi
          icon={<Briefcase size={14} />}
          label="Operators"
          value={
            (data.accounts.by_role.admin || 0) +
            (data.accounts.by_role.moe || 0) +
            (data.accounts.by_role.owner || 0)
          }
          sub="admin · moe · owner"
        />
        <Kpi
          icon={<Users size={14} />}
          label="Internal"
          value={
            (data.accounts.by_role.dev || 0) +
            (data.accounts.by_role.super_admin || 0)
          }
          sub="dev · super admin"
        />
        <Kpi
          icon={<TrendingUp size={14} />}
          label="New (7d)"
          value={data.activity.new_signups_7d}
          sub="any role"
        />
        <Kpi
          icon={<Calendar size={14} />}
          label="Ending in 30d"
          value={data.subscriptions.ending_30d}
          accent={data.subscriptions.ending_30d > 0}
          sub="subscriptions"
        />
        <Kpi
          icon={<Activity size={14} />}
          label="Active today"
          value={data.activity.logged_in_today}
          sub="logged in"
        />
      </div>

      {/* Money KPIs — separate row so AED amounts don't compete with people
          counts for visual weight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          icon={<Coins size={14} />}
          label="MRR"
          value={aed(data.revenue.mrr)}
          sub="monthly recurring"
          small
        />
        <Kpi
          icon={<Coins size={14} />}
          label="ARR (est.)"
          value={aed(data.revenue.arr)}
          sub="annualised"
          small
        />
        <Kpi
          icon={<Activity size={14} />}
          label="Trial"
          value={data.subscriptions.trial}
          sub="in 7-day window"
        />
        <Kpi
          icon={<Activity size={14} />}
          label="Active subs"
          value={data.subscriptions.active}
          sub="paying right now"
        />
      </div>

      {/* What that revenue costs to serve.
          Directly under MRR on purpose: revenue and cost of goods belong
          on the same screen, and this was the number nobody could see. */}
      {ai && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> AI spend · last {ai.days} days
            </p>
            <button
              type="button"
              onClick={() => navigate(["superadmin-usage"])}
              className="font-mono text-[10px] uppercase tracking-wider text-ink-soft hover:text-ink transition inline-flex items-center gap-1.5"
            >
              Full breakdown <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icon={<Cpu size={14} />}
              label="Tokens"
              value={fmtTokens(ai.tokens_total)}
              sub={`${ai.generations} generations`}
              small
            />
            <Kpi
              icon={<Coins size={14} />}
              label="Our cost"
              value={`$${Number(ai.cost_usd || 0).toFixed(2)}`}
              sub="billed by Anthropic"
              small
            />
            <Kpi
              icon={<Coins size={14} />}
              label="Credits charged"
              value={Number(ai.credits || 0).toLocaleString()}
              sub={`$${Number(ai.charged_usd || 0).toFixed(2)} at $0.02 each`}
              small
            />
            <Kpi
              icon={<TrendingUp size={14} />}
              label="Margin"
              value={`$${Number(ai.margin_usd || 0).toFixed(2)}`}
              sub={
                Number(ai.charged_usd) > 0
                  ? `${Math.round((Number(ai.margin_usd) / Number(ai.charged_usd)) * 100)}% of charged`
                  : "nothing charged yet"
              }
              accent={Number(ai.margin_usd) < 0}
              small
            />
          </div>
        </div>
      )}

      {/* Charts row 1 — signups timeseries */}
      <Card>
        <CardContent>
          <ChartHeader
            label="Signups"
            sub={`Daily new accounts · last ${days} days`}
          />
          <LineChart data={signups} label="signups" />
        </CardContent>
      </Card>

      {/* Charts row 2 — accounts donut + revenue bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Accounts" sub="by role" />
            <DonutChart
              segments={accountSegments}
              centerValue={data.accounts.total}
              centerLabel="Accounts"
            />
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

      {/* Charts row 3 — subscriptions donut + logins timeseries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Subscriptions" sub="by status" />
            <DonutChart segments={subSegments} centerLabel="Subs" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartHeader label="Logins" sub={`Daily login + signup audit events · ${days}d`} />
            <LineChart data={logins} label="logins" />
          </CardContent>
        </Card>
      </div>

      {/* Content footprint */}
      <Card>
        <CardContent>
          <ChartHeader label="Content footprint" sub="Across every teacher in the system" />
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

      {/* Recent activity + recent accounts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Activity" sub="Latest audit-log events" />
            <ul className="divide-y divide-line/60">
              {activity.length === 0 && (
                <li className="py-4 text-sm text-muted">No activity yet.</li>
              )}
              {activity.map((a) => (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-ink truncate">
                        {a.first_name ? `${a.first_name} ${a.last_name || ""}`.trim() : "—"}
                      </span>
                      <ActionPill action={a.action} />
                    </div>
                    <p className="font-mono text-[10px] text-muted mt-0.5 truncate">
                      {a.email || "—"} · {a.target_table || "—"} #{a.target_id || "—"}
                    </p>
                  </div>
                  <time className="font-mono text-[10px] text-muted whitespace-nowrap" dateTime={a.created_at}>
                    {timeAgo(a.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartHeader label="Newest accounts" sub="Click any row to manage" />
            <ul className="divide-y divide-line/60">
              {recentAccounts.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setOpenId(a.id)}
                    className="w-full py-3 flex items-center gap-3 text-left hover:bg-paper-warm transition rounded px-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">
                        {a.first_name} {a.last_name}
                        {me && me.id === a.id && (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                            you
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-muted truncate">{a.email}</p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">
                      {ROLE_LABELS[a.role] || a.role}
                    </span>
                    <Sparkles size={12} className="text-muted flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {openId && (
        <AccountDrawer
          accountId={openId}
          isSelf={me && me.id === openId}
          onClose={() => setOpenId(null)}
          onChanged={() => reload(false)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
/** Tokens run to millions; a raw integer stops being readable. */
function fmtTokens(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function Kpi({ icon, label, value, accent, small, sub }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`font-serif font-medium leading-none ${small ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"} ${accent ? "text-accent" : "text-ink"}`}>
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

const ACTION_STYLES = {
  "auth.signup":             { label: "signup",   color: "border-sage text-sage" },
  "auth.login":              { label: "login",    color: "border-line text-muted" },
  "auth.renew":              { label: "renew",    color: "border-gold text-gold" },
  "admin.teacher.create":    { label: "created",  color: "border-sage text-sage" },
  "admin.teacher.delete":    { label: "deleted",  color: "border-accent text-accent" },
  "admin.teacher.suspended": { label: "suspended",color: "border-gold text-gold" },
  "admin.teacher.active":    { label: "activated",color: "border-sage text-sage" },
  "admin.teacher.role_update": { label: "role",   color: "border-ink text-ink" },
  "superadmin.permissions.update": { label: "perms", color: "border-accent text-accent" },
};

function ActionPill({ action }) {
  const s = ACTION_STYLES[action] || { label: action.split(".").pop(), color: "border-line text-muted" };
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-paper ${s.color}`}>
      {s.label}
    </span>
  );
}

function timeAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return d.toLocaleDateString();
}

// Dashboard skeleton — mirrors the real layout (hero header, two KPI
// rows, signups chart, role/revenue pair, sub status/logins pair,
// content footprint, activity + recent accounts). Renders immediately
// while the dashboard fetches data, so the shell never reads as empty.
function DashboardSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-3 flex-1 min-w-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* People KPI row (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>

      {/* Money KPI row (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>

      {/* Signups chart */}
      <Card>
        <CardContent>
          <ChartHeaderSkeleton />
          <Skeleton className="h-44 w-full" />
        </CardContent>
      </Card>

      {/* Two-up: accounts donut + revenue bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent><DonutSkeleton /></CardContent></Card>
        <Card><CardContent><BarsSkeleton /></CardContent></Card>
      </div>

      {/* Two-up: subs donut + logins line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent><DonutSkeleton /></CardContent></Card>
        <Card>
          <CardContent>
            <ChartHeaderSkeleton />
            <Skeleton className="h-44 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Content footprint */}
      <Card>
        <CardContent>
          <ChartHeaderSkeleton />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-paper-warm rounded-lg p-3 text-center space-y-2">
                <Skeleton className="h-2.5 w-12 mx-auto" />
                <Skeleton className="h-7 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-up lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((col) => (
          <Card key={col}>
            <CardContent>
              <ChartHeaderSkeleton />
              <ul className="divide-y divide-line/60">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-2.5 w-2/3" />
                    </div>
                    <Skeleton className="h-2.5 w-10" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
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

function ChartHeaderSkeleton() {
  return (
    <div className="mb-5 space-y-2">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-5 w-56 max-w-full" />
    </div>
  );
}

function DonutSkeleton() {
  return (
    <>
      <ChartHeaderSkeleton />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <Skeleton className="h-[200px] w-[200px] rounded-full mx-auto sm:mx-0 flex-shrink-0" />
        <div className="flex-1 w-full space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-2.5 h-2.5 rounded-sm flex-shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function BarsSkeleton() {
  return (
    <>
      <ChartHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-16 sm:w-20 h-3 flex-shrink-0" />
            <Skeleton className="flex-1 h-5 rounded-sm" />
            <Skeleton className="w-16 sm:w-20 h-3 flex-shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}
