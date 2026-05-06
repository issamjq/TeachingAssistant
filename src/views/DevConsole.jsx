import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { selectClasses, api } from "./_shared";

const TABLES = [
  "teachers", "templates", "drafts", "students",
  "schedule_entries", "quizzes", "quiz_questions", "quiz_scores",
  "homework", "homework_submissions", "attendance", "student_grades",
  "presentations", "activities", "notifications", "library_resources",
  "feature_flags",
];

export default function DevConsole() {
  const [flags, setFlags] = useState([]);
  const [health, setHealth] = useState(null);
  const [table, setTable] = useState(TABLES[0]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const reloadFlags = () => api("/api/dev/feature-flags").then(setFlags).catch(() => {});

  useEffect(() => {
    reloadFlags();
    api("/api/dev/health-detail").then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    setRows([]);
    setError(null);
    api(`/api/dev/inspect/${table}?limit=20`)
      .then((d) => setRows(d.rows))
      .catch((e) => setError(e.message));
  }, [table]);

  const toggleFlag = async (key, enabled) => {
    await api(`/api/dev/feature-flags/${key}`, { method: "PUT", body: { enabled } });
    reloadFlags();
  };

  const cols = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Dev
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Dev <em className="italic font-light text-accent">console</em>
        </h2>
        <p className="text-muted mt-2">
          Read-only data inspector, feature flag toggles, runtime stats. No writes from here.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-serif text-2xl font-medium text-ink mb-4">Feature flags</h3>
            <div className="space-y-3">
              {flags.map((f) => (
                <div key={f.key} className="flex items-start justify-between gap-4 py-2 border-b border-dashed border-line last:border-0">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-ink-soft">{f.key}</p>
                    <p className="text-xs text-muted">{f.description}</p>
                  </div>
                  <button
                    onClick={() => toggleFlag(f.key, !f.enabled)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition ${
                      f.enabled
                        ? "bg-sage text-paper-cool border-sage"
                        : "bg-paper text-ink-soft border-line hover:border-ink"
                    }`}
                  >
                    {f.enabled ? "On" : "Off"}
                  </button>
                </div>
              ))}
              {flags.length === 0 && <p className="text-sm text-muted">No flags configured.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-serif text-2xl font-medium text-ink mb-4">Runtime</h3>
            {health ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Uptime</dt><dd className="text-ink-soft font-mono">{health.uptime_s}s</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Memory</dt><dd className="text-ink-soft font-mono">{health.memory_mb} MB</dd></div>
                <div className="flex justify-between"><dt className="text-muted">DB latency</dt><dd className="text-ink-soft font-mono">{health.query_ms} ms</dd></div>
                <div className="flex justify-between"><dt className="text-muted">DB time</dt><dd className="text-ink-soft font-mono text-[11px] truncate">{health.db_time}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Node</dt><dd className="text-ink-soft font-mono">{health.node_version}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted">Loading…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="px-5 pt-5 pb-3 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h3 className="font-serif text-2xl font-medium text-ink">Table inspector</h3>
            <select className={selectClasses + " md:max-w-xs"} value={table} onChange={(e) => setTable(e.target.value)}>
              {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {error && (
            <div className="m-5 bg-paper border border-accent rounded-lg p-3">
              <p className="text-sm text-accent">{error}</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  {cols.map((c) => <th key={c} className="text-left py-2 px-3 font-medium">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    {cols.map((c) => (
                      <td key={c} className="py-2 px-3 text-ink-soft font-mono whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis">
                        {row[c] === null ? <span className="text-muted">null</span> :
                          typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && !error && (
                  <tr><td colSpan={cols.length || 1} className="py-6 text-center text-muted">No rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
