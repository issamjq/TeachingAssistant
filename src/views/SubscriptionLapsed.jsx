import React, { useState } from "react";
import { PLANS, CURRENCY, TRIAL_PLAN_ID } from "../lib/plans";
import { useT } from "../lib/i18n";
import { api } from "./_shared";
import { Button } from "../components/ui/button";
import MurchidLogo from "../components/MurchidLogo";

// The lapsed gate (F60).
//
// What this replaces: when a subscription window closed, App.jsx called
// clearAccount() + clearRoute() and the teacher landed on the marketing page
// with the nav reading "SIGN IN" — while Firebase still held them and their
// session id was still valid. They were told they were logged out, which was
// untrue, and POST /api/auth/renew had no caller anywhere in src/, so the one
// endpoint that could bring them back was unreachable from the product. Every
// trial reaches this point on day eight; it is the conversion moment.
//
// So this screen is deliberately NOT a sign-out. The teacher stays
// authenticated, their work is untouched, and the only thing missing is a
// paid window. It renders over the studio rather than replacing the route,
// so nothing is cleared and a successful renew drops them back exactly where
// they were.
//
// Pre-Stripe: choosing a plan calls /api/auth/renew directly, which is the
// same thing the Checkout webhook will call once payment lands (F5). The
// wording below says "no card required yet" rather than implying a purchase,
// so it stays honest until then.

export default function SubscriptionLapsed({ detail, onRenewed, onSignOut, email }) {
  const t = useT();
  const [picking, setPicking] = useState(null);
  const [error, setError] = useState("");

  const wasTrial = !detail?.plan || detail.plan === TRIAL_PLAN_ID;
  const endedAt = detail?.endedAt ? new Date(detail.endedAt) : null;
  const endedLabel =
    endedAt && !Number.isNaN(endedAt.getTime())
      ? endedAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
      : null;

  const choose = async (plan) => {
    setPicking(plan);
    setError("");
    try {
      const account = await api("/api/auth/renew", { method: "POST", body: { plan } });
      // The server invalidated its own cached row; the client's 30s profile
      // cache has to go too or the studio reopens on stale plan data.
      const { invalidateProfile } = await import("./_shared");
      invalidateProfile();
      onRenewed?.(account);
    } catch (err) {
      setError(err?.message || t("lapsed.error"));
      setPicking(null);
    }
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-paper text-ink font-sans">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-6 py-12">
        <MurchidLogo className="mb-10 h-7 w-auto self-start" />

        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {t("lapsed.eyebrow")}
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,2.75rem)] leading-[1.1] text-ink">
          {wasTrial ? t("lapsed.title.trial") : t("lapsed.title.paid")}{" "}
          <em className="not-italic font-serif italic text-accent">
            {wasTrial ? t("lapsed.titleEm.trial") : t("lapsed.titleEm.paid")}
          </em>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          {t("lapsed.lead")}
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {endedLabel ? t("lapsed.endedOn", { date: endedLabel }) : t("lapsed.safe")}
        </p>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const featured = !!p.best;
            const billed =
              p.cycle === "yr"
                ? t("lp.plan.billed.yr", { total: p.total, cur: CURRENCY })
                : p.cycle === "q"
                  ? t("lp.plan.billed.q", { total: p.total, cur: CURRENCY })
                  : t("lp.plan.billed.mo");
            return (
              <article
                key={p.id}
                className={
                  "relative flex flex-col rounded-2xl border p-5 " +
                  (featured
                    ? "border-accent/40 bg-paper-cool shadow-[var(--shadow-2)]"
                    : "border-line bg-paper-cool/60")
                }
              >
                {featured && (
                  <span className="absolute -top-2.5 start-5 rounded-full bg-accent px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-cool">
                    {t("lp.plan.popular")}
                  </span>
                )}
                <div className="font-serif text-lg text-ink">{t(`lp.plan.name.${p.id}`)}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-serif text-3xl leading-none text-ink">{p.perMonth}</span>
                  <span className="text-xs text-muted">
                    {CURRENCY} {t("lp.plan.perMo")}
                  </span>
                </div>
                <div className="mt-1.5 text-[13px] text-muted">{billed}</div>
                {p.savePct > 0 && (
                  <div className="mt-0.5 text-[13px] text-sage">
                    {t("lp.plan.save", { n: p.savePct })}
                  </div>
                )}
                <Button
                  variant={featured ? "primary" : "secondary"}
                  fullWidth
                  className="mt-5"
                  disabled={!!picking}
                  onClick={() => choose(p.id)}
                >
                  {picking === p.id ? t("lp.plan.choosing") : t("lp.plan.choose")}
                </Button>
              </article>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-5 text-sm text-accent">
            {error}
          </p>
        )}

        <p className="mt-6 text-[13px] text-muted">{t("lapsed.noCard")}</p>

        <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-5 text-[13px] text-muted">
          <span>{email ? t("lapsed.signedInAs", { email }) : t("lapsed.stillSignedIn")}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="murchid-focus rounded-full underline underline-offset-2 hover:text-ink"
          >
            {t("lapsed.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
