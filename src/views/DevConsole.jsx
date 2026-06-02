// Dev console — engineering inspector for the platform.
//
// Five sections, top to bottom:
//   1. Hero stats        — totals (accounts, content, students, schools,
//                          audit events, DB size) — at-a-glance health
//   2. Runtime + DB      — uptime, memory, heap, latency, Node version,
//                          NODE_ENV, pid — for "is the server alive"
//   3. Audit log feed    — last 50 actions across the system, filterable
//                          by action prefix + recency window
//   4. Permission probe  — type an email/name → pick an account → see
//                          the canonical row + resolved permissions
//                          (role defaults + per-account overrides)
//   5. Table inspector   — every public table with live row counts,
//                          dropdown switches the visible rows
//   6. Feature flags     — toggle on/off (writes audit log)
//
// Read-only EXCEPT for feature-flag toggles. Backend gates everything
// at /api/dev/* via requireRole("dev").

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, Database, Cpu, Users, FileText, FolderTree, ShieldCheck,
  Search, Flag, Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { selectClasses, inputClasses, api } from "./_shared";
import { resolvePermissions, PERMISSION_GROUPS } from "../lib/permissions";
import { ROLE_LABELS } from "../lib/role";

const AUDIT_ACTION_FILTERS = [
  { value: "",                  label: "Every action" },
  { value: "auth.",             label: "Auth (login/signup/renew)" },
  { value: "admin.",            label: "Admin actions" },
  { value: "superadmin.",       label: "Super admin actions" },
  { value: "dev.",              label: "Dev actions" },
  { value: "school.",           label: "School changes" },
];

