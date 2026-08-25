"use client";

import Link from "next/link";
import MurchidLogo from "@/components/MurchidLogo";
import { useT } from "@/shared/i18n";
import { PRIVACY, PRIVACY_UPDATED, type Block, type Section } from "./legal/privacy";
import { TERMS, TERMS_UPDATED } from "./legal/terms";
import s from "./Landing.module.css";

// Privacy and Terms. Real routes, deliberately not folded into the single
// scroll: they are reference documents, not marketing sections.
//
// The wording lives in ./legal/*.ts as data rather than JSX, so it can be
// read, reviewed and dated by someone who does not write React — and so
// this file stays about layout.
//
// Both documents share one renderer, so they cannot drift apart in
// typography. Neither is a substitute for a lawyer reading them; what
// they are is accurate — every number in the terms, from credit costs to
// the three-day grace on a failed renewal, was read out of the running
// system rather than assumed.

function Blocks({ body }: { body: Block[] }) {
  return (
    <>
      {body.map((b, i) => {
        if ("p" in b) {
          return (
            <p key={i} className={s.legalP}>
              {b.p}
            </p>
          );
        }
        if ("list" in b) {
          return (
            <ul key={i} className={s.legalList}>
              {b.list.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          );
        }
        /* A note is the thing a reader would otherwise miss — the pupil
           data, the IP address we do not hash. Set apart so it cannot be
           skimmed past. */
        return (
          <p key={i} className={s.legalNote}>
            {b.note}
          </p>
        );
      })}
    </>
  );
}

export default function LegalSheet({ doc }: { doc: "privacy" | "terms" }) {
  const t = useT();

  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={s.navInner}>
          <Link href="/" className={s.logoLink} aria-label="Murchid">
            <MurchidLogo
              className="h-9 w-auto"
              style={{ color: "var(--ink)", "--murchid-logo-accent": "var(--accent)" } as React.CSSProperties}
            />
          </Link>
          <nav className={s.navLinks}>
            <Link href="/" className={s.navLink}>
              {t("mk.legal.back")}
            </Link>
          </nav>
        </div>
      </header>

      <main className={`${s.shell} ${s.section} ${s.legal}`}>
        <h1 className={s.sectionTitle}>
          {doc === "privacy" ? t("mk.foot.privacy") : t("mk.foot.terms")}
        </h1>

        <p className={s.legalUpdated}>
          Last updated {doc === "privacy" ? PRIVACY_UPDATED : TERMS_UPDATED}
        </p>
        <p className={s.legalLede}>
          {doc === "privacy"
            ? "This policy describes what Murchid collects when you plan and teach, who processes it, how long we keep it, and the choices you have. It is written for two readers: the teacher who signs in, and the school responsible for the pupils whose records she keeps here."
            : "These Terms explain the rules for using Murchid. Please read them carefully — they include important points about drafts needing your review before a class sees them, about whose pupil data this is, and about credits and payment."}
        </p>

        {(doc === "privacy" ? PRIVACY : TERMS).map((sec: Section) => (
          <section key={sec.n} className={s.legalSection}>
            <h2 className={s.legalH2}>
              <span aria-hidden="true">{sec.n}.</span> {sec.title}
            </h2>
            <Blocks body={sec.body} />
          </section>
        ))}

        {/* Each points at the other: they are one agreement, and someone
            who lands on one usually needs both. */}
        <p className={s.legalCross}>
          {doc === "privacy" ? (
            <>
              The rules for using Murchid are in the{" "}
              <Link href="/legal/terms">Terms of Service</Link>.
            </>
          ) : (
            <>
              How we handle personal data is in the{" "}
              <Link href="/legal/privacy">Privacy Policy</Link>, which forms part of
              these Terms.
            </>
          )}
        </p>
      </main>
    </div>
  );
}
