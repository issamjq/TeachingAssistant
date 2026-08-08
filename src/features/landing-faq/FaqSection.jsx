"use client";

// =====================================================================
// Landing — FAQ
//
// Sits between the plans and the final CTA, which is where the questions
// actually arrive: somebody has just read a price and wants to know what
// happens to their students' data before they click.
//
// Built on <details>/<summary> rather than a JS accordion. It is
// keyboard-operable, announced correctly by screen readers, works before
// hydration and survives with JavaScript off — none of which a div with
// an onClick gets for free. The only script here is the one that keeps a
// single item open at a time, and if it never runs the section still
// works; you can just open several at once.
// =====================================================================
import React, { useRef } from "react";
import { useT, useI18n } from "../../lib/i18n";
import s from "./FaqSection.module.css";

/** Question keys, in order. Answers share the index. */
const ITEMS = [1, 2, 3, 4, 5, 6, 7];

export default function FaqSection() {
  const t = useT();
  const { isRTL } = useI18n();
  const listRef = useRef(null);

  // One open at a time. Progressive enhancement: <details> is already
  // functional, this only tidies the behaviour.
  const closeSiblings = (e) => {
    const el = e.currentTarget;
    if (!el.open) return;
    for (const other of listRef.current?.querySelectorAll("details") ?? []) {
      if (other !== el) other.open = false;
    }
  };

  // `faq-stage` is a global hook, not a style: the nav watches for it to
  // switch to ink over this cream ground (see Landing.jsx). A CSS-module
  // class is hashed at build time and cannot be named in that selector.
  return (
    <section className={`${s.stage} faq-stage`} id="faq" dir={isRTL ? "rtl" : "ltr"}>
      <div className={s.shell}>
        <header className={s.head}>
          <span className={s.eyebrow}>{t("faq.eyebrow")}</span>
          <h2 className={s.title}>
            {t("faq.title.a")} <em>{t("faq.title.em")}</em>
          </h2>
          <p className={s.sub}>{t("faq.sub")}</p>
          <a className={s.contact} href="mailto:hello@murchid.com">
            {t("faq.contact")}
          </a>
        </header>

        <div className={s.list} ref={listRef}>
          {ITEMS.map((n, i) => (
            <details key={n} className={s.item} onToggle={closeSiblings}>
              <summary className={s.q}>
                <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                <span className={s.qText}>{t(`faq.q${n}`)}</span>
                {/* aria-hidden: the open/closed state is already carried by
                    <details> itself, so announcing the glyph too would say
                    it twice. */}
                <span className={s.mark} aria-hidden="true" />
              </summary>
              <div className={s.a}>
                <p>{t(`faq.a${n}`)}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