export default function DevConsole() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  // System stats + health load in parallel on mount. Re-poll health
  // every 15 seconds so the runtime card stays fresh while the page
  // is open; system-stats once per page open (refresh manually).
  useEffect(() => {
    api("/api/dev/system-stats").then(setStats).catch((e) => setError(e.message));
    const pollHealth = () =>
      api("/api/dev/health-detail").then(setHealth).catch(() => {});
    pollHealth();
    const t = setInterval(pollHealth, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      <Header />
      {error && (
        <Card>
          <CardContent>
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
          </CardContent>
        </Card>
      )}

      <HeroStats stats={stats} health={health} />
      <RuntimeCard health={health} />
      <AuditFeed />
      <PermissionProbe />
      <TableInspector stats={stats} />
      <FeatureFlagsCard />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> Dev
      </p>
      <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink leading-tight">
        Engineering <em className="italic font-light text-accent">inspector</em>
      </h2>
      <p className="text-muted mt-2 text-sm md:text-base">
        Read-only data, runtime health, audit feed, permission probe, and feature flags.
        Writes happen only through feature-flag toggles (recorded in audit).
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function HeroStats({ stats, health }) {
  if (!stats) return <HeroStatsSkeleton />;
  const t = stats.totals;
  const fmtBytes = (b) => {
    if (!b) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024 ** 3).toFixed(2)} GB`;
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Kpi icon={<Users size={14} />} label="Accounts" value={t.total_accounts} sub={`${t.teachers} teachers`} />
      <Kpi icon={<Users size={14} />} label="Students" value={t.students} sub="all schools" />
      <Kpi icon={<FolderTree size={14} />} label="Schools" value={t.schools} sub="catalog" />
      <Kpi icon={<FileText size={14} />} label="Content" value={t.content_rows} sub="drafts+quizzes+hw+pres+act" />
      <Kpi icon={<ShieldCheck size={14} />} label="Audit events" value={t.audit_events.toLocaleString()} sub="all-time" />
      <Kpi icon={<Database size={14} />} label="DB size" value={stats.database.pretty} sub={fmtBytes(Number(stats.database.bytes))} small />
    </div>
  );
}

function HeroStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, sub, small }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`font-serif font-medium leading-none text-ink ${small ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
          {value}
        </p>
        {sub && (
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-2 truncate">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
function RuntimeCard({ health }) {
  return (
    <Card>
      <CardContent>
        <SectionHeader icon={<Cpu size={11} />} label="Runtime" sub="Server + DB health · refreshes every 15s" />
        {health ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
            <DataPoint label="Uptime"    value={fmtSeconds(health.uptime_s)} />
            <DataPoint label="Memory"    value={`${health.memory_mb} MB`} />
            <DataPoint label="Heap used" value={`${health.heap_used_mb} / ${health.heap_total_mb} MB`} />
            <DataPoint label="DB latency" value={`${health.query_ms} ms`} accent={health.query_ms > 200} />
            <DataPoint label="Node"      value={health.node_version} />
            <DataPoint label="ENV"       value={health.env} accent={health.env !== "production"} />
            <DataPoint label="Platform"  value={health.platform} />
            <DataPoint label="PID"       value={health.pid} />
            <DataPoint
              label="DB time"
              value={health.db_time ? new Date(health.db_time).toLocaleTimeString() : "—"}
              mono
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataPoint({ label, value, accent, mono }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className={`text-ink ${mono ? "font-mono text-xs" : "text-sm"} ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

function fmtSeconds(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

// ────────────────────────────────────────────────────────────────────
function AuditFeed() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("");
  const [days, setDays] = useState(7);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRows(null);
    const qs = new URLSearchParams({ limit: "100" });
    if (filter) qs.set("action", filter);
    if (days) qs.set("since_days", String(days));
    api(`/api/dev/audit?${qs.toString()}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [filter, days]);

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <SectionHeader icon={<Activity size={11} />} label="Audit feed" sub="Every authenticated action in the system" inline />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className={selectClasses + " text-xs"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {AUDIT_ACTION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <div className="inline-flex items-center gap-1 bg-paper-warm border border-line rounded-lg p-1">
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded transition ${
                    days === d ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        {!rows && !error && (
          <ul className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="py-2 flex items-center gap-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-12" />
              </li>
            ))}
          </ul>
        )}
        {rows && rows.length === 0 && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-8 text-center">
            No matching events in the last {days}d.
          </p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-line/60 max-h-[480px] overflow-y-auto">
            {rows.map((a) => (
              <li key={a.id} className="py-3 flex items-start gap-3 text-sm">
                <ActionPill action={a.action} />
                <div className="flex-1 min-w-0">
                  <p className="text-ink truncate">
                    {a.first_name ? `${a.first_name} ${a.last_name || ""}`.trim() : `account #${a.account_id || "—"}`}
                    {a.role && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                        {ROLE_LABELS[a.role] || a.role}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[10px] text-muted truncate">
                    {a.email || "—"} · {a.target_table || "—"}{a.target_id ? `#${a.target_id}` : ""}
                    {a.ip ? ` · ${a.ip}` : ""}
                  </p>
                </div>
                <time className="font-mono text-[10px] text-muted whitespace-nowrap" dateTime={a.created_at}>
                  {timeAgo(a.created_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const ACTION_STYLES = {
  "auth.signup":                     { label: "signup",   color: "border-sage text-sage" },
  "auth.login":                      { label: "login",    color: "border-line text-muted" },
  "auth.renew":                      { label: "renew",    color: "border-gold text-gold" },
  "admin.teacher.create":            { label: "create",   color: "border-sage text-sage" },
  "admin.teacher.delete":            { label: "delete",   color: "border-accent text-accent" },
  "admin.teacher.suspended":         { label: "suspend",  color: "border-gold text-gold" },
  "admin.teacher.active":            { label: "activate", color: "border-sage text-sage" },
  "admin.teacher.role_update":       { label: "role",     color: "border-ink text-ink" },
  "superadmin.permissions.update":   { label: "perms",    color: "border-accent text-accent" },
  "dev.flag.toggle":                 { label: "flag",     color: "border-gold text-gold" },
  "school.remove":                   { label: "school-",  color: "border-accent text-accent" },
};

function ActionPill({ action }) {
  const s = ACTION_STYLES[action] || {
    label: action.split(".").slice(-1)[0],
    color: "border-line text-muted",
  };
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-paper ${s.color} flex-shrink-0`}>
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

// ────────────────────────────────────────────────────────────────────
function PermissionProbe() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      api(`/api/dev/search-accounts?q=${encodeURIComponent(q.trim())}`)
        .then(setResults)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadAccount = (id) => {
    api(`/api/dev/account/${id}`).then(setSelected).catch(() => {});
    setQ("");
    setResults([]);
  };

  const effective = useMemo(
    () => selected ? resolvePermissions(selected) : {},
    [selected]
  );

  return (
    <Card>
      <CardContent>
        <SectionHeader icon={<ShieldCheck size={11} />} label="Permission probe" sub="Resolve effective permissions for any account" />
        <div className="relative max-w-md mb-5">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className={inputClasses + " pl-9"}
            placeholder="Search by email or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {results.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-paper border border-line rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => loadAccount(r.id)}
                    className="w-full text-left px-3 py-2 hover:bg-paper-warm transition flex items-center gap-3"
                  >
                    <span className="text-ink text-sm flex-1 truncate">
                      {r.first_name} {r.last_name}
                    </span>
                    <span className="font-mono text-[10px] text-muted truncate">{r.email}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                      {ROLE_LABELS[r.role] || r.role}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!selected && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-8 text-center">
            Type a name or email above to inspect an account's permissions.
          </p>
        )}

        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <DataPoint label="Name" value={`${selected.first_name} ${selected.last_name}`} />
              <DataPoint label="Email" value={selected.email || "—"} mono />
              <DataPoint label="Role" value={`${ROLE_LABELS[selected.role] || selected.role}${selected.sub_role ? ` · ${selected.sub_role}` : ""}`} />
              <DataPoint label="Status" value={selected.status} accent={selected.status !== "active"} />
              <DataPoint label="Plan" value={selected.subscription_plan || "—"} />
              <DataPoint label="Subscription" value={selected.subscription_status || "—"} />
              <DataPoint label="Last login" value={selected.last_login_at ? new Date(selected.last_login_at).toLocaleString() : "—"} />
              <DataPoint label="ID" value={`#${selected.id}`} mono />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-3">
                Resolved permissions (role default + per-account overrides)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.id} className="bg-paper-warm rounded-lg p-3">
                    <p className="font-serif text-sm text-ink mb-2">{g.label}</p>
                    <ul className="space-y-1">
                      {g.keys.map(({ key, label }) => {
                        const on = effective[key];
                        const isOverride =
                          selected.permissions && typeof selected.permissions === "object" && (key in selected.permissions);
                        return (
                          <li key={key} className="flex items-center gap-2 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? "bg-sage" : "bg-line"}`} />
                            <span className={`flex-1 ${on ? "text-ink-soft" : "text-muted line-through"}`}>{label}</span>
                            {isOverride && (
                              <span className="font-mono text-[9px] uppercase tracking-wider text-accent flex-shrink-0">
                                override
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
const INSPECTOR_TABLES = [
  "accounts", "students", "schools", "account_schools",
  "templates", "drafts", "schedule_entries",
  "quizzes", "quiz_questions", "quiz_scores",
  "homework", "homework_submissions",
  "presentations", "activities", "activity_completions",
  "attendance", "student_grades",
  "notifications", "library_resources",
  "uploaded_images", "audit_log", "feature_flags",
];

function TableInspector({ stats }) {
  const [table, setTable] = useState(INSPECTOR_TABLES[0]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setRows([]);
    setError(null);
    api(`/api/dev/inspect/${table}?limit=50`)
      .then((d) => { setRows(d.rows); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [table]);

  // Live row count for the dropdown (helps you spot empty tables).
  const counts = useMemo(() => {
    if (!stats) return {};
    return Object.fromEntries(stats.tables.map((t) => [t.table_name, t.row_count]));
  }, [stats]);

  // Client-side filter against ANY column. Cheap when limit=50.
  const visible = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const cols = visible[0] ? Object.keys(visible[0]) : (rows[0] ? Object.keys(rows[0]) : []);

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <SectionHeader icon={<Database size={11} />} label="Table inspector" sub="50 newest rows from any public table" inline />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className={selectClasses + " text-xs md:w-56"}
              value={table}
              onChange={(e) => setTable(e.target.value)}
            >
              {INSPECTOR_TABLES.map((t) => (
                <option key={t} value={t}>
                  {t}{counts[t] != null ? ` (${counts[t]})` : ""}
                </option>
              ))}
            </select>
            <div className="relative w-48">
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                className={inputClasses + " pl-8 text-xs"}
                placeholder="Filter rows…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-3 bg-paper border border-accent rounded-lg p-3">
            <p className="text-sm text-accent">{error}</p>
          </div>
        )}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                {cols.map((c) => <th key={c} className="text-left py-2 px-3 font-medium whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-line/60">
                  {(cols.length ? cols : Array.from({ length: 5 })).map((_, j) => (
                    <td key={j} className="py-2 px-3"><Skeleton className="h-3 w-20" /></td>
                  ))}
                </tr>
              ))}
              {!loading && visible.map((row, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  {cols.map((c) => (
                    <td key={c} className="py-2 px-3 text-ink-soft font-mono whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis">
                      {row[c] === null ? <span className="text-muted">null</span> :
                        typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && visible.length === 0 && !error && (
                <tr><td colSpan={cols.length || 1} className="py-6 text-center text-muted">
                  {search ? "No rows match the filter." : "No rows."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
function FeatureFlagsCard() {
  const [flags, setFlags] = useState(null);
  const reload = () => api("/api/dev/feature-flags").then(setFlags).catch(() => {});
  useEffect(() => { reload(); }, []);

  const toggle = async (key, enabled) => {
    await api(`/api/dev/feature-flags/${key}`, { method: "PUT", body: { enabled } });
    reload();
  };

  return (
    <Card>
      <CardContent>
        <SectionHeader icon={<Flag size={11} />} label="Feature flags" sub="Runtime toggles · every change writes an audit row" />
        {!flags && (
          <ul className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-60" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </li>
            ))}
          </ul>
        )}
        {flags && flags.length === 0 && (
          <p className="text-sm text-muted py-6 text-center">No flags configured.</p>
        )}
        {flags && flags.length > 0 && (
          <ul className="divide-y divide-dashed divide-line">
            {flags.map((f) => (
              <li key={f.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-ink-soft">{f.key}</p>
                  <p className="text-xs text-muted mt-0.5">{f.description}</p>
                </div>
                <button
                  onClick={() => toggle(f.key, !f.enabled)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition ${
                    f.enabled
                      ? "bg-sage text-paper-cool border-sage"
                      : "bg-paper text-ink-soft border-line hover:border-ink"
                  }`}
                >
                  {f.enabled ? "On" : "Off"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, sub, inline }) {
  return (
    <div className={inline ? "" : "mb-5"}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {icon && <span className="inline-flex">{icon}</span>} {label}
      </p>
      {sub && <h3 className="font-serif text-lg text-ink">{sub}</h3>}
    </div>
  );
}
