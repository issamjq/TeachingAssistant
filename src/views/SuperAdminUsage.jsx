"use client";

// =====================================================================
// AI usage — the business view
//
// The only surface where the two currencies sit in the same row: the
// CREDITS we sell and the TOKENS they actually cost us. Everywhere else
// they are deliberately separated — a teacher never sees a token, and
// the studio never sees a dollar — but the question "is the price list
// right" cannot be answered without both.
//
// Four cuts of the same ledger:
//
//   overall     tokens, our cost, what we charged, what is left
//   per feature which features earn and which are sold under cost
//   per user    who burns what, on which plan, and whether they pay
//   per user
//   per feature one account opened up — the drill-down from the table
//
// `plan value` is contracted, NOT collected: card payments are not
// switched on, so anything labelled revenue would be a number that reads
// as money in the bank. Named for what it is.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Coins, Cpu, DollarSign, Users, ChevronRight, X, TrendingUp, AlertTriangle,
} from "lucide-react";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";

const WINDOWS = [7, 30, 90];

const fmtInt = (n) => Number(n || 0).toLocaleString();
const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtUsd4 = (n) => `$${Number(n || 0).toFixed(4)}`;
const fmtDay = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Tokens run to millions; a raw integer stops being readable. */
const fmtTokens = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
};

