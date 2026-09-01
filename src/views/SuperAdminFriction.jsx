"use client";

// =====================================================================
// Where they get stuck
//
// The other half of Usage & heatmaps, and a separate screen behind a
// separate capability (admin.friction) for one reason: this one has
// people's names on it. Knowing that the studio's Generate button is
// rage-clicked is a product fact anyone on staff can see. Knowing that
// it is Fatima who tried nine times on Tuesday is a support fact, and
// giving it to everyone who can read a dashboard is how a console stops
// being trusted.
//
// Four questions, in the order you actually ask them:
//
//   1. what is failing        ranked friction points
//   2. what is slow           waiting is a different failure from breaking
//   3. who is stuck           named accounts, with a ratio, not a count
//   4. who never got started  the funnel's dropouts, by where they stopped
//
// The ranking is weighted, not a raw total. An error stopped someone; a
// rage click means they thought it was broken; a dead click means the
// affordance lied; a slow response is only friction past a couple of
// seconds. Weighting them 5/3/2/1 keeps one genuine failure above a
// dozen impatient clicks — see sa_friction in db/tune.sql §95.
// =====================================================================
import React, { useEffect, useState } from "react";
import { TriangleAlert, Zap, MousePointerClick, UserX, Mail, Info } from "lucide-react";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";
import { HBar } from "@/components/HeatCharts";

const WINDOWS = [7, 30, 90];
const fmtInt = (n) => Number(n || 0).toLocaleString();
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtMs = (ms) => {
  const v = Number(ms || 0);
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
};

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

/** A count with its own icon — four of these read faster than a table row. */
function Signal({ icon: Icon, n, label, hint }) {
  const hot = Number(n) > 0;
  return (
    <div className="bg-paper border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={hot ? "text-accent" : "text-muted"} strokeWidth={1.9} />
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className={`font-serif text-3xl ${hot ? "text-accent" : "text-ink"}`}>{fmtInt(n)}</p>
      <p className="text-xs text-muted mt-1">{hint}</p>
    </div>
  );
}

