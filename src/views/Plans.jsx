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
  /**
   * Every plan she has asked about, not just the last one.
   *
   * This was a single key, so requesting Basic and then Pro moved the
   * "noted" line onto Pro and put a live button back on Basic — it read
   * as if the first request had been forgotten, which is the one thing a
   * request flow must not do.
   */
  const [asked, setAsked] = useState(() => new Set());
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
        // Seeded from the database so a reload does not offer to request
        // a plan she has already asked for.
        setAsked(new Set(p?.requested || []));
      })
      .catch((e) => setError(e.message));
  }, []);

  /**
   * Buy it, or ask for it.
   *
   * With Stripe configured this creates a Checkout Session and hands the
   * teacher over — card details never reach us. Without it, the old
   * request flow still works, so the page keeps functioning on the day
   * before the keys arrive rather than presenting dead buttons.
   *
   * Nothing here grants anything. The plan changes when a signed webhook
   * says the money arrived; this only opens the door to Stripe.
   */
  const choose = async (key, creditCount, kind) => {
    setBusy(key);
    try {
      if (payEnabled) {
        const body = { plan: key, period: annual ? "annual" : "monthly" };
        const { url } = await api("/api/billing/checkout", { method: "POST", body });
        if (!url) throw new Error("Stripe did not return a payment page.");
        window.location.href = url;
        return;                       // leaving the page; keep the spinner on
      }
      await api("/api/billing/request", { method: "POST", body: { plan: key, credits: creditCount, kind } });
      setAsked((prev) => new Set(prev).add(key));
    } catch (e) {
      setError(e.message);
    } finally {
      if (!payEnabled) setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
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
      <div className={`grid gap-4 ${annual ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {(annual ? data.plans || [] : [data.trial, ...(data.plans || [])].filter(Boolean)).map((p) => {
          const price = annual ? p.annual : p.price;
          const per = annual ? "/year" : "/month";
          const buys = worksOutAs(p.credits, costs);
          const current = credits?.plan === p.key;
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
              ) : asked.has(p.key) ? (
                <p className="text-sm text-sage text-center py-2.5">
                  Requested — we&rsquo;ll be in touch.
                  <span className="block text-xs text-muted mt-0.5">Nothing charged.</span>
                </p>
              ) : (
                /* The label says what the button actually does: until card
                   payments are switched on it registers interest, and
                   calling that "Choose Pro" promises a checkout that does
                   not exist yet. */
                <Button onClick={() => choose(p.key, p.credits, "subscription")} disabled={busy === p.key}>
                  {busy === p.key
                    ? (payEnabled ? "Taking you to Stripe…" : "Sending…")
                    : payEnabled
                      ? `Choose ${p.name}`
                      : `Request ${p.name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Said plainly rather than hidden behind a button that does nothing. */}
      {payEnabled === false && (
        <div className="border border-line rounded-xl p-5 bg-paper-warm/40 text-center">
          <p className="text-sm text-ink">
            <strong>Card payments are being switched on.</strong> Choose a plan above and we&rsquo;ll
            set it up with you directly — you won&rsquo;t lose anything you&rsquo;ve made in the
            meantime.
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
