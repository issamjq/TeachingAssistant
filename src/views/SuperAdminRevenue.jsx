"use client";

// =====================================================================
// Revenue — what they paid us
//
// The mirror of the AI usage page. That one answers "what did this
// cost", this one answers "what came in", and neither means much alone:
// an account burning $4 of tokens on a 45 AED plan is a different
// problem from the same burn on a 295 AED plan. Both numbers sit in the
// per-account table for exactly that reason.
//
// Money is summed from `payments`, never from the plan price. A plan
// price says what a teacher SHOULD be paying; only a payment row says
// what actually arrived, and the gap between those two is the thing a
// billing console exists to show.
// =====================================================================
import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Users, TrendingUp, AlertTriangle, X, RefreshCw, Lock, Unlock } from "lucide-react";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";

const WINDOWS = [7, 30, 90];

const money = (minor, currency = "aed") =>
  `${String(currency).toUpperCase()} ${(Number(minor || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS = {
  paid: "text-sage", pending: "text-muted", failed: "text-clay",
  refunded: "text-muted", canceled: "text-muted",
};

export default function SuperAdminRevenue() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState(null);      // the master billing switch
  const [flipping, setFlipping] = useState(false);
  const [confirm, setConfirm] = useState(null); // the target state awaiting a yes
  const [flipError, setFlipError] = useState(null);

  const loadMode = useCallback(() => {
    api("/api/superadmin/billing-mode")
      .then(setMode)
      .catch((e) => setFlipError(e.message));
  }, []);
  useEffect(() => { loadMode(); }, [loadMode]);

  /**
   * Throw the switch, then reload everything.
   *
   * The RPC rewrites credits and subscriptions in the same transaction as
   * the flag, so the numbers on this page are stale the instant it
   * returns — reloading is not a nicety, it is the difference between the
   * console showing the platform and showing what the platform was.
   */
  const flip = async (next) => {
    setFlipping(true);
    setFlipError(null);
    try {
      await api("/api/superadmin/billing-mode", {
        method: "PATCH",
        body: { enabled: next },
      });
      setConfirm(null);
      loadMode();
      setOverview(null); setUsers(null);
      const [o, u] = await Promise.all([
        api(`/api/superadmin/revenue/overview?days=${days}`),
        api(`/api/superadmin/revenue/users?limit=100`),
      ]);
      setOverview(o); setUsers(u);
    } catch (e) {
      setFlipError(e.message);
    } finally {
      setFlipping(false);
    }
  };

  useEffect(() => {
    let live = true;
    setOverview(null); setUsers(null);
    Promise.all([
      api(`/api/superadmin/revenue/overview?days=${days}`),
      api(`/api/superadmin/revenue/users?limit=100`),
    ])
      .then(([o, u]) => { if (!live) return; setOverview(o); setUsers(u); setError(null); })
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

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Revenue <em className="italic font-light text-accent">and plans</em>
          </h2>
          <p className="text-muted mt-2 max-w-2xl">
            What every account is on, what it costs them, and what has actually been
            collected.
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

      <BillingSwitch
        mode={mode}
        flipping={flipping}
        error={flipError}
        confirm={confirm}
        onAsk={setConfirm}
        onCancel={() => setConfirm(null)}
        onConfirm={flip}
      />

      {!overview ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat
              icon={CreditCard} label={`Collected · ${days} days`}
              value={money(overview.collected_minor, overview.currency)}
              note={`${overview.payments} payment${overview.payments === 1 ? "" : "s"}`}
            />
            <Stat
              icon={RefreshCw} label="MRR"
              value={money(overview.mrr_minor, overview.currency)}
              note="under contract now · annual shown monthly"
            />
            <Stat
              icon={Users} label="Paying accounts"
              value={overview.paying_accounts}
              note={`${overview.subscriptions} plans · ${overview.topups} top-ups`}
            />
            {/* Refused cards only. Abandoned checkouts used to be counted
                here, which turned "someone closed a tab" into "a payment
                failed" — the alarming reading of a number that needs no
                action. They sit in the note now, next to pending. */}
            <Stat
              icon={AlertTriangle} label="Cards refused"
              value={overview.failed}
              note={`${overview.pending} in flight · ${overview.abandoned ?? 0} abandoned`}
              tone={overview.failed > 0 ? "clay" : undefined}
            />
          </div>

          {Number(overview.refunded_minor) > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Refunded in this window · {money(overview.refunded_minor, overview.currency)}
            </p>
          )}
        </>
      )}

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> By account
        </p>
        {!users ? <Skeleton className="h-64 rounded-2xl" /> : (
          <div className="border border-line rounded-2xl bg-paper overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Account", "Plan", "Billing", "Costs them", "Paid to date", "Payments", "Last paid", "Renews", ""]
                    .map((c, i) => (
                      <th key={c + i}
                        className={`px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted ${
                          i >= 3 && i <= 5 ? "text-end" : "text-start"
                        }`}>
                        {c}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
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
                      <Tier tier={u.tier} status={u.status} cancelling={u.cancelling} />
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      {u.billing_period || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs text-ink whitespace-nowrap">
                      {u.plan_aed ? `AED ${Number(u.plan_aed).toFixed(0)}` : "—"}
                    </td>
                    {/* The number that decides whether an account is real. */}
                    <td className={`px-3 py-2.5 text-end font-mono text-xs whitespace-nowrap ${
                      Number(u.paid_minor) > 0 ? "text-ink" : "text-muted"
                    }`}>
                      {money(u.paid_minor, "aed")}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs text-ink">{u.payments}</td>
                    <td className="px-3 py-2.5 text-ink-soft whitespace-nowrap">{day(u.last_paid_at)}</td>
                    <td className="px-3 py-2.5 text-ink-soft whitespace-nowrap">{day(u.renews_at)}</td>
                    <td className="px-3 py-2.5 text-muted">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && <ReceiptsDrawer facultyId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Every receipt for one account, including the ones that failed. */
function ReceiptsDrawer({ facultyId, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/superadmin/revenue/users/${facultyId}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [facultyId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/20" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-2xl h-full bg-paper border-s border-line overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h3 className="font-serif text-2xl text-ink">Receipts</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>}
        {!rows ? <Skeleton className="h-64 rounded-xl" /> : rows.length === 0 ? (
          <p className="text-sm text-muted">This account has never been charged.</p>
        ) : (
          <div className="border border-line rounded-xl bg-paper overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Date", "What", "Credits", "Amount", "Status"].map((c, i) => (
                    <th key={c}
                      className={`px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted ${
                        i > 1 ? "text-end" : "text-start"
                      }`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-soft whitespace-nowrap">
                      {day(r.paid_at || r.created_at)}
                    </td>
                    <td className="px-3 py-2 text-ink">
                      {r.kind === "topup" ? "Top-up" : "Plan"}
                      {r.tier && <span className="text-muted"> · {r.tier}</span>}
                      {r.billing_period && <span className="text-muted"> · {r.billing_period}</span>}
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-xs text-ink">
                      {r.credits_granted || "—"}
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-xs text-ink whitespace-nowrap">
                      {money(r.amount_minor, r.currency)}
                    </td>
                    <td className={`px-3 py-2 text-end font-mono text-[10px] uppercase tracking-wider ${
                      STATUS[r.status] || "text-muted"
                    }`}>
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tier({ tier, status, cancelling }) {
  const paid = tier && !["trial", "free"].includes(tier);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        title={status}
        className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
          paid ? "border-sage/50 text-sage"
               : tier === "free" ? "border-clay/50 text-clay"
               : "border-gold/50 text-gold"
        }`}
      >
        {tier || "—"}
      </span>
      {cancelling && (
        <span className="font-mono text-[9px] uppercase tracking-wider text-clay">cancelling</span>
      )}
    </span>
  );
}

