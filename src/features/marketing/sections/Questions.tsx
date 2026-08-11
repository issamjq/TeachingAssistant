"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/shadcn/accordion";
import { useT } from "@/shared/i18n";
import s from "../Landing.module.css";

// Questions, on shadcn's Accordion.
//
// The quote slot that used to sit here is gone rather than filled: real
// teacher quotes exist, their wording is not in this repository, and the
// previous page invented eight of them. When the owner supplies real
// wording it belongs here, attributed.

const KEYS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default function Questions() {
  const t = useT();

  return (
    <section className={`${s.shell} ${s.section}`} id="questions">
      <div className={s.sectionHead} data-reveal-stagger>
        <h2 className={s.sectionTitle} data-reveal-item>{t("mk.faq.title")}</h2>
        <p className={s.body} data-reveal-item>{t("mk.faq.lede")}</p>
      </div>

      <div className={s.faqWrap}>
        {/* Base UI accordion, not Radix: single-open is multiple={false}. */}
        <Accordion multiple={false} className="w-full">
          {KEYS.map((k) => (
            <AccordionItem key={k} value={k}>
              <AccordionTrigger className="text-left text-[17px] font-semibold">
                {t(`mk.faq.${k}.q` as never)}
              </AccordionTrigger>
              <AccordionContent className="text-[15.5px] leading-relaxed">
                {t(`mk.faq.${k}.a` as never)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
