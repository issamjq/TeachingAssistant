"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { CREDIT_TIERS, TRIAL_DAYS, annualSavePct, annualFreeMonths } from "@/lib/plans";
import { useT } from "@/shared/i18n";
import s from "../Landing.module.css";

// Pricing: three sizes of the same studio.
//
// This board used to sell one product on three billing cadences, at a
// price (29.99 AED) that nothing in the system charged. It now shows what
// /plans shows — Basic, Pro, Max — because a visitor who signs up should
// not meet a different price list on the other side of the door.
//
// The tiers differ by monthly allowance and NOTHING else, which is why the
// five inclusions still appear once, under all three, instead of being
// repeated per column with ticks and crosses. There is no feature held
// back by plan, and the layout should not imply there is.
//
// Two currencies on purpose: the dollar figure is the one /plans shows and
// the one this market quotes, the dirham figure is what the card is
// actually charged. A visitor who works out that 45 AED is $12.25 should
// find we said so first.
//
// The saving is computed from the prices beside it (see annualSavePct in
// src/lib/plans.js), not typed in — a badge that has to be kept in sync by
// hand is a badge that ends up lying.
//
// Adaptive by structure: the columns are an auto-fitting grid that drops
// to a single stack under 720px with nothing clipped, nothing fixed
// height, and the featured lift disabled where columns stack.

// Every feature, named one by one, in one place — outside the cards.
//
// It used to be five grouped lines ("Presentations, quizzes, exams,
// homework and activities"), which reads like a summary of a product
// rather than a list of what you get. Twenty short items scan faster
// than five long ones and, more to the point, they are countable: the
// argument this section is making is that NOTHING here is withheld by
// tier, and that argument is only as convincing as the list is specific.
//
// It lives under the cards rather than in them for the same reason. Put
// it in a column and it reads as that column's feature set, which invites
// the reader to hunt for what the cheaper card is missing. There is
// nothing missing.
//
// Twenty is not arbitrary: the list renders as a five-column flow, and
// twenty fills it 4/4/4/4/4 with no short final column. Adding a feature
// here means checking that the count still divides — or accepting the
// ragged column, which is the lesser sin of the two.
const INCLUDED = [
  "f1", "f2", "f3", "f4", "f5", "f6",
  "f7", "f8", "f9", "f10",
  "f11", "f12", "f13", "f14", "f15", "f16", "f17",
  "f18", "f19", "f20",
] as const;

export default function Pricing() {
  const t = useT();

  return (
    <section className={`${s.shell} ${s.section}`} id="pricing">
      <div className={s.sectionHead} data-reveal-stagger>
        <h2 className={s.sectionTitle} data-reveal-item>
          {t("mk.price.title")}
        </h2>
        <p className={s.body} data-reveal-item>
          {t("mk.price.lede")}
        </p>
      </div>

      <div className={s.priceBoard} data-reveal>
        <div className={s.cycles}>
          {CREDIT_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`${s.cycle} ${tier.best ? s.cycleBest : ""}`}
              data-tilt
            >
              {tier.best && <span className={s.cycleFlag}>{t("mk.price.best")}</span>}

              <p className={s.cycleName}>{tier.name}</p>
              <p className={s.cycleFor}>{t(`mk.tier.${tier.id}.for` as never)}</p>

              <p className={s.cyclePrice}>
                <span className={s.cycleCur}>$</span>
                {tier.usd}
                <span className={s.cycleUnit}> {t("mk.plan.perMonth")}</span>
              </p>
              <p className={s.cycleAed}>
                {t("mk.tier.billedAed", { aed: String(tier.aed) })}
              </p>

              {/* What the money buys, in the units a teacher thinks in. */}
              <p className={s.cycleCredits}>
                <strong>{t("mk.tier.credits", { credits: String(tier.credits) })}</strong>
                <span>{t("mk.tier.lessons", { lessons: String(tier.lessons) })}</span>
              </p>

              <p className={s.cycleBilled}>
                {t("mk.tier.annual", {
                  usd: String(tier.annualUsd),
                  aed: String(tier.annualAed),
                })}
              </p>
              <span className={s.cycleSave}>
                {t("mk.tier.save", {
                  save: String(annualSavePct(tier)),
                  months: String(annualFreeMonths(tier)),
                })}
              </span>
            </div>
          ))}
        </div>

        <div className={s.included}>
          <p className={s.includedHead}>{t("mk.price.everyPlan")}</p>
          <ul className={s.includedList}>
            {INCLUDED.map((k) => (
              <li key={k}>
                <Check size={16} strokeWidth={2} aria-hidden="true" />
                <span>{t(`mk.price.${k}` as never)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={s.priceActions}>
          <Link href="/signup" className={s.btnPrimary}>
            {t("mk.cta.primary")}
          </Link>
          <p className={s.actionNote} style={{ marginTop: 10 }}>
            {t("mk.price.trial", { days: String(TRIAL_DAYS) })}
          </p>
        </div>
      </div>
    </section>
  );
}
