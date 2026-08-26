"use client";

// =====================================================================
// Plans, and what they actually buy
//
// Reached from the low-balance banner and from Account → Upgrade plan.
// A teacher arrives here at the worst moment — she wanted to make
// something and could not — so the page has one job: say what she gets
// for what she pays, in the units she thinks in.
//
// "120 credits" means nothing to a teacher. "15 lessons, or 60 quizzes"
// means something. Those numbers are DERIVED from `ai_credit_costs` —
// the same table the meter quotes and charges from — so this page cannot
// drift from what actually happens when she presses generate.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import { Check, Coins, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";

/** What a pile of credits buys, in the things she actually makes. */
function worksOutAs(credits, costs) {
  if (!costs) return [];
  const rows = [
    ["lesson_plan", "lessons", "plan, teaching guide and student notes"],
    ["presentation", "slide decks", null],
    ["quiz", "quizzes", null],
    ["homework", "homework sheets", null],
  ];
  return rows
    .filter(([k]) => costs[k])
    .map(([k, label, note]) => ({
      label,
      note,
      n: Math.floor(credits / costs[k]),
    }));
}

export default function Plans() {
  const [data, setData] = useState(null);
  const [credits, setCredits] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [annual, setAnnual] = useState(false);
  /** null until asked, so the buttons do not flicker between two labels. */
  const [payEnabled, setPayEnabled] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/api/billing/plans"),
      api("/api/auth/credits").catch(() => null),
      api("/api/billing/config").catch(() => ({ enabled: false })),
    ])
      .then(([p, c, cfg]) => {
        setData(p);
        setCredits(c);
        setPayEnabled(Boolean(cfg?.enabled));
      })
      .catch((e) => setError(e.message));
  }, []);

  /**
   * Buy it. There is no other path.
   *
   * This used to fork: with Stripe configured it opened a Checkout
   * Session, and without it recorded a row in `plan_requests` and left
   * the card saying "Requested — we'll be in touch". That note then
   * outlived its own reason. The request is permanent, so a teacher who
   * asked about a plan before checkout existed could never buy that plan
   * afterwards — the card had replaced its own button with a receipt for
   * a conversation nobody was going to have.
   *
   * Now the button does one thing on every card, monthly or annual: it
   * goes to Stripe. If Stripe is not configured the request fails and
   * says so, which is honest, rather than quietly filing a note.
   *
   * Nothing is remembered on the way out. Coming back without paying —
   * cancelling, or just pressing back — leaves the page exactly as it
   * was, because the only thing that changes a card is a payment that
   * actually cleared.
   */
  const choose = async (key) => {
    setBusy(key);
    setError(null);   // a fresh attempt clears the last failure
    try {
      const { url } = await api("/api/billing/checkout", {
        method: "POST",
        body: { plan: key, period: annual ? "annual" : "monthly" },
      });
      if (!url) throw new Error("Stripe did not return a payment page.");
      window.location.href = url;
      // Deliberately no setBusy(null): the tab is leaving, and clearing
      // it would flash the button back to "Choose" mid-navigation.
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  };

  /**
   * Only a failure to LOAD replaces the page.
   *
   * A failed checkout must not: with the request flow gone, a click that
   * cannot reach Stripe is an ordinary outcome, and blanking the whole
   * grid over it left her staring at one line of error text with no
   * prices, no retry and no way back except a reload. Load failures
   * still take over, because there is nothing else to show.
   */
  if (error && !data) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  /**
   * PUBLIC TEST PERIOD (db/tune.sql §89).
   *
   * The studio shell already bounces this route out of the nav and out of
   * the URL bar while billing is off, so almost nobody reaches this. It is
   * here for the gap between the page mounting and the shell's redirect
   * effect running, and for anyone who lands with a stale link: a flash of
   * live price cards during a free period is a worse answer than a sentence
   * saying there is nothing to buy.
   */
  if (credits?.billing_enabled === false) {
    return (
      <div className="border border-line rounded-2xl p-6 bg-paper max-w-xl">
        <h2 className="font-serif text-2xl text-ink">Murchid is free right now.</h2>
        <p className="text-sm text-muted mt-2">
          We&rsquo;re in public testing, so there are no plans to choose and nothing to
          pay. Your credits are already on your account.
        </p>
      </div>
    );
  }

  if (!data) return <BrandLoader />;

  const balance = Number(credits?.balance ?? 0);
  const costs = data.costs;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-10">
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Plans
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Keep <em className="italic font-light text-accent">making things</em>
        </h2>
        <p className="text-muted mt-3 max-w-xl mx-auto">
          Everything on Murchid is included in every plan. What a plan buys is how much you
          generate — and only generating costs anything.
        </p>
        {credits && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-4 inline-flex items-center gap-1.5">
            <Coins size={11} /> {balance} credits left
            {credits.allowance ? <span className="opacity-60">of {credits.allowance}</span> : null}
          </p>
        )}
      </div>

      {/* Monthly / annual. Two months free is the ordinary shape and it is
          worth showing rather than burying in the small print. */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-line p-1">
          {[["Monthly", false], ["Annual · 2 months free", true]].map(([label, on]) => (
            <button
              key={label}
              onClick={() => setAnnual(on)}
              className={`font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-full transition ${
                annual === on ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/*
        Four across on a month view, three on a year view.

        The trial leads because it is what a visitor actually does next —
        every other card asks for a card number. It is dropped from the
        annual view on purpose: offering seven free days beside three
        yearly prices answers a question nobody asked.
      */}
      {/* A checkout that failed, said above the prices rather than instead
          of them — she can read what went wrong and press the button
          again without losing the page. Dismisses itself on the next
          attempt, because `choose` clears the error before it starts. */}
      {error && (
        <div
          className="border border-accent rounded-xl p-4 bg-paper flex items-start gap-3"
          role="alert"
        >
          <p className="text-sm text-ink flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className={`grid gap-4 ${annual ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {(annual ? data.plans || [] : [data.trial, ...(data.plans || [])].filter(Boolean)).map((p) => {
          const price = annual ? p.annual : p.price;
          const per = annual ? "/year" : "/month";
          const buys = worksOutAs(p.credits, costs);
          /**
           * Is this the card she is already on?
           *
           * `tier`, not `plan`. my_credits() returns both and they are
           * different axes: `plan` is the billing CADENCE ('monthly',
           * 'annual') and `tier` is the PRODUCT ('basic', 'pro', 'max').
           * Comparing plan against a tier key meant 'monthly' === 'pro',
           * which is false for every paid card — so a teacher who had
           * just paid for Pro was still offered a button to buy Pro.
           *
           * The period has to agree too, so someone on Pro monthly can
           * still switch to Pro annual: the annual card stays live for
           * her, and only the one she is actually on goes quiet.
           */
          const samePeriod = annual
            ? credits?.plan === "annual"
            : credits?.plan === "monthly";
          /**
           * A plan she is on AND paying for.
           *
           * `status` matters as much as the tier. When a renewal card
           * declines the webhook writes status='past_due' and leaves
           * tier and plan untouched — so a tier-only check called Max
           * her "current plan" and rendered no button on the one card
           * she needed to buy. She could not generate and could not
           * re-purchase.
           *
           * Gating on `subscription_active` is not enough either: it
           * stays true through the three-day grace, which would lock her
           * out for exactly as long as she is most likely to be trying
           * to fix it. Only a plan that is genuinely active hides its
           * own button.
           */
          const paying = credits?.status === "active" || credits?.status === "trialing";
          const current = p.is_trial
            ? credits?.tier === "trial" && paying
            : credits?.tier === p.key && samePeriod && paying;
          return (
            <div
              key={p.key}
              className={`relative border rounded-2xl p-6 bg-paper flex flex-col ${
                p.popular ? "border-accent shadow-sm" : "border-line"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-2.5 start-6 font-mono text-[9px] uppercase tracking-wider bg-accent text-paper px-2 py-0.5 rounded-full">
                  Most teachers
                </span>
              )}
              {p.is_trial && (
                <span className="absolute -top-2.5 start-6 font-mono text-[9px] uppercase tracking-wider bg-ink text-paper px-2 py-0.5 rounded-full">
                  Start here
                </span>
              )}

              <p className="font-serif text-2xl text-ink">{p.name}</p>
              <p className="text-sm text-muted mt-1 mb-4">{p.blurb}</p>

              <p className="font-serif text-4xl text-ink">
                {p.is_trial ? "Free" : `$${price}`}
                {!p.is_trial && <span className="text-base text-muted font-sans"> {per}</span>}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent mt-2 mb-5">
                {p.credits} credits
                {p.is_trial ? ` for ${p.trial_days} days` : " a month"}
              </p>

              {/* The part that actually decides it. */}
              <ul className="space-y-1.5 mb-5">
                {buys.map((b) => (
                  <li key={b.label} className="text-sm text-ink-soft flex items-baseline gap-2">
                    <span className="text-ink font-medium">{b.n}</span>
                    <span>{b.label} a month</span>
                  </li>
                ))}
                <li className="text-xs text-muted pt-1">…or any mix of them.</li>
              </ul>

              <ul className="space-y-1.5 mb-6 border-t border-line pt-4">
                {[
                  /* The trial is the same product, not a cut-down one —
                     what differs is how long it lasts, so that is the line
                     it leads with rather than a list of absences. */
                  ...(p.is_trial
                    ? [
                        `Ends ${p.trial_days} days after you sign up`,
                        "No card, and nothing charged automatically",
                      ]
                    : []),
                  "Every feature — nothing is held back by plan",
                  "Unlimited students, classes and scheduling",
                  "Attendance, marking and reports",
                  "Export to PPTX, Word and PDF",
                ].map((f) => (
                  <li key={f} className="text-xs text-muted flex items-start gap-2">
                    <Check size={12} className="text-sage mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>

              <span className="flex-1" />

              {current ? (
                <p className="font-mono text-[10px] uppercase tracking-wider text-sage text-center py-2.5">
                  {p.is_trial ? "You are on the trial" : "Your current plan"}
                </p>
              ) : p.is_trial ? (
                /* Nothing to request: the trial is what a new account is
                   already given, so this card informs rather than sells. */
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted text-center py-2.5">
                  Every account starts here
                </p>
              ) : (
                <Button onClick={() => choose(p.key)} disabled={busy === p.key}>
                  {busy === p.key ? "Taking you to Stripe…" : `Choose ${p.name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Stripe unreachable. The buttons above still go to checkout and
          will fail loudly there rather than silently doing nothing —
          this says why before she finds out the hard way. */}
      {payEnabled === false && (
        <div className="border border-line rounded-xl p-5 bg-paper-warm/40 text-center">
          <p className="text-sm text-ink">
            <strong>Card payments are temporarily unavailable.</strong> Nothing you have made is
            affected, and your current plan keeps working. Please try again shortly.
          </p>
        </div>
      )}
      {payEnabled && (
        <p className="text-center text-xs text-muted">
          Payments are handled by Stripe. Your card details never reach Murchid.
          Cancel any time from Billing.
        </p>
      )}

      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
          What a credit is
        </p>
        <p className="text-sm text-muted max-w-xl mx-auto">
          One credit is a small amount of AI work. A homework sheet is {costs?.homework ?? 2},
          a quiz is {costs?.quiz ?? 2}, a full lesson is {costs?.lesson_plan ?? 8}. You see the
          cost before you generate, and you are only charged for what you actually get —
          a refusal costs nothing.
        </p>
        <p className="text-xs text-muted mt-3 inline-flex items-center gap-1.5">
          Scheduling and the assistant are free <ArrowRight size={11} /> they never use credits
        </p>
      </div>
    </div>
  );
}