export default function SuperAdminUsage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [features, setFeatures] = useState(null);
  const [users, setUsers] = useState(null);
  const [daily, setDaily] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // faculty_id of the drill-down

  useEffect(() => {
    let live = true;
    setOverview(null); setFeatures(null); setUsers(null); setDaily(null);
    Promise.all([
      api(`/api/superadmin/ai/overview?days=${days}`),
      api(`/api/superadmin/ai/features?days=${days}`),
      api(`/api/superadmin/ai/users?days=${days}&limit=100`),
      api(`/api/superadmin/ai/daily?days=${days}`),
    ])
      .then(([o, f, u, d]) => {
        if (!live) return;
        setOverview(o); setFeatures(f); setUsers(u); setDaily(d); setError(null);
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

  const margin = Number(overview?.margin_usd ?? 0);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            AI <em className="italic font-light text-accent">usage</em>
          </h2>
          <p className="text-muted mt-2 max-w-2xl">
            What our teachers generated, what we charged them in credits, and
            what those tokens actually cost us upstream.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-line p-1">
          {WINDOWS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`font-mono text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-full transition ${
                days === d ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* The four numbers that matter. */}
      {!overview ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat
              icon={Cpu}
              label="Tokens"
              value={fmtTokens(overview.tokens_total)}
              note={`${fmtTokens(overview.tokens_in)} in · ${fmtTokens(overview.tokens_out)} out`}
            />
            <Stat
              icon={DollarSign}
              label="Our cost"
              value={fmtUsd(overview.cost_usd)}
              note="what Anthropic billed us"
            />
            <Stat
              icon={Coins}
              label="Charged"
              value={`${fmtInt(overview.credits)} cr`}
              note={`${fmtUsd(overview.charged_usd)} at $0.02 a credit`}
            />
            <Stat
              icon={TrendingUp}
              label="Margin"
              value={fmtUsd(margin)}
              note={
                Number(overview.charged_usd) > 0
                  ? `${Math.round((margin / Number(overview.charged_usd)) * 100)}% of what we charged`
                  : "nothing charged yet"
              }
              tone={margin < 0 ? "clay" : "sage"}
            />
          </div>

          {/* Cache saving is the whole reason the cache exists — show it. */}
          {Number(overview.cache_read) > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Prompt cache · {fmtTokens(overview.cache_read)} read at 10% ·{" "}
              {fmtTokens(overview.cache_write)} written at 125%
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <Stat icon={Users} label="Accounts" value={fmtInt(overview.accounts)}
                  note={`${fmtInt(overview.active_users)} generated in ${days} days`} />
            <Stat icon={Users} label="Paying" value={fmtInt(overview.paying)}
                  note={`${fmtInt(overview.trialing)} on trial`} />
            <Stat icon={DollarSign} label="Plan value" value={fmtUsd(overview.plan_value_usd)}
                  note="contracted, not collected — no card payments yet" />
            <Stat icon={Coins} label="Credits outstanding" value={fmtInt(overview.credits_outstanding)}
                  note="balances we owe as generation" />
          </div>
        </>
      )}

      {daily && daily.length > 1 && <DailyChart rows={daily} />}

      {/* Per feature. The row that decides whether a price is right. */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> By feature
        </p>
        {!features ? <Skeleton className="h-48 rounded-2xl" /> : (
          <Table
            cols={["Feature", "Runs", "Users", "Tokens", "Our cost", "Charged", "Avg cr", "Listed", "Margin"]}
            align={[0, 1, 1, 1, 1, 1, 1, 1, 1]}
          >
            {features.map((f) => {
              const m = Number(f.charged_usd) - Number(f.cost_usd);
              // A feature priced below what it costs is the one thing
              // this table exists to surface.
              const underwater = Number(f.charged_usd) > 0 && m < 0;
              return (
                <tr key={f.feature} className="border-t border-line">
                  <td className="px-3 py-2.5 text-ink">
                    {f.label}
                    {underwater && (
                      <AlertTriangle size={11} className="text-clay inline ms-1.5 -mt-0.5" />
                    )}
                  </td>
                  <Num>{fmtInt(f.runs)}</Num>
                  <Num>{fmtInt(f.users)}</Num>
                  <Num>{fmtTokens(Number(f.tokens_in) + Number(f.tokens_out) + Number(f.cache_read) + Number(f.cache_write))}</Num>
                  <Num>{fmtUsd4(f.cost_usd)}</Num>
                  <Num>{fmtInt(f.credits)} cr</Num>
                  <Num>{f.avg_credits ?? "—"}</Num>
                  <Num>{f.listed_credits ?? "—"}</Num>
                  <Num tone={underwater ? "clay" : undefined}>{fmtUsd4(m)}</Num>
                </tr>
              );
            })}
          </Table>
        )}
        <p className="text-xs text-muted mt-2">
          <strong>Avg cr</strong> is what a run actually charged;{" "}
          <strong>Listed</strong> is what the price list quotes. A gap between
          them means the quote on the composer is misleading.
        </p>
      </section>

      {/* Per user. Sorted by what they cost us. */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> By account
        </p>
        {!users ? <Skeleton className="h-64 rounded-2xl" /> : (
          <Table
            cols={["Account", "Plan", "Pays", "Runs", "Tokens", "Our cost", "Credits used", "Balance", "Net", ""]}
            align={[0, 0, 1, 1, 1, 1, 1, 1, 1, 1]}
          >
            {users.map((u) => (
              <tr
                key={u.faculty_id}
                className="border-t border-line hover:bg-paper-warm/40 cursor-pointer"
                onClick={() => setOpen(u.faculty_id)}
              >
                <td className="px-3 py-2.5">
                  <p className="text-ink">{u.name}</p>
                  <p className="font-mono text-[10px] text-muted">{u.email}</p>
                </td>
                <td className="px-3 py-2.5">
                  <Tier tier={u.tier} status={u.status} />
                </td>
                <Num>{Number(u.plan_usd) > 0 ? fmtUsd(u.plan_usd) : "—"}</Num>
                <Num>{fmtInt(u.runs)}</Num>
                <Num>{fmtTokens(Number(u.tokens_in) + Number(u.tokens_out) + Number(u.cache_read) + Number(u.cache_write))}</Num>
                <Num>{fmtUsd4(u.cost_usd)}</Num>
                <Num>{fmtInt(u.credits)} cr</Num>
                <Num tone={Number(u.balance) === 0 ? "clay" : undefined}>
                  {fmtInt(u.balance)}
                </Num>
                {/* Plan income minus what they burned. Negative on a
                    trial is expected; negative on a paid plan is not. */}
                <Num tone={Number(u.net_usd) < 0 && u.tier !== "trial" ? "clay" : undefined}>
                  {fmtUsd4(u.net_usd)}
                </Num>
                <td className="px-3 py-2.5 text-muted"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {open && <UserDrawer facultyId={open} days={days} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ── one account, opened up ───────────────────────────────────────────── */

function UserDrawer({ facultyId, days, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/superadmin/ai/users/${facultyId}?days=${days}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [facultyId, days]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/20"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl h-full bg-paper border-s border-line overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            {data ? (
              <>
                <h3 className="font-serif text-2xl text-ink truncate">{data.name}</h3>
                <p className="font-mono text-[10px] text-muted truncate">{data.email}</p>
              </>
            ) : (
              <Skeleton className="h-8 w-48" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink transition flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        )}
        {!data ? <Skeleton className="h-64 rounded-xl" /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Plan" value={<Tier tier={data.tier} status={data.status} />} />
              <Mini label="Pays" value={Number(data.plan_usd) > 0 ? `${fmtUsd(data.plan_usd)}/mo` : "—"} />
              <Mini label="Balance" value={`${fmtInt(data.balance)} / ${fmtInt(data.allowance)}`} />
              <Mini
                label="Renews"
                value={data.renews_at ? fmtDay(data.renews_at) : "—"}
              />
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                Per feature · last {days} days
              </p>
              {(data.by_feature || []).length === 0 ? (
                <p className="text-sm text-muted">Nothing generated in this window.</p>
              ) : (
                <Table cols={["Feature", "Runs", "Tokens", "Our cost", "Credits"]} align={[0, 1, 1, 1, 1]}>
                  {data.by_feature.map((f) => (
                    <tr key={f.feature} className="border-t border-line">
                      <td className="px-3 py-2 text-ink">{f.label}</td>
                      <Num>{fmtInt(f.runs)}</Num>
                      <Num>{fmtTokens(f.tokens)}</Num>
                      <Num>{fmtUsd4(f.cost_usd)}</Num>
                      <Num>{fmtInt(f.credits)}</Num>
                    </tr>
                  ))}
                </Table>
              )}
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                Recent generations
              </p>
              <Table cols={["When", "Feature", "In", "Out", "Cache", "Cost", "Cr"]} align={[0, 0, 1, 1, 1, 1, 1]}>
                {(data.recent || []).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-[10px] text-muted whitespace-nowrap">
                      {new Date(r.at).toLocaleString(undefined, {
                        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-ink">{r.label}</td>
                    <Num>{fmtInt(r.tokens_in)}</Num>
                    <Num>{fmtInt(r.tokens_out)}</Num>
                    <Num>{fmtTokens(Number(r.cache_read) + Number(r.cache_write))}</Num>
                    <Num>{fmtUsd4(r.cost_usd)}</Num>
                    <Num tone={Number(r.credits) === 0 ? "muted" : undefined}>{r.credits}</Num>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────── */

function Stat({ icon: Icon, label, value, note, tone }) {
  return (
    <div className="border border-line rounded-2xl p-5 bg-paper">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </p>
      <p className={`font-serif text-3xl ${tone === "clay" ? "text-clay" : "text-ink"}`}>
        {value}
      </p>
      {note && <p className="text-xs text-muted mt-1">{note}</p>}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="border border-line rounded-xl p-3 bg-paper">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className="text-ink text-sm">{value}</p>
    </div>
  );
}

function Tier({ tier, status }) {
  const trial = tier === "trial";
  return (
    <span
      className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        trial ? "border-gold/50 text-gold" : "border-sage/50 text-sage"
      }`}
      title={status}
    >
      {tier}
    </span>
  );
}

function Table({ cols, align = [], children }) {
  return (
    <div className="border border-line rounded-2xl bg-paper overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={c + i}
                className={`px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted ${
                  align[i] ? "text-end" : "text-start"
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Num({ children, tone }) {
  return (
    <td
      className={`px-3 py-2.5 text-end font-mono text-xs whitespace-nowrap ${
        tone === "clay" ? "text-clay" : tone === "muted" ? "text-muted" : "text-ink"
      }`}
    >
      {children}
    </td>
  );
}

/**
 * Cost and charge on the same axis, per day.
 *
 * Two bars per day rather than two charts: the gap between them IS the
 * margin, and putting them side by side makes a day where we generated
 * at a loss visible without reading a single number.
 */
function DailyChart({ rows }) {
  const peak = useMemo(
    () => rows.reduce((a, r) => Math.max(a, Number(r.cost_usd), Number(r.credits) * 0.02), 0) || 1,
    [rows],
  );
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-line" /> Day by day
        <span className="inline-flex items-center gap-1 ms-2 normal-case tracking-normal">
          <span className="w-2 h-2 rounded-sm bg-accent" /> charged
          <span className="w-2 h-2 rounded-sm bg-ink/30 ms-2" /> our cost
        </span>
      </p>
      <div className="border border-line rounded-2xl bg-paper p-5">
        <div className="flex items-end gap-2 h-36">
          {rows.map((r) => {
            const charged = Number(r.credits) * 0.02;
            return (
              <div key={r.day} className="flex-1 flex items-end justify-center gap-0.5 h-full min-w-0">
                <div
                  className="w-1/2 bg-accent/80 rounded-t"
                  style={{ height: `${Math.max(2, (charged / peak) * 100)}%` }}
                  title={`${fmtUsd4(charged)} charged on ${fmtDay(r.day)}`}
                />
                <div
                  className="w-1/2 bg-ink/30 rounded-t"
                  style={{ height: `${Math.max(2, (Number(r.cost_usd) / peak) * 100)}%` }}
                  title={`${fmtUsd4(r.cost_usd)} cost on ${fmtDay(r.day)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          {rows.map((r, i) => (
            <span key={r.day} className="flex-1 font-mono text-[9px] text-muted text-center truncate">
              {rows.length > 12 && i % 3 !== 0 ? "" : fmtDay(r.day)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
