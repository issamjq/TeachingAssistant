"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { useT } from "@/shared/i18n";
import s from "../Landing.module.css";

// Pricing: one featured plan plus a comparison list.
//
// NOT three equal cards. Every plan here is the same product at a
// different billing cadence, so three identical cards would ask the
// visitor to compare things that do not differ. The monthly plan is
// shown whole; the other two are the same thing, cheaper, listed as
// rows.
//
// Prices come from src/lib/plans.js, the table the subscription maths
// already uses, so this page cannot drift from what a teacher is charged.

const INCLUDED = ["i1", "i2", "i3", "i4", "i5"] as const;

export default function Pricing() {
  const t = useT();
  const monthly = PLANS[0];
  const rest = PLANS.slice(1);

  return (
    <section className={`${s.shell} ${s.section}`} id="pricing">
      <div className={s.sectionHead} data-reveal-stagger>
        <h2 className={s.sectionTitle} data-reveal-item>{t("mk.price.title")}</h2>
        <p className={s.body} data-reveal-item>{t("mk.price.lede")}</p>
      </div>

      <div className={s.planWrap}>
        <div className={s.planFeature} data-reveal data-reveal-stagger>
          <p className={s.planName} data-reveal-item>{t("mk.plan.monthly")}</p>
          <p className={s.planPrice} data-reveal-item>
            {monthly.perMonth} <span className={s.planUnit}>{t("mk.plan.perMonth")}</span>
          </p>

          <ul className={s.planList}>
            {INCLUDED.map((k) => (
              <li key={k} data-reveal-item>
                <Check size={17} strokeWidth={2} style={{ marginTop: 2, flex: "none" }} aria-hidden="true" />
                <span>{t(`mk.price.${k}` as never)}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 28 }} data-reveal-item>
            <Link href="/signup" className={s.btnPrimary}>
              {t("mk.cta.primary")}
            </Link>
          </div>
          <p className={s.closingNote}>
            {t("mk.price.trial", { days: String(TRIAL_DAYS) })}
          </p>
        </div>

        <div className={s.planAlt} data-reveal>
          <p className={s.small}>{t("mk.price.altHead")}</p>
          {rest.map((p) => (
            <div key={p.id} className={s.planAltRow}>
              <span style={{ fontWeight: 600 }}>{t(`mk.plan.${p.id}` as never)}</span>
              <span style={{ textAlign: "end" }}>
                <strong style={{ fontSize: "var(--t-5)", fontWeight: 600 }}>{p.perMonth}</strong>{" "}
                <span className={s.small} style={{ display: "inline" }}>
                  {t("mk.plan.perMonth")}
                </span>
                <br />
                <span className={s.small}>
                  {t("mk.price.saves", { save: String(p.savePct), total: p.total })}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
