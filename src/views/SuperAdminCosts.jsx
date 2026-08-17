"use client";

// AI credit costs — its own super-admin surface. What each AI generation
// charges a teacher, platform-wide. Server-authoritative (the browser
// cannot understate a cost): reads /api/superadmin/credit-costs and writes
// each change through the guarded sa_set_credit_cost RPC, which audits it.
//
// Server-side gate: every /api/superadmin/* path is re-checked by
// is_super_admin() in the database, so this surface carries no auth of its
// own — StudioShell only routes a super_admin here.

import React, { useEffect, useState } from "react";
import { Coins, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminCosts() {
  const [costs, setCosts] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [savedFlash, setSavedFlash] = useState(null);

  const reload = () =>
    api("/api/superadmin/credit-costs")
      .then((rows) => { setCosts(rows); setError(null); })
      .catch((e) => setError(e.message));
  useEffect(() => { reload(); }, []);

  const save = async (feature, raw) => {
    const cost = Math.max(0, Math.round(Number(raw) || 0));
    const cur = costs.find((c) => c.feature === feature);
    if (cur && cur.cost === cost) return; // no change
    setBusy(feature);
    try {
      await api(`/api/superadmin/credit-costs/${feature}`, { method: "PATCH", body: { cost } });
      setCosts((rows) => rows.map((r) => (r.feature === feature ? { ...r, cost } : r)));
      setSavedFlash(feature);
      setTimeout(() => setSavedFlash((f) => (f === feature ? null : f)), 1400);
    } catch (e) {
      alert(`Could not save ${feature}: ${e.message}`);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const total = (costs || []).reduce((a, c) => a + (c.cost || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Super admin
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          AI <em className="italic font-light text-accent">credit costs</em>
        </h2>
        <p className="text-muted mt-2 max-w-2xl">
          What each AI generation charges a teacher, in credits. Applies to every account.
          Changes save as you type and take effect immediately — every one is recorded in the audit trail.
          Set a value to <strong>0</strong> to make that action free.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> <Coins size={12} /> Per-feature pricing
            </p>
            <button
              onClick={reload}
              className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition inline-flex items-center gap-1.5"
            >
              <RotateCcw size={11} /> refresh
            </button>
          </div>

          {!costs && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(costs || []).map((c) => (
              <div key={c.feature} className="bg-paper-warm rounded-xl p-4 border border-line/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-ink leading-tight">{c.label || c.feature}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-0.5 truncate">{c.feature}</p>
                  </div>
                  {savedFlash === c.feature && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-sage">saved</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    min="0"
                    defaultValue={c.cost}
                    key={`${c.feature}-${c.cost}`}
                    disabled={busy === c.feature}
                    onBlur={(e) => save(c.feature, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="w-20 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-base font-serif outline-none focus:border-ink disabled:opacity-50"
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {c.cost === 0 ? "free" : "credits"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {costs && costs.length > 0 && (
            <p className="text-xs text-muted mt-5">
              A teacher generating one of each would spend <strong className="text-ink">{total} credits</strong>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