export default function SuperAdminFriction() {
  const [days, setDays] = useState(30);
  const [friction, setFriction] = useState(null);
  const [stuck, setStuck] = useState(null);
  const [journey, setJourney] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setFriction(null); setStuck(null); setJourney(null); setError(null);
    Promise.all([
      api(`/api/superadmin/friction?days=${days}&limit=40`),
      api(`/api/superadmin/stuck-users?days=${days}&limit=25`),
      api(`/api/superadmin/product/journey?days=90`),
    ])
      .then(([f, s, j]) => {
        if (!live) return;
        setFriction(f); setStuck(s); setJourney(j);
      })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [days]);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  const points = friction?.points || [];
  const totals = points.reduce(
    (a, p) => ({
      errors: a.errors + Number(p.errors || 0),
      rage: a.rage + Number(p.rage || 0),
      dead: a.dead + Number(p.dead || 0),
      abandons: a.abandons + Number(p.abandons || 0),
    }),
    { errors: 0, rage: 0, dead: 0, abandons: 0 }
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Where they get <em className="italic font-light text-accent">stuck</em>
          </h2>
          <p className="text-muted mt-2 max-w-2xl">
            Errors, rage clicks, dead controls and abandoned flows, ranked by
            how much each one actually cost someone. Then the accounts it
            happened to.
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

      {!friction ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Signal icon={TriangleAlert} n={totals.errors} label="Errors" hint="A request failed in front of someone" />
          <Signal icon={Zap} n={totals.rage} label="Rage clicks" hint="Same spot, three times, under a second" />
          <Signal icon={MousePointerClick} n={totals.dead} label="Dead clicks" hint="Clicked something that did nothing" />
          <Signal icon={UserX} n={totals.abandons} label="Abandoned" hint="A flow started and left unfinished" />
        </div>
      )}

      <Panel
        title="Ranked by cost, not by count"
        note="Weighted 5 / 3 / 2 / 1 across errors, rage, dead clicks and waiting, so one thing that genuinely broke outranks a dozen impatient taps. The message column is the class of failure — never anyone's content."
      >
        {!friction ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : points.length === 0 ? (
          <div className="flex items-start gap-3 py-6">
            <Info size={16} className="text-muted flex-shrink-0 mt-0.5" strokeWidth={1.9} />
            <p className="text-sm text-muted">
              Nothing recorded in this window. That means either a clean run or
              a browser that has not reported yet — the events panel on{" "}
              <span className="text-ink">Usage &amp; heatmaps</span> tells the two apart.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Screen", "What", "Errors", "Rage", "Dead", "Left", "People", "Last seen"].map((h, i) => (
                    <th
                      key={h}
                      className={`font-mono text-[10px] uppercase tracking-wider text-muted font-normal py-2 ${
                        i < 2 ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={`${p.section}-${p.target}-${i}`} className="border-b border-line/50 align-top">
                    <td className="py-2.5 text-ink whitespace-nowrap">{p.section || "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-ink-soft">{p.target}</span>
                      {p.last_message && (
                        <span className="block font-mono text-[10px] text-accent mt-0.5 truncate max-w-xs">
                          {p.last_message}
                        </span>
                      )}
                    </td>
                    <td className={`py-2.5 text-right font-mono text-xs ${p.errors > 0 ? "text-accent" : "text-muted"}`}>
                      {fmtInt(p.errors)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink-soft">{fmtInt(p.rage)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink-soft">{fmtInt(p.dead)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink-soft">{fmtInt(p.abandons)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink">{fmtInt(p.users)}</td>
                    <td className="py-2.5 text-right font-mono text-[10px] text-muted whitespace-nowrap">
                      {fmtDate(p.last_seen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Panel
          title="What makes them wait"
          note="95th percentile, not the average: the slow case is the one people remember, and an average with a fast majority in it hides exactly that."
        >
          {!friction ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <HBar
              rows={(friction.slowest || []).map((s) => ({
                label: `${s.section || "—"} · ${s.target}`,
                value: Number(s.p95_ms || 0),
                n: s.n,
                avg: s.avg_ms,
              }))}
              empty="Nothing measured as slow yet"
              format={(v, r) => `${fmtMs(v)} p95 · ${fmtMs(r.avg)} typical · ${r.n}×`}
            />
          )}
        </Panel>

        <Panel
          title="Who is stuck"
          note="Friction against work produced. Someone with forty rough edges and two hundred finished lessons is power-using the product; someone with twelve and nothing to show for it needs a call."
        >
          {!stuck ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : stuck.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-6 text-center">
              Nobody hit friction in this window
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {stuck.map((u) => (
                <li key={u.user_id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-ink truncate">{u.name}</p>
                    <p className="font-mono text-[10px] text-muted truncate">{u.email}</p>
                    {u.worst_section && (
                      <p className="text-xs text-muted mt-0.5">
                        mostly on <span className="text-ink-soft">{u.worst_section}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-serif text-xl text-accent">{fmtInt(u.friction)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      vs {fmtInt(u.work_items)} made
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Never got started"
        note="Accounts more than three days old that stopped somewhere in setup. Grouped by the step they stopped at, because that is what decides whether the fix is an email or a product change."
        right={
          journey && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {fmtInt((journey.stalled || []).length)} of {fmtInt(journey.cohort)} accounts
            </p>
          )
        }
      >
        {!journey ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : (journey.stalled || []).length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-6 text-center">
            Every account in the window got all the way through
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Account", "Stopped at", "Signed up", "Last seen", ""].map((h, i) => (
                    <th
                      key={h || i}
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
                {journey.stalled.map((s) => (
                  <tr key={s.faculty_id || s.email} className="border-b border-line/50">
                    <td className="py-2.5">
                      <span className="text-ink">{s.name}</span>
                      <span className="block font-mono text-[10px] text-muted">{s.email}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-paper border border-line font-mono text-[10px] uppercase tracking-wider text-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {s.stopped_at}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-[10px] text-muted whitespace-nowrap">
                      {fmtDate(s.created_at)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-[10px] text-muted whitespace-nowrap">
                      {fmtDate(s.last_login_at)}
                    </td>
                    <td className="py-2.5 text-right">
                      <a
                        href={`mailto:${s.email}`}
                        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft hover:text-accent transition"
                      >
                        <Mail size={12} strokeWidth={1.9} /> Reach out
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
