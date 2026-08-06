"use client";

import { useT, useI18n } from "@/shared/i18n";
import editorial from "../styles/editorial.module.css";
import styles from "./Opening.module.css";

// Chapter I — the opening spread.
//
// Set as a magazine cover rather than a hero banner: masthead rule, a
// standfirst, an asymmetric two-line title, the Arabic reading of the same
// idea on its own rule, and a CTA that sits on the baseline instead of
// floating mid-composition.
//
// Copy comes from the existing i18n keys so the Arabic translation that
// already exists keeps working — the redesign changes the setting, not the
// words.

export default function Opening({ onEnter }: { onEnter: () => void }) {
  const t = useT();
  const { isRTL } = useI18n();

  return (
    <header className={styles.opening}>
      <div className={editorial.page}>
        {/* ── Masthead ─────────────────────────────────────────── */}
        <div className={styles.masthead}>
          <span className={editorial.eyebrow}>Murchid · مُرشد</span>
          <span className={`${editorial.eyebrow} ${styles.mastheadCentre}`}>
            {t("lp.hero.eyebrow")}
          </span>
          <span className={editorial.eyebrow}>No. 01</span>
        </div>

        {/* ── Title block ──────────────────────────────────────── */}
        <div className={styles.titleBlock}>
          <p
            className={`${editorial.eyebrow} ${styles.standfirst} ${editorial.rise}`}
            style={{ "--i": 0 } as React.CSSProperties}
          >
            {t("ch.hero.lede")}
          </p>

          <h1
            className={`${editorial.display} ${editorial.rise}`}
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <span className={styles.line1}>{t("lp.hero.h1a")}</span>
            <span className={styles.line2}>
              <em className={editorial.em}>{t("lp.hero.brand")}</em>{" "}
              {t("lp.hero.h1b")}
            </span>
          </h1>

          {/* The Arabic is a second voice, not an ornament — same optical
              weight, its own rule, glossed in the margin. */}
          <div
            className={`${styles.arabicBlock} ${editorial.rise}`}
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <span className={styles.arabicWord} lang="ar" dir="rtl">
              مُرشد
            </span>
            <span className={styles.gloss}>
              {isRTL ? "الاسم · مُرشد" : "noun · the one who guides"}
            </span>
          </div>
        </div>

        {/* ── Foot ─────────────────────────────────────────────── */}
        <div className={styles.openingFoot}>
          <button type="button" className={styles.cta} onClick={onEnter}>
            {/* The translated string carries its own arrow glyph (→ / ←).
                Strip it — the SVG below is the arrow, and it animates. */}
            {t("ch.hero.cta").replace(/[→←]\s*$/, "").trim()}
            <svg
              className={styles.ctaArrow}
              width="22"
              height="10"
              viewBox="0 0 22 10"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 5h20M16 1l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
          </button>

          <span className={`${editorial.eyebrow} ${styles.scrollCue}`}>
            {t("ch.hero.scroll")}
            <span className={styles.scrollCueRule} aria-hidden="true" />
          </span>
        </div>
      </div>
    </header>
  );
}
