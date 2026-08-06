"use client";

import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import editorial from "../styles/editorial.module.css";
import styles from "./Contents.module.css";

// Chapter II — Contents.
//
// The six things Murchid makes, set as an actual table of contents. The
// numbering earns its place here: this section IS a contents list, so the
// numerals encode real sequence rather than decorating a feature grid.
//
// Copy reuses the existing ch.lineup.* keys, so the Arabic translation that
// already ships keeps working untouched.

interface Entry {
  kind: string;
  name: TranslationKey;
  em: TranslationKey;
  desc: TranslationKey;
  /**
   * Whether the accent word comes first.
   *
   * The dictionary's em/name split is not positionally consistent: most read
   * accent-first ("Lesson" + "Plans"), but homework is "& Worksheets" +
   * "Homework", which only makes sense the other way round. The previous
   * landing rendered every pair accent-first and so displayed
   * "& Worksheets Homework". Making the order explicit per entry fixes that
   * without touching the shipped Arabic translations.
   */
  emFirst: boolean;
}

const ENTRIES: Entry[] = [
  { kind: "lesson", em: "ch.lineup.lesson.em", name: "ch.lineup.lesson.name", desc: "ch.lineup.lesson.desc", emFirst: true },
  { kind: "quiz", em: "ch.lineup.quiz.em", name: "ch.lineup.quiz.name", desc: "ch.lineup.quiz.desc", emFirst: true },
  { kind: "homework", em: "ch.lineup.homework.em", name: "ch.lineup.homework.name", desc: "ch.lineup.homework.desc", emFirst: false },
  { kind: "deck", em: "ch.lineup.deck.em", name: "ch.lineup.deck.name", desc: "ch.lineup.deck.desc", emFirst: true },
  { kind: "presentation", em: "ch.lineup.presentation.em", name: "ch.lineup.presentation.name", desc: "ch.lineup.presentation.desc", emFirst: true },
  { kind: "activity", em: "ch.lineup.activity.em", name: "ch.lineup.activity.name", desc: "ch.lineup.activity.desc", emFirst: true },
];

export default function Contents({ onEnter }: { onEnter: () => void }) {
  const t = useT();

  return (
    <section className={styles.contents} id="sec-features">
      <div className={editorial.page}>
        <div className={styles.head}>
          <div className={styles.headTop}>
            <span className={editorial.numeral} aria-hidden="true">
              II
            </span>
            <h2 className={editorial.chapterTitle}>
              {t("ch.lineup.h1.a")}{" "}
              <em className={editorial.em}>{t("ch.lineup.h1.em")}</em>{" "}
              {t("ch.lineup.h1.b")}
            </h2>
            <span className={`${editorial.eyebrow} ${styles.headFolio}`}>
              {ENTRIES.length} tools
            </span>
          </div>
          <p className={styles.headLede}>{t("ch.lineup.sub")}</p>
        </div>

        <ul className={styles.list}>
          {ENTRIES.map((entry, i) => (
            <li key={entry.kind}>
              <button type="button" className={styles.row} onClick={onEnter}>
                <span className={styles.num} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className={styles.titleWrap}>
                  <span className={styles.title}>
                    {entry.emFirst ? (
                      <>
                        <em>{t(entry.em)}</em> {t(entry.name)}
                      </>
                    ) : (
                      <>
                        {t(entry.name)} <em>{t(entry.em)}</em>
                      </>
                    )}
                  </span>
                  <span className={styles.leader} aria-hidden="true" />
                  <span className={styles.desc}>{t(entry.desc)}</span>
                </span>

                <span className={styles.folio}>
                  {t("ch.hero.cta").replace(/[→←]\s*$/, "").trim()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
