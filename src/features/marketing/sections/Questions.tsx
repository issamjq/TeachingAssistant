"use client";

import { useRef } from "react";
import { useT } from "@/shared/i18n";
import s from "../Landing.module.css";

// Questions, in preview1's editorial structure (kept at the owner's
// request): a sticky heading column holds one side while the questions
// scroll past on the other, the way an editorial page sets a Q&A.
//
// Built on <details>/<summary>, exactly as preview1 had it: keyboard
// operable, announced correctly, works before hydration and with
// JavaScript off. The only script keeps one item open at a time, and if
// it never runs the section still works. The numbers are way-finding for
// a six-item list the reader scans out of order, and the plus that
// becomes a minus is two drawn bars, not a glyph.

const ITEMS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default function Questions({
  billingOn = true,
  freeGrant = 800,
}: {
  billingOn?: boolean;
  freeGrant?: number;
}) {
  const t = useT();
  const list = useRef<HTMLDivElement>(null);

  const closeSiblings = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const el = e.currentTarget;
    if (!el.open) return;
    for (const other of list.current?.querySelectorAll("details") ?? []) {
      if (other !== el) other.open = false;
    }
  };

  return (
    <section className={`${s.shell} ${s.section} ${s.faqGrid}`} id="questions">
      <header className={s.faqHead}>
        <p className={s.eyebrow}>{t("mk.faq.eyebrow")}</p>
        <h2 className={s.faqTitle}>
          {t("mk.faq.title.a")} <em>{t("mk.faq.title.em")}</em>
        </h2>
        <p className={s.faqSub}>{t("mk.faq.sub")}</p>
        <a className={s.faqContact} href="mailto:hello@murchid.app">
          {t("mk.faq.contact")}
        </a>
      </header>

      <div className={s.faqList} ref={list}>
        {ITEMS.map((k, i) => (
          <details key={k} className={s.faqItem} onToggle={closeSiblings}>
            <summary className={s.faqQ}>
              <span className={s.faqNum}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.faqQText}>
                {!billingOn && k === "q5"
                  ? t("mk.free.q5.q")
                  : t(`mk.faq.${k}.q` as never)}
              </span>
              <span className={s.faqMark} aria-hidden="true" />
            </summary>
            <div className={s.faqA}>
              {/* q5 asks what happens after the free week. During a free
                  period there is no week and no "after", so that one
                  question — and only that one — is answered differently. */}
              <p>
                {!billingOn && k === "q5"
                  ? t("mk.free.q5.a", { credits: String(freeGrant) })
                  : t(`mk.faq.${k}.a` as never)}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
