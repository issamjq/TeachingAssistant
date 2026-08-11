"use client";

import Link from "next/link";
import { useT } from "@/shared/i18n";
import s from "./Landing.module.css";

// Privacy and Terms. Real routes, deliberately not folded into the single
// scroll: they are reference documents, not marketing sections.
//
// The body is an honest placeholder. Publishing invented legal wording
// would be worse than publishing none.

export default function LegalSheet({ doc }: { doc: "privacy" | "terms" }) {
  const t = useT();

  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={s.navInner}>
          <Link href="/" className={s.lockup}>
            Murchid <i aria-hidden="true">مرشد</i>
          </Link>
          <nav className={s.navLinks}>
            <Link href="/" className={s.navLink}>
              {t("mk.legal.back")}
            </Link>
          </nav>
        </div>
      </header>

      <main className={`${s.shell} ${s.section}`}>
        <h1 className={s.sectionTitle}>
          {doc === "privacy" ? t("mk.foot.privacy") : t("mk.foot.terms")}
        </h1>
        <p className={s.body} style={{ marginTop: 20 }}>
          {t("mk.legal.placeholder")}
        </p>
        <p className={s.body} style={{ marginTop: 14 }}>
          {t("mk.legal.contact")}{" "}
          <a href="mailto:hello@murchid.app" style={{ color: "var(--accent)" }}>
            hello@murchid.app
          </a>
        </p>
      </main>
    </div>
  );
}
