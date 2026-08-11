"use client";

import { useT } from "@/shared/i18n";
import ThemedShot from "../ThemedShot";
import s from "../Landing.module.css";

// The bilingual band.
//
// Shown, not claimed. The previous page asserted "English and Arabic" in a
// trust line while its only piece of product evidence stayed in English
// even after the visitor switched language. Here the Arabic is set at
// display size in the page's own type, beside a real screen.

export default function Bilingual() {
  const t = useT();
  return (
    <section className={s.bilingual} id="bilingual">
      <div className={`${s.shell} ${s.section} ${s.bilingualInner}`}>
        <div
        >
          <h2 className={s.sectionTitle}>{t("mk.bi.title")}</h2>
          <p className={s.body} style={{ marginTop: 16 }}>
            {t("mk.bi.lede")}
          </p>
          <p className={s.arabicSample} lang="ar" dir="rtl">
            {t("mk.bi.sample")}
          </p>
        </div>

        <div
          className={s.frame}
          data-reveal
          data-reveal-scale
        >
          <ThemedShot
            src="/marketing/database.jpg"
            alt={t("mk.shot.students")}
            width={1800}
            height={1125}
            sizes="(max-width: 860px) 100vw, 48vw"
            className={s.shotImg}
          />
        </div>
      </div>
    </section>
  );
}
