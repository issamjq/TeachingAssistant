"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LangToggle, useT } from "@/shared/i18n";
import Hero from "./sections/Hero";
import Steps from "./sections/Steps";
import Outputs from "./sections/Outputs";
import Bilingual from "./sections/Bilingual";
import TermTimeline from "./sections/TermTimeline";
import Pricing from "./sections/Pricing";
import Questions from "./sections/Questions";
import { useReveal } from "./useReveal";
import s from "./Landing.module.css";

// The marketing site: one scroll.
//
// Pricing and questions are anchors here rather than separate pages, at
// the owner's request. /pricing and /faq still exist as real routes that
// land on the matching anchor, so a link sent to a head of department
// still works and nothing that was indexed 404s. /signup, /signin and
// /legal/* stay separate routes: they are not marketing sections.
//
// Section order is one layout family each: split hero, alternating rows,
// bento, tinted band, feature-plus-list, accordion, centred close. No
// family repeats.

const NAV = [
  { href: "#how", key: "mk.nav.how" as const, secondary: false },
  { href: "#what", key: "mk.nav.what" as const, secondary: true },
  { href: "#pricing", key: "mk.nav.pricing" as const, secondary: false },
  { href: "#questions", key: "mk.nav.faq" as const, secondary: true },
];

export default function LandingPage() {
  const t = useT();
  // One reveal scope for the page: every [data-reveal] inside it rises
  // once as it enters. GSAP only, no Motion in this tree.
  const scope = useReveal<HTMLDivElement>();
  const [scrolled, setScrolled] = useState(false);

  // IntersectionObserver on a top sentinel rather than a scroll listener:
  // a scroll handler would fire on every frame for a hairline border.
  useEffect(() => {
    const el = document.getElementById("top");
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { rootMargin: "-68px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={s.page} ref={scope}>
      <header className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}>
        <div className={s.navInner}>
          <Link href="/" className={s.lockup}>
            Murchid <i aria-hidden="true">مرشد</i>
          </Link>

          <nav className={s.navLinks} aria-label={t("mk.nav.aria")}>
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={s.navLink}
                data-secondary={item.secondary || undefined}
              >
                {t(item.key)}
              </a>
            ))}
            <LangToggle />
            <Link href="/signin" className={s.navLink}>
              {t("mk.nav.signin")}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Hero />
        <Steps />
        <Outputs />
        <TermTimeline />
        <Bilingual />
        <Pricing />
        <Questions />

        <section className={s.closing}>
          <div className={s.shell}>
            <h2 className={s.display} data-reveal>{t("mk.close.title")}</h2>
            <div className={s.closingActions}>
              <Link href="/signup" className={s.btnPrimary}>
                {t("mk.cta.primary")}
              </Link>
              <a href="#how" className={s.btnGhost}>
                {t("mk.cta.secondary")}
              </a>
            </div>
            <p className={s.closingNote}>{t("mk.cta.note")}</p>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.shell}>
          <div className={s.footerInner}>
            <span>{t("mk.foot.rights")}</span>
            <div className={s.footerLinks}>
              <Link href="/legal/privacy">{t("mk.foot.privacy")}</Link>
              <Link href="/legal/terms">{t("mk.foot.terms")}</Link>
              <a href="mailto:hello@murchid.app">hello@murchid.app</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
