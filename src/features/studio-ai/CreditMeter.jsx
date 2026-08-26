"use client";

// =====================================================================
// What this will cost, and what she has left
//
// A teacher cannot spend well against a number she cannot see. Until now
// the balance moved silently — every generation deducted the same single
// credit whatever it cost — and the first she knew of running out would
// have been a generation that refused.
//
// Three things, in the order she needs them:
//
//   the estimate   on the composer, before she presses anything, and it
//                  changes as she ticks formats or attaches a file
//   the balance    small, beside it, so the estimate has a context
//   the warning    at 20% and 10%, and a refusal she can act on at zero
//
// The estimate is the price list from `ai_credit_costs`. The CHARGE is
// metered from real tokens afterwards, so these two can differ — which
// is why the receipt says what it actually cost rather than repeating
// the quote.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Coins } from "lucide-react";
import { api } from "@/views/_shared";
import { navigate } from "@/lib/route";

/** Refetched after every generation, so the balance is never stale. */
export function useCredits() {
  const [data, setData] = useState(null);

  const refresh = useCallback(() => {
    api("/api/auth/credits")
      .then((d) => setData(d || null))
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { credits: data, refresh };
}

/**
 * What the current selection is quoted at.
 *
 * Mirrors estimateCredits() on the service — the same table, the same
 * one charge for reading attachments however many were attached. A
 * feature the table has never heard of falls back to 2 rather than 0, so
 * a new format cannot quietly appear as free.
 */
export function estimateFor(costs, kinds, hasMaterials) {
  if (!costs) return null;
  const work = (kinds || []).reduce((sum, k) => sum + (costs[k] ?? 2), 0);
  return work + (hasMaterials ? costs.materials ?? 3 : 0);
}

const pct = (c) =>
  c && c.allowance ? Math.round((c.balance / c.allowance) * 100) : null;

/** The line under the composer: what this costs, and what is left. */
export function CreditEstimate({ credits, kinds, hasMaterials }) {
  const estimate = useMemo(
    () => estimateFor(credits?.costs, kinds, hasMaterials),
    [credits, kinds, hasMaterials],
  );
  if (!credits || estimate == null) return null;

  const balance = Number(credits.balance ?? 0);
  const short = balance < estimate;
  const left = pct(credits);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${
        short ? "text-clay" : left != null && left <= 20 ? "text-gold" : "text-muted"
      }`}
      title={
        short
          ? `This needs about ${estimate} credits and you have ${balance}.`
          : `About ${estimate} credits · ${balance} left`
      }
    >
      <Coins size={11} />
      ~{estimate}
      <span className="opacity-60">/ {balance}</span>
    </span>
  );
}

/**
 * The warning, once it is worth interrupting for.
 *
 * Nothing at all above 20%: a banner a teacher sees every day is a
 * banner she stops reading, and the number is already on the composer.
 */
export function CreditWarning({ credits, onDismiss = undefined }) {
  const [hidden, setHidden] = useState(false);
  const left = pct(credits);
  // A lapsed account has a zero allowance, so pct() is null for exactly
  // the people who most need to be told why nothing works.
  const lapsed = credits?.subscription_active === false;
  if (!credits || (left == null && !lapsed) || hidden) return null;

  const balance = Number(credits.balance ?? 0);
  const renews = credits.renews_at
    ? new Date(credits.renews_at).toLocaleDateString(undefined, { day: "numeric", month: "long" })
    : null;

  // Roughly, in the thing she makes most.
  const lessons = credits.costs?.lesson_plan
    ? Math.floor(balance / credits.costs.lesson_plan)
    : null;

  /**
   * An ended plan is not an empty wallet.
   *
   * Both stop her generating, but only one is fixed by topping up —
   * offering credits to someone whose subscription lapsed sells her
   * something that will not work. Checked first, because a lapsed
   * account also has a zero balance and would otherwise fall into the
   * wrong branch.
   */
  if (credits.subscription_active === false) {
    return (
      <Banner tone="clay" action="See plans">
        <strong>Your plan has ended.</strong> Everything you&rsquo;ve made is still here and your
        classes carry on — new AI generations are paused until you pick a plan.
      </Banner>
    );
  }

  if (balance === 0) {
    return (
      <Banner tone="clay" action="Top up or upgrade">
        <strong>You&rsquo;re out of credits.</strong> Everything you&rsquo;ve made stays here and
        your classes carry on — you just can&rsquo;t generate anything new until you top up
        {renews ? <> or your plan renews on {renews}</> : null}.
      </Banner>
    );
  }
  if (left <= 10) {
    return (
      <Banner tone="clay" action="Top up or upgrade">
        <strong>{balance} credits left.</strong>{" "}
        {lessons ? <>About {lessons} more {lessons === 1 ? "lesson" : "lessons"}. </> : null}
        Top up or upgrade to keep going{renews ? <>, or wait until {renews}</> : null}.
      </Banner>
    );
  }
  if (left <= 20) {
    return (
      <Banner
        tone="gold"
        action="See plans"
        onDismiss={() => { setHidden(true); onDismiss?.(); }}
      >
        <strong>{balance} credits left</strong>
        {lessons ? <> — about {lessons} more {lessons === 1 ? "lesson" : "lessons"}</> : null}
        {renews ? <>. Renews {renews}.</> : "."}
      </Banner>
    );
  }
  return null;
}

/**
 * The warning always carries the way out.
 *
 * Telling a teacher she has run out and leaving her to find the fix is
 * how a billing message becomes a dead end — the button belongs on the
 * sentence that creates the need for it.
 */
function Banner({ tone, children, action, onDismiss }) {
  return (
    <div
      className={`flex flex-wrap items-start gap-2.5 rounded-lg border px-3.5 py-2.5 mb-3 ${
        tone === "clay" ? "border-clay/40 bg-paper" : "border-gold/40 bg-paper"
      }`}
      role="status"
    >
      <AlertCircle size={14} className={tone === "clay" ? "text-clay mt-0.5" : "text-gold mt-0.5"} />
      <p className="text-sm text-ink flex-1 min-w-[200px]">{children}</p>
      {action && (
        <button
          type="button"
          onClick={() => navigate(["plans"])}
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full transition flex-shrink-0 ${
            tone === "clay"
              ? "bg-ink text-paper hover:opacity-90"
              : "border border-ink text-ink hover:bg-paper-warm"
          }`}
        >
          {action}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

/**
 * What it actually cost, after the fact.
 *
 * Shown once per generation. The quote and the charge can differ — a
 * lesson about a whole chapter is not a lesson about a paragraph — and a
 * balance that moved by a different number than she was quoted is worth
 * accounting for rather than hiding.
 */
export function CreditReceipt({ spent, balance }) {
  if (!spent) return null;
  return (
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
      <Coins size={10} />
      Used {spent} {spent === 1 ? "credit" : "credits"}
      {balance != null && <span className="opacity-60">· {balance} left</span>}
    </p>
  );
}
