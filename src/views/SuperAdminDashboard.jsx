// Super admin dashboard — everything the head of the project needs at
// a glance:
//
//   Hero KPIs  : accounts, MRR, ARR, trials, ending soon, active today
//   Charts     : signups over time, accounts by role (donut), revenue by plan (bar)
//   Activity   : recent audit-log entries (signups, role changes, suspensions)
//   Quick list : newest 5 accounts (click → open drawer)
//
// Endpoints: /api/superadmin/overview, /signups, /logins, /recent-activity.
// Click a row → opens <AccountDrawer />.

import React, { useEffect, useState } from "react";
import { Users, TrendingUp, Coins, Calendar, Activity, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "./_shared";
import { LineChart, DonutChart, BarChart } from "../components/MiniCharts";
import { ROLE_LABELS, ROLES } from "../lib/role";
import AccountDrawer from "./AccountDrawer";

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

  const reload = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    Promise.all([
      api("/api/superadmin/overview"),
      api(`/api/superadmin/signups?days=${days}`),
      api(`/api/superadmin/logins?days=${days}`),
      api(`/api/superadmin/recent-activity?limit=15`),
      api("/api/admin/teachers"),
      api("/api/auth/me"),
    ])
      .then(([overview, su, lo, act, accounts, me]) => {
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
    return (
      <div className="py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Loading dashboard…</p>
      </div>
    );
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Project <em className="italic font-light text-accent">overview</em>
          </h2>
          <p className="text-muted mt-2">
            Everything at a glance — accounts, revenue, activity. Click any row to drill into an account.
          </p>
        </div>
        <RangeToggle value={days} onChange={setDays} />
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<Users size={14} />} label="Total accounts" value={data.accounts.total} />
        <Kpi icon={<TrendingUp size={14} />} label="New (7d)" value={data.activity.new_signups_7d} />
        <Kpi icon={<Coins size={14} />} label="MRR" value={aed(data.revenue.mrr)} small />
        <Kpi icon={<Coins size={14} />} label="ARR (est.)" value={aed(data.revenue.arr)} small />
        <Kpi icon={<Calendar size={14} />} label="Ending in 30d" value={data.subscriptions.ending_30d} accent={data.subscriptions.ending_30d > 0} />
        <Kpi icon={<Activity size={14} />} label="Active today" value={data.activity.logged_in_today} />
      </div>

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
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {Object.entries(data.content || {}).map(([k, v]) => (
              <div key={k} className="bg-paper-warm rounded-lg p-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1">{k}</p>
                <p className="font-serif text-2xl text-ink">{v}</p>
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
function Kpi({ icon, label, value, accent, small }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`font-serif font-medium leading-none ${small ? "text-2xl" : "text-4xl"} ${accent ? "text-accent" : "text-ink"}`}>
          {value}
        </p>
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
