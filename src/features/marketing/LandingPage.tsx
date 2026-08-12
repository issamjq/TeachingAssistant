"use client";

import Link from "next/link";
import MurchidLogo from "@/components/MurchidLogo";
import { useEffect, useState } from "react";
import { LangToggle, useT } from "@/shared/i18n";
import Hero from "./sections/Hero";
import Steps from "./sections/Steps";
import Outputs from "./sections/Outputs";
import Bilingual from "./sections/Bilingual";
import TermTimeline from "./sections/TermTimeline";
import Pricing from "./sections/Pricing";
import Questions from "./sections/Questions";
import ImageCourier from "./ImageCourier";
import { useReveal } from "./useReveal";
import { useTilt } from "./useTilt";
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
  // The same scope hosts the pointer-tilt field for every [data-tilt] card.
  useTilt(scope);
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
          {/* The preview1 wordmark, everywhere: currentColor glyphs take
              the surface's ink, the italic r takes the accent, and both
              follow the theme. */}
          <Link href="/" className={s.logoLink} aria-label="Murchid">
            <MurchidLogo
              className="h-9 w-auto"
              style={{ color: "var(--ink)", "--murchid-logo-accent": "var(--accent)" } as React.CSSProperties}
            />
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

        {/* "One more thing" — preview1's closing structure, kept at the
            owner's request: the kicker framed by two short rules, the
            colossal serif question with its italic beat, an italic serif
            sub, then the actions. Unpinned (the pin was preview1's; being
            held here was already ruled out) on the page's second ink
            ground. */}
        <section className={s.closing} data-closing>
          <div className={s.shell}>
            <p className={s.finalKicker} data-reveal>
              {t("mk.final.kicker")}
            </p>
            <h2 className={s.finalQ} data-reveal>
              {t("mk.final.q.a")} <em>{t("mk.final.q.em")}</em> {t("mk.final.q.b")}
            </h2>
            <p className={s.finalSub} data-reveal>
              {t("mk.final.sub")}
            </p>
            <div className={s.closingActions} data-reveal>
              <Link href="/signup" className={s.btnPrimary}>
                {t("mk.cta.primary")}
              </Link>
              <a href="#pricing" className={s.btnGhost}>
                {t("mk.cta.secondary")}
              </a>
            </div>
            <p className={s.closingNote}>{t("mk.cta.note")}</p>
          </div>
        </section>
        <ImageCourier />
      </main>

      {/* Footer in preview1's four-column structure: the brand column
          with a serif tagline, two link columns, and a "from the team"
          column, over a hairline bottom bar. */}
      <footer className={s.footer}>
        <div className={s.shell}>
          <div className={s.footGrid}>
            <div className={s.footBrand}>
              <MurchidLogo
                className="h-12 w-auto"
                style={{ color: "var(--band-fg)", "--murchid-logo-accent": "var(--accent-on-ink)" } as React.CSSProperties}
              />
              <p className={s.footTagline}>{t("mk.foot.tagline")}</p>
              <p className={s.footBuilt}>{t("mk.foot.builtIn")}</p>
            </div>

            <div>
              <p className={s.footHead}>{t("mk.foot.product")}</p>
              <ul className={s.footList}>
                <li><a href="#how">{t("mk.nav.how")}</a></li>
                <li><a href="#what">{t("mk.nav.what")}</a></li>
                <li><a href="#pricing">{t("mk.nav.pricing")}</a></li>
                <li><a href="#questions">{t("mk.nav.faq")}</a></li>
              </ul>
            </div>

            <div>
              <p className={s.footHead}>{t("mk.foot.legal")}</p>
              <ul className={s.footList}>
                <li><Link href="/legal/privacy">{t("mk.foot.privacy")}</Link></li>
                <li><Link href="/legal/terms">{t("mk.foot.terms")}</Link></li>
                <li><a href="mailto:hello@murchid.app">hello@murchid.app</a></li>
              </ul>
            </div>

            <div>
              <p className={s.footHead}>{t("mk.foot.fromTeam")}</p>
              <p className={s.footTeam}>{t("mk.foot.teamBody")}</p>
              <Link href="/signup" className={s.footCta}>
                {t("mk.foot.start")}
              </Link>
            </div>
          </div>

          <div className={s.footerInner}>
            <span>{t("mk.foot.copyright")}</span>
            <div className={s.footerLinks}>
              <Link href="/legal/terms">{t("mk.foot.terms")}</Link>
              <Link href="/legal/privacy">{t("mk.foot.privacy")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
