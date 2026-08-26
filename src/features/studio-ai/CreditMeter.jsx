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
  // PUBLIC TEST PERIOD: no plan can lapse, so the only reason to say
  // anything is the balance itself. `left` is null only when there is no
  // allowance to measure against, and then there is nothing to warn about.
  if (!credits || left == null || hidden) return null;

  const balance = Number(credits.balance ?? 0);

  // Roughly, in the thing she makes most.
  const lessons = credits.costs?.lesson_plan
    ? Math.floor(balance / credits.costs.lesson_plan)
    : null;

  /**
   * ── PUBLIC TEST PERIOD ─────────────────────────────────────────────
   * There are no plans, so there is no lapsed-subscription state to warn
   * about and nothing to upgrade to. The banners say what is true — how
   * many credits are left — and offer no action, because there is no
   * action a teacher can take. Sending her to a pricing page that does
   * not exist would be worse than saying nothing.
   *
   * The lapsed-plan branch is removed rather than hidden: with plan
   * gating off in the backend, `subscription_active` can no longer be
   * false for a reason that stops her working, so a banner reading on it
   * would fire on a state that is not real.
   */
  if (balance === 0) {
    return (
      <Banner tone="clay">
        <strong>You&rsquo;ve used all your credits.</strong> Everything you&rsquo;ve made stays
        here and your classes carry on — you just can&rsquo;t generate anything new for now.
      </Banner>
    );
  }
  if (left <= 10) {
    return (
      <Banner tone="clay">
        <strong>{balance} credits left.</strong>{" "}
        {lessons ? <>About {lessons} more {lessons === 1 ? "lesson" : "lessons"}. </> : null}
      </Banner>
    );
  }
  if (left <= 20) {
    return (
      <Banner tone="gold" onDismiss={() => { setHidden(true); onDismiss?.(); }}>
        <strong>{balance} credits left</strong>
        {lessons ? <> — about {lessons} more {lessons === 1 ? "lesson" : "lessons"}</> : null}.
      </Banner>
    );
  }
  return null;
}

/**
 * PUBLIC TEST PERIOD: the warning no longer carries a way out, because
 * during the test there isn't one — every teacher has the same fixed
 * grant and there is nothing to buy. The `action` slot is gone rather
 * than left empty, so no future edit can point a button at /plans and
 * land the reader on a redirect.
 */
function Banner({ tone, children, onDismiss }) {
  return (
    <div
      className={`flex flex-wrap items-start gap-2.5 rounded-lg border px-3.5 py-2.5 mb-3 ${
        tone === "clay" ? "border-clay/40 bg-paper" : "border-gold/40 bg-paper"
      }`}
      role="status"
    >
      <AlertCircle size={14} className={tone === "clay" ? "text-clay mt-0.5" : "text-gold mt-0.5"} />
      <p className="text-sm text-ink flex-1 min-w-[200px]">{children}</p>
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
