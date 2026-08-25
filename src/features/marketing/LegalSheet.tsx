"use client";

import Link from "next/link";
import MurchidLogo from "@/components/MurchidLogo";
import { useT } from "@/shared/i18n";
import { PRIVACY, PRIVACY_UPDATED, type Block } from "./legal/privacy";
import s from "./Landing.module.css";

// Privacy and Terms. Real routes, deliberately not folded into the single
// scroll: they are reference documents, not marketing sections.
//
// The wording lives in ./legal/*.ts as data rather than JSX, so it can be
// read, reviewed and dated by someone who does not write React — and so
// this file stays about layout.
//
// Terms is still the honest placeholder. Publishing invented legal
// wording would be worse than publishing none, and a terms of service
// is not something to improvise: it has to be written against how the
// product actually behaves, then read by a lawyer.

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

        {doc === "privacy" ? (
          <>
            <p className={s.legalUpdated}>Last updated {PRIVACY_UPDATED}</p>
            <p className={s.legalLede}>
              This policy describes what Murchid collects when you plan and teach, who
              processes it, how long we keep it, and the choices you have. It is written
              for two readers: the teacher who signs in, and the school responsible for
              the pupils whose records she keeps here.
            </p>

            {PRIVACY.map((sec) => (
              <section key={sec.n} className={s.legalSection}>
                <h2 className={s.legalH2}>
                  <span aria-hidden="true">{sec.n}.</span> {sec.title}
                </h2>
                <Blocks body={sec.body} />
              </section>
            ))}
          </>
        ) : (
          <>
            <p className={s.body} style={{ marginTop: 20 }}>
              {t("mk.legal.placeholder")}
            </p>
            <p className={s.body} style={{ marginTop: 14 }}>
              {t("mk.legal.contact")}{" "}
              <a href="mailto:mk@mjqinvestment.com" style={{ color: "var(--accent)" }}>
                mk@mjqinvestment.com
              </a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
