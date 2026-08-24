"use client";

// =====================================================================
// Billing — the plan, the money, the receipts
//
// Reached from the account menu. Answers the three questions a teacher
// has about money, in the order she has them:
//
//   what am I on      the plan, what it costs, when it renews
//   what have I paid  the total, and every receipt behind it
//   what do I do now  upgrade, top up, or manage the card at Stripe
//
// Deliberately shows CREDITS and DIRHAMS and no tokens: what a lesson
// costs us upstream is on the super admin's side of the glass (see
// db/tune.sql §68). This page is her account, not our margin.
// =====================================================================
import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Coins, ArrowRight, ExternalLink, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";
import { navigate } from "@/lib/route";

/** Minor units are how Stripe counts: 4500 fils → "AED 45.00". */
const money = (minor, currency = "aed") =>
  `${String(currency).toUpperCase()} ${(Number(minor || 0) / 100).toFixed(2)}`;

const day = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

const KIND = { subscription: "Plan", topup: "Top-up" };

const STATUS = {
  paid: { label: "Paid", cls: "text-sage" },
  pending: { label: "Not finished", cls: "text-muted" },
  failed: { label: "Failed", cls: "text-clay" },
  refunded: { label: "Refunded", cls: "text-muted" },
  canceled: { label: "Cancelled", cls: "text-muted" },
};

export default function Billing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api("/api/auth/billing"),
      api("/api/billing/config").catch(() => ({ enabled: false })),
    ])
      .then(([b, cfg]) => { setData(b); setEnabled(Boolean(cfg?.enabled)); setError(null); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Coming back from Stripe.
   *
   * The success URL proves nothing — it is a string anyone can type — so
   * this only re-reads the database. If the webhook has landed the new
   * plan is already there; if it has not, the page says so rather than
   * congratulating her on a payment that has not been confirmed.
   */
  const justPaid =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("checkout") === "done";

  useEffect(() => {
    if (!justPaid) return;
    const t = setTimeout(load, 2500);
    return () => clearTimeout(t);
  }, [justPaid, load]);

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await api("/api/billing/portal", { method: "POST" });
      if (url) window.location.href = url;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!data) return <BrandLoader />;

  const { plan, credits, spend, receipts } = data;
  const onTrial = plan.tier === "trial";
  const lapsed = plan.live === false;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Your account
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Billing <em className="italic font-light text-accent">and plan</em>
        </h2>
      </div>

      {justPaid && (
        <div className="border border-sage/40 rounded-xl p-4 bg-paper flex items-start gap-3">
          <Check size={15} className="text-sage mt-0.5 flex-shrink-0" />
          <p className="text-sm text-ink">
            <strong>Thank you.</strong> Your payment is with the bank. The plan below updates
            the moment it clears — usually seconds, occasionally a minute.
          </p>
        </div>
      )}

      {lapsed && (
        <div className="border border-clay/40 rounded-xl p-4 bg-paper flex flex-wrap items-center gap-3">
          <AlertCircle size={15} className="text-clay flex-shrink-0" />
          <p className="text-sm text-ink flex-1 min-w-[220px]">
            <strong>Your plan has ended.</strong> Everything you have made is still here.
            Pick a plan to start generating again.
          </p>
          <Button onClick={() => navigate(["plans"])}>See plans</Button>
        </div>
      )}

      {/* ── what you are on ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-line rounded-2xl p-5 bg-paper md:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
            <CreditCard size={11} /> Current plan
          </p>
          <p className="font-serif text-3xl text-ink">{plan.label}</p>

          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4">
            {plan.price_aed != null && Number(plan.price_aed) > 0 && (
              <Fact label="Price">
                AED {Number(plan.price_aed).toFixed(0)}
                <span className="text-muted"> / {plan.billing_period === "annual" ? "year" : "month"}</span>
              </Fact>
            )}
            <Fact label={plan.cancel_at_period_end ? "Ends" : onTrial ? "Trial ends" : "Renews"}>
              {day(plan.renews_at) || "—"}
            </Fact>
            <Fact label="Status">
              <span className={lapsed ? "text-clay" : "text-sage"}>
                {lapsed ? "Ended" : plan.cancel_at_period_end ? "Cancelling" : "Active"}
              </span>
            </Fact>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <Button onClick={() => navigate(["plans"])}>
              {onTrial || lapsed ? "Choose a plan" : "Change plan"}
              <ArrowRight size={14} className="ms-1.5" />
            </Button>
            {/* Only offered once there is something at Stripe to manage. */}
            {enabled && !onTrial && (
              <Button variant="secondary" onClick={openPortal} disabled={busy}>
                {busy ? "Opening…" : "Manage card & invoices"}
                <ExternalLink size={13} className="ms-1.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="border border-line rounded-2xl p-5 bg-paper">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
            <Coins size={11} /> Credits
          </p>
          <p className="font-serif text-4xl text-ink">{credits.balance}</p>
          {credits.allowance > 0 && (
            <p className="text-xs text-muted mt-1">of {credits.allowance} a month</p>
          )}
          {credits.refreshes_at && (
            <p className="text-xs text-muted mt-2">Refreshes {day(credits.refreshes_at)}</p>
          )}
          <button
            type="button"
            onClick={() => navigate(["credit-usage"])}
            className="font-mono text-[10px] uppercase tracking-wider text-ink mt-3 inline-flex items-center gap-1.5 hover:text-accent transition"
          >
            Where they went <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* ── what you have paid ──────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Paid to date" value={money(spend.total_minor, spend.currency)} />
        <Stat label="Payments" value={spend.payments} />
        <Stat
          label="Billing"
          value={plan.billing_period === "annual" ? "Yearly" : onTrial ? "—" : "Monthly"}
        />
      </div>

      {/* ── the receipts ────────────────────────────────────────────── */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Receipts
        </p>

        {(receipts || []).length === 0 ? (
          <div className="border border-line rounded-xl p-10 text-center">
            <p className="text-sm text-muted">
              Nothing paid yet. Your trial does not need a card.
            </p>
          </div>
        ) : (
          <div className="border border-line rounded-2xl bg-paper overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Date", "What", "Credits", "Amount", "Status"].map((c, i) => (
                    <th
                      key={c}
                      className={`px-4 py-2.5 font-mono text-[9px] uppercase tracking-wider text-muted ${
                        i > 1 ? "text-end" : "text-start"
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const st = STATUS[r.status] || { label: r.status, cls: "text-muted" };
                  return (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                        {day(r.paid_at || r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {KIND[r.kind] || r.kind}
                        {r.tier && <span className="text-muted"> · {r.tier}</span>}
                        {r.billing_period && (
                          <span className="text-muted"> · {r.billing_period}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-xs text-ink">
                        {r.credits_granted || "—"}
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-xs text-ink whitespace-nowrap">
                        {money(r.amount_minor, r.currency)}
                      </td>
                      <td className={`px-4 py-3 text-end font-mono text-[10px] uppercase tracking-wider ${st.cls}`}>
                        {st.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Said plainly rather than behind a button that does nothing. */}
      {enabled === false && (
        <div className="border border-line rounded-xl p-5 bg-paper-warm/40 text-center">
          <p className="text-sm text-ink">
            <strong>Card payments are being switched on.</strong> Choose a plan and we will
            set it up with you directly — nothing you have made is affected.
          </p>
        </div>
      )}
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-0.5">{label}</p>
      <p className="text-sm text-ink">{children}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-line rounded-2xl p-5 bg-paper">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2">{label}</p>
      <p className="font-serif text-3xl text-ink">{value}</p>
    </div>
  );
}
