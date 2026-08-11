"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { useT } from "@/shared/i18n";
import s from "../Landing.module.css";

// Pricing: one product, three cadences — so the layout is ONE board with
// three cycle columns, not three competing cards repeating the same
// feature list. The quarterly column is lifted and ringed because
// src/lib/plans.js marks it `best` (the flag the subscription maths
// ships), not because marketing invented a badge. The five inclusions
// appear once, under all three, where they belong: they are identical on
// every plan.
//
// Adaptive by structure: the columns are an auto-fitting grid that drops
// to a single stack under 720px with nothing clipped, nothing fixed
// height, and the featured lift disabled where columns stack.

const INCLUDED = ["i1", "i2", "i3", "i4", "i5"] as const;

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
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`${s.cycle} ${p.best ? s.cycleBest : ""}`}
              data-tilt
            >
              {p.best && <span className={s.cycleFlag}>{t("mk.price.best")}</span>}
              <p className={s.cycleName}>{t(`mk.plan.${p.id}` as never)}</p>
              <p className={s.cyclePrice}>
                {p.perMonth}
                <span className={s.cycleUnit}> {t("mk.plan.perMonth")}</span>
              </p>
              <p className={s.cycleBilled}>
                {p.savePct > 0
                  ? t("mk.plan.billed", { total: p.total, save: String(p.savePct) })
                  : t("mk.plan.billedMonthly", { total: p.total })}
              </p>
              {p.savePct > 0 && (
                <span className={s.cycleSave}>
                  {t("mk.price.save", { save: String(p.savePct) })}
                </span>
              )}
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
