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
  const [asked, setAsked] = useState(null);
  const [busy, setBusy] = useState(null);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    Promise.all([api("/api/billing/plans"), api("/api/auth/credits").catch(() => null)])
      .then(([p, c]) => { setData(p); setCredits(c); })
      .catch((e) => setError(e.message));
  }, []);

  const choose = async (key, creditCount, kind) => {
    setBusy(key);
    try {
      await api("/api/billing/request", { method: "POST", body: { plan: key, credits: creditCount, kind } });
      setAsked(key);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
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

      <div className="grid gap-4 md:grid-cols-3">
        {(data.plans || []).map((p) => {
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

              <p className="font-serif text-2xl text-ink">{p.name}</p>
              <p className="text-sm text-muted mt-1 mb-4">{p.blurb}</p>

              <p className="font-serif text-4xl text-ink">
                ${price}
                <span className="text-base text-muted font-sans"> {per}</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent mt-2 mb-5">
                {p.credits} credits a month
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
                  Your current plan
                </p>
              ) : asked === p.key ? (
                <p className="text-sm text-sage text-center py-2.5">
                  Noted — we&rsquo;ll be in touch.
                </p>
              ) : (
                <Button onClick={() => choose(p.key, p.credits, "subscription")} disabled={busy === p.key}>
                  {busy === p.key ? "…" : `Choose ${p.name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Top-ups: for the busy week, not the whole term. */}
      <div className="border border-line rounded-2xl p-6 bg-paper">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2">
              <Sparkles size={11} /> Top up
            </p>
            <h3 className="font-serif text-xl text-ink">Just need a bit more this month?</h3>
            <p className="text-sm text-muted mt-1">
              Added to your balance straight away. They roll into next month, once.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(data.topups || []).map((t) => {
            const lessons = costs?.lesson_plan ? Math.floor(t.credits / costs.lesson_plan) : null;
            return (
              <button
                key={t.key}
                onClick={() => choose(t.key, t.credits, "topup")}
                disabled={busy === t.key}
                className="border border-line rounded-xl p-4 text-start hover:border-ink transition disabled:opacity-50"
              >
                <p className="font-serif text-2xl text-ink">${t.price}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-accent mt-1">
                  {t.credits} credits
                </p>
                {lessons ? (
                  <p className="text-xs text-muted mt-1.5">about {lessons} more lessons</p>
                ) : null}
                {asked === t.key && (
                  <p className="text-xs text-sage mt-2">Noted — we&rsquo;ll be in touch.</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Said plainly rather than hidden behind a button that does nothing. */}
      <div className="border border-line rounded-xl p-5 bg-paper-warm/40 text-center">
        <p className="text-sm text-ink">
          <strong>Card payments are being switched on.</strong> Choose a plan above and we&rsquo;ll
          set it up with you directly — you won&rsquo;t lose anything you&rsquo;ve made in the
          meantime.
        </p>
      </div>

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
