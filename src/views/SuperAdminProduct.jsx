"use client";

// =====================================================================
// Usage & heatmaps — what people actually do in here
//
// Every other console screen counts things that exist: accounts,
// lessons, credits, dirhams. None of them can answer the question that
// decides what to build next, because the evidence isn't in the content
// tables. A lesson row proves a generation finished. It says nothing
// about the teacher who opened the studio, changed three settings,
// pressed Generate, and closed the tab.
//
// This screen reads the event ledger instead (db/tune.sql §95, written
// by lib/telemetry.ts), in six cuts:
//
//   when      day × hour — is the product used on Sunday night or in a
//             free period on Tuesday
//   where     click density per screen, plus the same data by control
//             name, because a bright patch says where and a name says what
//   what      one row per screen: views, uniques, dwell, and how much
//             goes wrong there
//   adoption  which features are habits and which were tried once
//   journey   the activation funnel, and where the cohort stops
//   retention weekly cohorts, which is the only chart here that can say
//             whether any of it is working
//
// The funnel and the retention grid deliberately do NOT come from the
// ledger: they read the content tables and the auth trail, so they
// answer for every account the product has ever had rather than only
// for the ones who arrived after telemetry shipped.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import { Activity, Users, Timer, TriangleAlert, Info } from "lucide-react";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";
import { HeatGrid, ClickMap, FunnelSteps, HBar } from "@/components/HeatCharts";

const WINDOWS = [7, 30, 90];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