function Stat({ icon: Icon, label, value, note, tone }) {
  return (
    <div className="border border-line rounded-2xl p-5 bg-paper">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </p>
      <p className={`font-serif text-3xl ${tone === "clay" ? "text-clay" : "text-ink"}`}>{value}</p>
      {note && <p className="text-xs text-muted mt-1">{note}</p>}
    </div>
  );
}


/**
 * The master switch: does this platform sell plans, or is it free?
 *
 * It sits on the revenue page rather than in the feature-flags list
 * because it is not a feature flag. The generic flag setter flips a
 * boolean; this one rewrites `credits` and `subscriptions` for every
 * account in the same transaction, and the place to put a control with
 * that reach is next to the numbers it changes — a super admin watching
 * collected revenue is exactly the person deciding whether to stop
 * collecting it.
 *
 * Two-step, always. A single click cannot move it. The confirmation is
 * not ceremony: it names how many accounts will be rewritten, and those
 * counts come from the server before the flip rather than being guessed
 * here, so the number shown is the number affected.
 */
function BillingSwitch({ mode, flipping, error, confirm, onAsk, onCancel, onConfirm }) {
  /**
   * Three states, and they must not look alike.
   *
   * Loading is a skeleton. A permission error is nothing at all — the
   * revenue page is reachable by sub-admins and sa_billing_mode() is
   * gated on `admin.billing`, so someone without it should simply not
   * see a control that is not theirs.
   *
   * Anything else is SHOWN. Returning null on every error hid the switch
   * completely when the RPC did not exist yet, which reads as "the
   * feature was never built" rather than "the migration has not run" —
   * an hour of looking for a missing toggle that was there all along.
   * A control that cannot load should say so.
   */
  if (!mode) {
    if (!error) return <Skeleton className="h-28 rounded-2xl" />;
    if (/permission|denied|not permitted|forbidden/i.test(error)) return null;
    return (
      <div className="border border-clay/40 rounded-2xl p-5 bg-paper">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2">
          Billing mode
        </p>
        <p className="text-sm text-ink">
          The switch can&rsquo;t load. If this says the function is missing, the database
          migration hasn&rsquo;t been applied yet &mdash; run <code>npm run db:tune</code>.
        </p>
        <p className="font-mono text-[10px] text-accent mt-2 break-all">{error}</p>
      </div>
    );
  }

  const on = mode.enabled !== false;
  const target = confirm;
  const asking = target !== null && target !== undefined;

  return (
    <div className={`border rounded-2xl p-5 ${on ? "border-line bg-paper" : "border-gold/50 bg-paper-warm/30"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[260px] flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
            {on ? <Lock size={11} /> : <Unlock size={11} />} Billing mode
          </p>
          <p className="font-serif text-2xl text-ink">
            {on ? "Plans are on sale" : "Free public test"}
          </p>
          <p className="text-sm text-muted mt-1.5 max-w-xl">
            {on ? (
              <>
                Teachers see plans, billing and their tier. Trials end, cards are charged,
                and credits follow the tier they paid for.
              </>
            ) : (
              <>
                No plans, no billing and no subscription anywhere in a teacher&rsquo;s panel.
                Everyone gets {mode.free_grant} credits and nothing lapses. The usage page
                stays, and credits cost exactly what they cost on a plan.
              </>
            )}
          </p>
        </div>

        {!asking && (
          <button
            type="button"
            onClick={() => onAsk(!on)}
            disabled={flipping}
            className={`font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-full transition flex-shrink-0 disabled:opacity-50 ${
              on ? "border border-ink text-ink hover:bg-paper-warm" : "bg-ink text-paper hover:opacity-90"
            }`}
          >
            {on ? "Switch to free" : "Turn billing back on"}
          </button>
        )}
      </div>

      {asking && (
        <div className="mt-4 pt-4 border-t border-line">
          {/* Say what it does to real rows, not "are you sure". */}
          <p className="text-sm text-ink">
            {target === false ? (
              <>
                <strong>Turn billing off for everyone?</strong> All {mode.accounts} account
                {mode.accounts === 1 ? "" : "s"} move to {mode.free_grant} credits, lapsed
                accounts reopen, and plans and billing disappear from every teacher&rsquo;s
                panel. Balances are only ever raised, never cut.
                {mode.paying > 0 && (
                  <>
                    {" "}
                    <span className="text-clay">
                      {mode.paying} account{mode.paying === 1 ? " is" : "s are"} on a paid
                      plan — they keep their tier and are not cancelled here, but nothing
                      will be gating on it.
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <strong>Put billing back on?</strong> Every account returns to its own
                tier&rsquo;s monthly allowance, and anyone who signed up during the free
                period gets a fresh 7-day trial starting now. Balances already granted stay
                put — they settle to the real tier at the next monthly refresh.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => onConfirm(target)}
              disabled={flipping}
              className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-full bg-ink text-paper hover:opacity-90 transition disabled:opacity-50"
            >
              {flipping ? "Applying\u2026" : target === false ? "Yes, make it free" : "Yes, start charging"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={flipping}
              className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-full border border-line text-ink-soft hover:text-ink transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent mt-3">{error}</p>
      )}
    </div>
  );
}
