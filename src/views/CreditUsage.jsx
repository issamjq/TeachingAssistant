"use client";

// =====================================================================
// Where her credits went
//
// A balance that falls without an account of why is a bill nobody
// trusts. This is that account, and it is deliberately hers alone: the
// credits she spent, on which features, on which days.
//
// It shows NO tokens and NO dollar costs. Those are our supply price —
// what a lesson costs us upstream is not a number a teacher should have
// to reason about, and putting it here would turn every conversation
// about a plan into a conversation about our margin. The RPC behind
// this (my_ai_usage) does not return them at all, so this page cannot
// leak them by forgetting to strip a field.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import { Coins, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";
import { navigate } from "@/lib/route";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const fmtDay = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const fmtWhen = (t) =>
  new Date(t).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

export default function CreditUsage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/api/auth/usage?days=${days}`)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [days]);

  const features = data?.by_feature || [];
  const busiest = useMemo(
    () => features.reduce((a, f) => Math.max(a, f.credits || 0), 0),
    [features],
  );

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!data) return <BrandLoader />;

  const balance = Number(data.balance ?? 0);
  const allowance = Number(data.allowance ?? 0);
  const spent = Number(data.spent ?? 0);
  const used = allowance ? Math.min(100, Math.round(((allowance - balance) / allowance) * 100)) : 0;
  const low = allowance > 0 && balance / allowance <= 0.2;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Your account
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Credits <em className="italic font-light text-accent">used</em>
          </h2>
          <p className="text-muted mt-2 max-w-xl">
            Only generating costs credits. Scheduling, marking, attendance and
            everything your students do are free.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-line p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              className={`font-mono text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-full transition ${
                days === w.days ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* The balance, and how much of the month's allowance is gone. */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-line rounded-2xl p-5 bg-paper md:col-span-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
            <Coins size={11} /> Balance
          </p>
          <p className="font-serif text-4xl text-ink">{balance}</p>
          {allowance > 0 && (
            <>
              <p className="text-xs text-muted mt-1">of {allowance} this month</p>
              <div className="h-1.5 rounded-full bg-line mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${low ? "bg-clay" : "bg-accent"}`}
                  style={{ width: `${used}%` }}
                />
              </div>
            </>
          )}
          {data.renews_at && (
            <p className="text-xs text-muted mt-2">Renews {fmtDay(data.renews_at)}</p>
          )}
        </div>

        <Stat label={`Spent in ${days} days`} value={spent} icon={TrendingUp} />
        <Stat label={`Generations in ${days} days`} value={data.generations ?? 0} icon={Clock} />
      </div>

      {low && (
        <div className="border border-clay/40 rounded-xl p-4 bg-paper flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink flex-1 min-w-[220px]">
            <strong>Running low.</strong> Top up or move to a bigger plan to keep generating.
          </p>
          <Button onClick={() => navigate(["plans"])}>See plans</Button>
        </div>
      )}

      {/* Per feature — the question she actually has. */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> What you spent it on
        </p>
        {features.length === 0 ? (
          <div className="border border-line rounded-xl p-10 text-center">
            <p className="text-sm text-muted">
              Nothing generated in the last {days} days.
            </p>
          </div>
        ) : (
          <div className="border border-line rounded-2xl bg-paper divide-y divide-line">
            {features.map((f) => (
              <div key={f.feature} className="p-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium">{f.label}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {f.runs} {f.runs === 1 ? "generation" : "generations"}
                  </p>
                  {/* Proportion, not a chart library — one bar says it. */}
                  <div className="h-1.5 rounded-full bg-line mt-2.5 overflow-hidden max-w-md">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${busiest ? (f.credits / busiest) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <p className="font-serif text-2xl text-ink flex-shrink-0">
                  {f.credits}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted ms-1.5">
                    cr
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Day by day, so a heavy week is visible. */}
      {(data.by_day || []).length > 1 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-line" /> Day by day
          </p>
          <DayBars rows={data.by_day} />
        </section>
      )}

      {/* The receipt: every charge, most recent first. */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-line" /> Recent charges
        </p>
        {(data.recent || []).length === 0 ? (
          <p className="text-sm text-muted">Nothing charged yet.</p>
        ) : (
          <div className="border border-line rounded-2xl bg-paper divide-y divide-line">
            {data.recent.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{r.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {fmtWhen(r.at)}
                  </p>
                </div>
                <p className="font-mono text-xs text-ink flex-shrink-0">−{r.credits}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="border border-line rounded-xl p-5 bg-paper-warm/40 text-center">
        <p className="text-sm text-muted">
          Credits are charged as a document is written, not after — so a
          generation you stop halfway only costs you the part that was written.
        </p>
        <button
          type="button"
          onClick={() => navigate(["plans"])}
          className="font-mono text-[10px] uppercase tracking-wider text-ink mt-2 inline-flex items-center gap-1.5 hover:text-accent transition"
        >
          Plans and top-ups <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="border border-line rounded-2xl p-5 bg-paper">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </p>
      <p className="font-serif text-4xl text-ink">{value}</p>
    </div>
  );
}

/**
 * Bars, drawn with divs.
 *
 * A chart library for six bars is a hundred kilobytes to say what a
 * flexbox says. Heights are relative to the busiest day, so the shape is
 * readable whether she spends four credits a week or four hundred.
 */
function DayBars({ rows }) {
  const peak = rows.reduce((a, r) => Math.max(a, r.credits || 0), 0) || 1;
  return (
    <div className="border border-line rounded-2xl bg-paper p-5">
      <div className="flex items-end gap-1.5 h-32">
        {rows.map((r) => (
          <div key={r.day} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
            <span className="font-mono text-[9px] text-muted">{r.credits}</span>
            <div
              className="w-full bg-accent/80 rounded-t"
              style={{ height: `${Math.max(3, (r.credits / peak) * 100)}%` }}
              title={`${r.credits} credits on ${fmtDay(r.day)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-2">
        {rows.map((r, i) => (
          <span
            key={r.day}
            className="flex-1 font-mono text-[9px] text-muted text-center truncate"
          >
            {/* Only every other label when it is crowded. */}
            {rows.length > 12 && i % 3 !== 0 ? "" : fmtDay(r.day)}
          </span>
        ))}
      </div>
    </div>
  );
}