const fmtInt = (n) => Number(n || 0).toLocaleString();
/** Seconds are unreadable past a minute and misleading below one. */
const fmtDwell = (s) => {
  const v = Number(s || 0);
  if (v <= 0) return "—";
  if (v < 60) return `${v.toFixed(0)}s`;
  return `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`;
};

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="bg-paper border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={tone === "warn" ? "text-accent" : "text-muted"} strokeWidth={1.9} />
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className={`font-serif text-3xl ${tone === "warn" ? "text-accent" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function Panel({ title, note, children, right }) {
  return (
    <section className="bg-paper border border-line rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-xl text-ink">{title}</h3>
          {note && <p className="text-xs text-muted mt-1 max-w-2xl">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function SuperAdminProduct() {
  const [days, setDays] = useState(30);
  const [section, setSection] = useState("");     // "" = every screen
  const [d, setD] = useState(null);               // the six payloads
  const [error, setError] = useState(null);
  const [clicks, setClicks] = useState(null);

  useEffect(() => {
    let live = true;
    setD(null);
    setError(null);
    Promise.all([
      api(`/api/superadmin/product/overview?days=${days}`),
      api(`/api/superadmin/product/screens?days=${days}`),
      api(`/api/superadmin/product/activity-heatmap?days=${days}`),
      api(`/api/superadmin/product/adoption?days=${days}`),
      api(`/api/superadmin/product/journey?days=90`),
      api(`/api/superadmin/product/retention?weeks=10`),
    ])
      .then(([overview, screens, when, adoption, journey, retention]) => {
        if (!live) return;
        setD({ overview, screens, when, adoption, journey, retention });
      })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [days]);

  // The click map reloads on its own when the screen picker moves, so
  // changing it doesn't throw away the other five payloads.
  useEffect(() => {
    let live = true;
    setClicks(null);
    api(`/api/superadmin/product/click-heatmap?days=${days}&bins=24${section ? `&section=${encodeURIComponent(section)}` : ""}`)
      .then((r) => live && setClicks(r))
      .catch(() => live && setClicks({ cells: [], targets: [], sections: [] }));
    return () => { live = false; };
  }, [days, section]);

  const whenCells = useMemo(() => {
    const cells = d?.when?.cells || [];
    return cells.map((c) => ({ row: c.dow, col: c.hour, n: c.n, users: c.users }));
  }, [d]);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  const o = d?.overview;
  // Telemetry that has never reported is the one state where every
  // number below is a zero that MEANS nothing, rather than a zero that
  // means "none". Saying so is the difference between a working console
  // and a console that looks like a dead product.
  const silent = o && Number(o.telemetry?.events || 0) === 0;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Usage &amp; <em className="italic font-light text-accent">heatmaps</em>
          </h2>
          <p className="text-muted mt-2 max-w-2xl">
            Which screens teachers open, when they open them, and where on
            those screens they click. Recorded without page content — a
            section name, a control&rsquo;s own label, and a position.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-line p-1">
          {WINDOWS.map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={`font-mono text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-full transition ${
                days === n ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>

      {silent && (
        <div className="bg-paper border border-line rounded-2xl p-5 flex gap-3">
          <Info size={16} className="text-accent flex-shrink-0 mt-0.5" strokeWidth={1.9} />
          <div>
            <p className="text-ink font-medium">No events recorded yet.</p>
            <p className="text-sm text-muted mt-1 max-w-2xl">
              The measurements below fill in as teachers use the studio — the
              browser batches events and flushes them every few seconds. The{" "}
              <strong className="text-ink font-medium">journey</strong> and{" "}
              <strong className="text-ink font-medium">retention</strong> panels
              are already populated: those read the content tables and the sign-in
              trail, so they answer for accounts that predate this screen.
            </p>
          </div>
        </div>
      )}

      {!o ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat
            icon={Users}
            label="Active people"
            value={fmtInt(o.active?.mau)}
            sub={`${fmtInt(o.active?.dau)} today · ${fmtInt(o.active?.wau)} this week`}
          />
          <Stat
            icon={Activity}
            label="Sessions"
            value={fmtInt(o.sessions?.count)}
            sub={`${o.sessions?.avg_sections ?? 0} screens each, typically`}
          />
          <Stat
            icon={Timer}
            label="Median session"
            value={`${o.sessions?.median_minutes ?? 0}m`}
            sub={`mean ${o.sessions?.avg_minutes ?? 0}m — the gap is the long tail`}
          />
          <Stat
            icon={TriangleAlert}
            tone={Number(o.friction?.per_100_views) > 5 ? "warn" : undefined}
            label="Friction rate"
            value={`${o.friction?.per_100_views ?? 0}`}
            sub={`per 100 screen views · ${fmtInt(o.friction?.errors)} errors, ${fmtInt(o.friction?.rage)} rage clicks`}
          />
        </div>
      )}

      {/* ── WHEN ── */}
      <Panel
        title="When the product is used"
        note="Day of the week against hour of the day, Gulf Standard Time. Darker is busier. This is the grid that decides when a deploy window is safe."
        right={
          d?.when && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {fmtInt(d.when.total)} events · peak {fmtInt(d.when.max)}
            </p>
          )
        }
      >
        {!d ? (
          <Skeleton className="h-44 rounded-xl" />
        ) : (
          <HeatGrid
            rows={DAYS}
            cols={HOURS}
            cells={whenCells}
            max={d.when?.max || 0}
            formatTitle={(row, col, cell) =>
              cell ? `${row} ${col}:00 — ${cell.n} events, ${cell.users} people` : `${row} ${col}:00 — quiet`
            }
          />
        )}
      </Panel>

      {/* ── WHERE ── */}
      <Panel
        title="Where they click"
        note="Click positions as a fraction of the viewport, so one map overlays every screen size. Dashed rings mark rage clicks — the same spot hit three times inside a second, which is what frustration looks like in data."
        right={
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="font-mono text-[10px] uppercase tracking-wider bg-paper border border-line rounded-full px-3 py-1.5 text-ink"
          >
            <option value="">Every screen</option>
            {(clicks?.sections || []).map((s) => (
              <option key={s.section} value={s.section}>
                {s.section} ({s.n})
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {!clicks ? (
              <Skeleton className="h-72 rounded-2xl" />
            ) : (
              <ClickMap cells={clicks.cells || []} bins={clicks.bins || 24} label={section || "any screen"} />
            )}
          </div>
          <div className="lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2">
              The same clicks, by control
            </p>
            {!clicks ? (
              <Skeleton className="h-72 rounded-xl" />
            ) : (
              <HBar
                rows={(clicks.targets || []).slice(0, 12).map((t) => ({
                  label: t.target,
                  value: t.clicks,
                  rage: t.rage,
                  users: t.users,
                }))}
                empty="No named controls clicked yet"
                format={(v, r) => (r.rage > 0 ? `${v} · ${r.rage} rage` : `${v}`)}
              />
            )}
          </div>
        </div>
      </Panel>

      {/* ── WHAT ── */}
      <Panel
        title="Screen by screen"
        note="Sorted by traffic. The right-hand columns are the reason this table is not just a popularity contest: a busy screen with a high error count is the most expensive thing in the product."
      >
        {!d ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : (d.screens || []).length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-6 text-center">
            No screen views recorded in this window
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Screen", "Views", "People", "Median stay", "Clicks", "Rage", "Dead", "Errors"].map((h, i) => (
                    <th
                      key={h}
                      className={`font-mono text-[10px] uppercase tracking-wider text-muted font-normal py-2 ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.screens.map((r) => (
                  <tr key={r.section} className="border-b border-line/50">
                    <td className="py-2.5 text-ink">{r.section}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink">{fmtInt(r.views)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink-soft">{fmtInt(r.users)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink-soft">{fmtDwell(r.median_seconds)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink-soft">{fmtInt(r.clicks)}</td>
                    <td className={`py-2.5 text-right font-mono text-xs ${r.rage > 0 ? "text-accent" : "text-muted"}`}>
                      {fmtInt(r.rage)}
                    </td>
                    <td className={`py-2.5 text-right font-mono text-xs ${r.dead > 0 ? "text-accent" : "text-muted"}`}>
                      {fmtInt(r.dead)}
                    </td>
                    <td className={`py-2.5 text-right font-mono text-xs ${r.errors > 0 ? "text-accent" : "text-muted"}`}>
                      {fmtInt(r.errors)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* ── ADOPTION ── */}
        <Panel
          title="What they use"
          note={
            d?.adoption
              ? `Share of the ${fmtInt(d.adoption.active_base)} people who did anything at all in this window. "Repeat" is the honest half — a feature everyone tried once is a demo, not a habit.`
              : "Feature adoption across the active base."
          }
        >
          {!d ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <HBar
              rows={(d.adoption?.features || []).map((f) => ({
                label: f.label,
                value: f.users,
                pct: f.adoption_pct,
                repeat: f.repeat_users,
              }))}
              empty="Nothing created or opened yet"
              format={(v, r) => `${v} people · ${r.pct}% · ${r.repeat} repeat`}
            />
          )}
        </Panel>

        {/* ── JOURNEY ── */}
        <Panel
          title="Getting to value"
          note={
            d?.journey
              ? `${fmtInt(d.journey.cohort)} accounts created in the last 90 days, and how far each got. Read from the content tables, so it answers for accounts older than this screen.`
              : "The activation funnel."
          }
        >
          {!d ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <FunnelSteps steps={d.journey?.steps || []} total={d.journey?.cohort || 0} />
          )}
        </Panel>
      </div>

      {/* ── RETENTION ── */}
      <Panel
        title="Do they come back"
        note="Signup week down the side, weeks since across the top. Built from the sign-in trail as well as the event ledger, so it reads the whole history rather than only the period since telemetry shipped."
      >
        {!d ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : (d.retention?.cohorts || []).length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-6 text-center">
            No cohorts yet
          </p>
        ) : (
          <RetentionGrid cohorts={d.retention.cohorts} weeks={d.retention.weeks} />
        )}
      </Panel>
    </div>
  );
}

/**
 * The retention triangle. Not HeatGrid, because the value shown is a
 * PERCENTAGE of each cohort while the shading has to be comparable
 * across cohorts of wildly different sizes — a heat ramp keyed on the
 * raw count would make every early cohort look dead next to a big
 * recent one, which is the opposite of what the chart is for.
 */
function RetentionGrid({ cohorts = [], weeks = 10 }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-separate" style={{ borderSpacing: "3px" }}>
        <thead>
          <tr>
            <th className="font-mono text-[10px] uppercase tracking-wider text-muted font-normal text-left pr-3">
              Cohort
            </th>
            <th className="font-mono text-[10px] uppercase tracking-wider text-muted font-normal pr-3">
              Size
            </th>
            {Array.from({ length: weeks }, (_, i) => (
              <th key={i} className="font-mono text-[10px] text-muted font-normal w-11">
                W{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort_week}>
              <td className="font-mono text-[11px] text-ink-soft whitespace-nowrap pr-3">
                {new Date(c.cohort_week).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </td>
              <td className="font-mono text-[11px] text-ink text-center pr-3">{c.size}</td>
              {Array.from({ length: weeks }, (_, i) => {
                const cell = (c.offsets || []).find((o) => o.week === i);
                const pct = Number(cell?.pct ?? 0);
                return (
                  <td
                    key={i}
                    className="text-center font-mono text-[11px] rounded"
                    style={{
                      // The two numbers are tied: type flips to paper
                      // only where the ground is dark enough to carry
                      // it. At 0.55 a 60% cell was pale and its white
                      // figure was barely legible — the reading that
                      // matters most on the chart, washed out.
                      background: pct > 0 ? `color-mix(in srgb, var(--color-accent) ${Math.min(pct, 100) * 0.9}%, transparent)` : "transparent",
                      border: pct > 0 ? "none" : "1px solid var(--color-line)",
                      color: pct >= 55 ? "var(--color-paper)" : "var(--color-ink)",
                    }}
                    title={`${cell?.n ?? 0} of ${c.size} active in week ${i}`}
                  >
                    {pct > 0 ? `${pct}%` : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
