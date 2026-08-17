"use client";

// Account drawer — opens when the super admin clicks a row in the
// access table OR a row in any of the dashboard's "recent activity"
// lists. Shows the canonical account row plus content counts,
// schools, and an editable permission matrix.
//
// Server endpoints:
//   GET   /api/superadmin/account/:id
//   PATCH /api/superadmin/account/:id/permissions
//
// Permissions: super admin can flip each key per-account. Empty
// override (default) means the role default applies. The drawer
// shows the effective value (role default | per-account override)
// and lets you toggle to override.

import React, { useEffect, useState, useMemo } from "react";
import { X, Save, RotateCcw, Pause, Play, Coins, Eye, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, Field, inputClasses, selectClasses } from "./_shared";
import {
  PERMISSION_GROUPS, ROLE_DEFAULTS, resolvePermissions, PERMISSION_KEYS,
} from "../lib/permissions";
import { ROLE_LABELS, SUB_ROLE_LABELS } from "../lib/role";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABEL = {
  active: "Active",
  suspended: "Suspended",
  deleted: "Deleted",
};

// Small pill buttons for the one-click billing actions. Disabled state
// dims rather than blocks the eye.
const chipBtn =
  "font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full border border-line " +
  "bg-paper text-ink-soft hover:border-ink hover:text-ink transition disabled:opacity-50";
const dangerChip =
  "font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full border border-line " +
  "bg-paper text-ink-soft hover:border-accent hover:text-accent transition disabled:opacity-50";

export default function AccountDrawer({ accountId, isSelf, onClose, onChanged }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Billing editor — credits balance / allowance and the subscription.
  // These write the tables a teacher can never write themselves, through
  // the guarded RPCs, so the super admin can comp a plan or top up credits.
  const [billing, setBilling] = useState(null);
  const [billingDirty, setBillingDirty] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");

  // Read-only inspector — the honest form of "impersonation" here. The
  // super admin cannot take over the teacher's session, but can see
  // exactly what work and roster they hold, via a definer read.
  const [inspect, setInspect] = useState(null);
  const [inspecting, setInspecting] = useState(false);

  // The VIEWER's own role + capabilities decide which controls appear. A
  // super admin holds all of them; a delegated sub-admin sees only what
  // they were granted, so a card that would 403 never renders.
  const [myCaps, setMyCaps] = useState(null);
  const [actorRole, setActorRole] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/auth/me")
      .then((me) => { if (live) { setMyCaps(me?.permissions || {}); setActorRole(me?.role || null); } })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const isSuper = actorRole === "super_admin" || actorRole === "dev";
  const canBill = isSuper || !!myCaps?.["admin.billing"];
  const canManage = isSuper || !!myCaps?.["admin.accounts"];

  // Fetch the full account on mount / id change. Cancel-on-unmount
  // guard so a quick close doesn't write stale data.
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api(`/api/superadmin/account/${accountId}`)
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
        setOverrides(data.permissions || {});
        setDirty(false);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [accountId]);

  const defaults = useMemo(() => (account ? ROLE_DEFAULTS[account.role] || {} : {}), [account]);
  const effective = useMemo(() => (account ? resolvePermissions(account) : {}), [account]);

  // What value should the toggle show?  Override if set, else default.
  const valueFor = (key) => (key in overrides ? !!overrides[key] : !!defaults[key]);

  const toggle = (key) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const cur = key in next ? next[key] : !!defaults[key];
      next[key] = !cur;
      // If the new value matches the default, drop the override (keep
      // the JSON tight). Otherwise persist it.
      if (next[key] === !!defaults[key]) delete next[key];
      return next;
    });
    setDirty(true);
  };

  const resetGroup = (groupId) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const groupKeys = PERMISSION_GROUPS.find((g) => g.id === groupId)?.keys || [];
      for (const { key } of groupKeys) delete next[key];
      return next;
    });
    setDirty(true);
  };

  const resetAll = () => {
    setOverrides({});
    setDirty(true);
  };

  const save = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await api(`/api/superadmin/account/${accountId}/permissions`, {
        method: "PATCH",
        body: { permissions: overrides },
      });
      setDirty(false);
      onChanged && onChanged();
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Seed the billing form from the loaded account. Kept separate from the
  // permission overrides so saving one doesn't touch the other.
  useEffect(() => {
    if (!account) return;
    setBilling({
      balance: account.credits_balance ?? "",
      allowance: account.credits_allowance ?? "",
      plan: account.subscription_plan || "",
      status: account.subscription_status || "",
      ends_at: account.subscription_ends_at ? account.subscription_ends_at.slice(0, 10) : "",
    });
    setBillingDirty(false);
  }, [account]);

  const setBillingField = (k, v) => {
    setBilling((b) => ({ ...b, [k]: v }));
    setBillingDirty(true);
  };

  const saveBilling = async () => {
    if (!accountId || !billing) return;
    setSavingBilling(true);
    try {
      await api(`/api/superadmin/account/${accountId}/credits`, {
        method: "PATCH",
        body: {
          balance: billing.balance === "" ? null : Number(billing.balance),
          allowance: billing.allowance === "" ? null : Number(billing.allowance),
        },
      });
      await api(`/api/superadmin/account/${accountId}/subscription`, {
        method: "PATCH",
        body: {
          plan: billing.plan || null,
          status: billing.status || null,
          ends_at: billing.ends_at ? new Date(billing.ends_at).toISOString() : null,
        },
      });
      setBillingDirty(false);
      onChanged && onChanged();
      const r = await api(`/api/superadmin/account/${accountId}`);
      setAccount(r);
    } catch (e) {
      alert(`Billing update failed: ${e.message}`);
    } finally {
      setSavingBilling(false);
    }
  };

  // Re-pull the account after any billing action so the numbers on screen
  // are the ones now in the database, not the ones before the click.
  const refreshAccount = async () => {
    onChanged && onChanged();
    const r = await api(`/api/superadmin/account/${accountId}`);
    setAccount(r);
  };

  // Generic runner for the one-click billing actions (grant, activate,
  // extend, cancel, remove). Confirms destructive ones, refreshes after.
  const runAction = async (fn, confirmMsg) => {
    if (!accountId) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setActionBusy(true);
    try {
      await fn();
      await refreshAccount();
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setActionBusy(false);
    }
  };

  const grantCredits = (delta) =>
    runAction(() =>
      api(`/api/superadmin/account/${accountId}/grant-credits`, { method: "POST", body: { delta } })
    );

  const activatePlan = (plan) =>
    runAction(() =>
      api(`/api/superadmin/account/${accountId}/activate-plan`, { method: "POST", body: { plan } })
    );

  const extendSub = (days) =>
    runAction(() =>
      api(`/api/superadmin/account/${accountId}/extend`, { method: "POST", body: { days } })
    );

  const cancelSub = () =>
    runAction(
      () => api(`/api/superadmin/account/${accountId}/cancel-subscription`, { method: "POST" }),
      "Cancel this subscription? Writes stop; they can still read their work."
    );

  const removeSub = () =>
    runAction(
      () => api(`/api/superadmin/account/${accountId}/subscription`, { method: "DELETE" }),
      "Remove the subscription row entirely? They'll be on no plan at all."
    );

  const loadInspect = async () => {
    if (!accountId) return;
    setInspecting(true);
    try {
      const data = await api(`/api/superadmin/account/${accountId}/content`);
      setInspect(data);
    } catch (e) {
      alert(`Could not load content: ${e.message}`);
    } finally {
      setInspecting(false);
    }
  };

  const setStatus = async (status) => {
    if (!accountId || isSelf) return;
    if (!confirm(`Change status to ${status}?`)) return;
    try {
      await api(`/api/admin/teachers/${accountId}/status`, {
        method: "PATCH",
        body: { status },
      });
      onChanged && onChanged();
      const r = await api(`/api/superadmin/account/${accountId}`);
      setAccount(r);
    } catch (e) {
      alert(`Status change failed: ${e.message}`);
    }
  };

  if (!accountId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/30 z-40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-paper z-50 shadow-2xl overflow-y-auto"
        role="dialog"
        aria-label="Account details"
      >
        <header className="sticky top-0 z-10 bg-paper border-b border-line px-8 py-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
              Account access
            </p>
            <h2 className="font-serif text-2xl text-ink">
              {loading
                ? <Skeleton className="h-7 w-48" />
                : (account ? `${account.first_name} ${account.last_name}` : "Not found")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-md hover:bg-paper-warm flex items-center justify-center text-ink-soft transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {error && (
          <div className="m-8 bg-paper border border-accent rounded-lg p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
          </div>
        )}

        {loading && !account && (
          <div className="px-8 py-6 space-y-8">
            {Array.from({ length: 3 }).map((_, sectionIdx) => (
              <section key={sectionIdx} className="space-y-3">
                <Skeleton className="h-2.5 w-24" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-4 w-32 max-w-full" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <section className="space-y-3">
              <Skeleton className="h-2.5 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="space-y-1.5 pl-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {account && (
          <div className="px-8 py-6 space-y-8">
            {/* Identity + status row */}
            <section>
              <SectionHeader label="Identity" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Cell label="Email" value={account.email || "—"} />
                <Cell label="Phone" value={account.phone || "—"} />
                <Cell label="ID" value={account.staff_id || "—"} mono />
                <Cell label="Nationality" value={account.nationality || "—"} />
                <Cell label="Role" value={`${ROLE_LABELS[account.role] || account.role}${account.sub_role ? ` · ${SUB_ROLE_LABELS[account.sub_role] || account.sub_role}` : ""}`} />
                <Cell label="Status" value={STATUS_LABEL[account.status] || account.status} />
                <Cell label="Joined" value={account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"} />
                <Cell label="Last login" value={account.last_login_at ? new Date(account.last_login_at).toLocaleString() : "—"} />
              </dl>
            </section>

            {/* Subscription */}
            <section>
              <SectionHeader label="Subscription" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Cell label="Plan" value={account.subscription_plan || "—"} />
                <Cell label="Status" value={account.subscription_status || "—"} />
                <Cell
                  label="Ends at"
                  value={account.subscription_ends_at
                    ? new Date(account.subscription_ends_at).toLocaleDateString()
                    : "—"}
                />
              </dl>
            </section>

            {/* Billing controls — the full toolkit: grant tokens, upgrade /
                extend / cancel / remove a plan, or set anything by hand.
                Every button writes a table a teacher can never touch, through
                the guarded RPCs. */}
            {billing && canBill && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader label="Billing controls" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                    <Coins size={11} /> super admin
                  </span>
                </div>

                {/* Credits / tokens */}
                <div className="bg-paper-warm rounded-xl p-4 mb-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Tokens (credits)</p>
                    <p className="font-serif text-2xl text-ink leading-none">
                      {account.credits_balance ?? "—"}
                      <span className="font-mono text-[10px] text-muted ml-2">
                        / {account.credits_allowance ?? "—"} monthly
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {[100, 500, 1000].map((n) => (
                      <button key={n} disabled={actionBusy} onClick={() => grantCredits(n)} className={chipBtn}>
                        + {n}
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder="amount"
                        value={grantAmount}
                        onChange={(e) => setGrantAmount(e.target.value)}
                        className="w-24 px-3 py-1.5 rounded-full border border-line bg-paper text-ink text-sm outline-none focus:border-ink"
                      />
                      <button
                        disabled={actionBusy || !grantAmount}
                        onClick={() => { grantCredits(Number(grantAmount)); setGrantAmount(""); }}
                        className={chipBtn}
                      >
                        Grant
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                    <Field label="Set balance">
                      <input type="number" min="0" className={inputClasses}
                        value={billing.balance}
                        onChange={(e) => setBillingField("balance", e.target.value)} />
                    </Field>
                    <Field label="Monthly allowance">
                      <input type="number" min="0" className={inputClasses}
                        value={billing.allowance}
                        onChange={(e) => setBillingField("allowance", e.target.value)} />
                    </Field>
                    <Button variant="secondary" onClick={saveBilling} disabled={!billingDirty || savingBilling}>
                      <Save size={13} className="mr-1.5" /> {savingBilling ? "Saving…" : "Set"}
                    </Button>
                  </div>
                </div>

                {/* Subscription / plan */}
                <div className="bg-paper-warm rounded-xl p-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Subscription</p>
                    <p className="font-mono text-[11px] text-ink">
                      {account.subscription_plan || "no plan"} · {account.subscription_status || "—"}
                      {account.subscription_ends_at && (
                        <span className="text-muted"> · ends {new Date(account.subscription_ends_at).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>

                  {/* One-click upgrade to a plan for its natural duration */}
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-2">Activate plan</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {["trial", "monthly", "quarterly", "annual"].map((p) => (
                      <button key={p} disabled={actionBusy} onClick={() => activatePlan(p)} className={chipBtn}>
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Extend the current period */}
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-2">Extend</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[30, 90, 365].map((d) => (
                      <button key={d} disabled={actionBusy} onClick={() => extendSub(d)} className={chipBtn}>
                        + {d}d
                      </button>
                    ))}
                  </div>

                  {/* Set anything by hand */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <Field label="Plan">
                      <select className={selectClasses} value={billing.plan}
                        onChange={(e) => setBillingField("plan", e.target.value)}>
                        <option value="">— unchanged —</option>
                        {["trial", "monthly", "quarterly", "annual"].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select className={selectClasses} value={billing.status}
                        onChange={(e) => setBillingField("status", e.target.value)}>
                        <option value="">— unchanged —</option>
                        {["trialing", "active", "past_due", "canceled", "expired"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Ends at">
                      <input type="date" className={inputClasses}
                        value={billing.ends_at}
                        onChange={(e) => setBillingField("ends_at", e.target.value)} />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={saveBilling} disabled={!billingDirty || savingBilling}>
                      <Save size={13} className="mr-1.5" /> {savingBilling ? "Saving…" : "Set fields"}
                    </Button>
                    <button disabled={actionBusy} onClick={cancelSub} className={dangerChip}>
                      Cancel plan
                    </button>
                    <button disabled={actionBusy} onClick={removeSub} className={dangerChip}>
                      Remove subscription
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Content footprint */}
            <section>
              <SectionHeader label="Content footprint" />
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                {Object.entries(account.content || {}).map(([k, v]) => (
                  <div key={k} className="bg-paper-warm rounded-lg p-3">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted">{k}</p>
                    <p className="font-serif text-2xl text-ink">{v}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Inspector — read-only window into the teacher's own work and
                roster. The direct-Supabase model has no true impersonation
                (that needs their session); this is the honest equivalent.
                Needs the accounts capability. */}
            {canManage && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionHeader label="Inspect account" />
                {!inspect && (
                  <button
                    onClick={loadInspect}
                    disabled={inspecting}
                    className="font-mono text-[10px] uppercase tracking-wider text-ink hover:text-accent transition inline-flex items-center gap-1.5"
                  >
                    <Eye size={12} /> {inspecting ? "Loading…" : "View their work"}
                  </button>
                )}
              </div>
              {inspect && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
                      <FileText size={11} /> Work · {inspect.work?.length || 0}
                    </p>
                    <ul className="text-sm divide-y divide-line/60">
                      {(inspect.work || []).length === 0 && (
                        <li className="py-2 text-muted">No saved work.</li>
                      )}
                      {(inspect.work || []).map((w) => (
                        <li key={w.id} className="py-2 flex items-center gap-2">
                          <span className="text-ink truncate flex-1">{w.title}</span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">{w.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2 inline-flex items-center gap-1.5">
                      <Users size={11} /> Students · {inspect.students?.length || 0}
                    </p>
                    <ul className="text-sm divide-y divide-line/60">
                      {(inspect.students || []).length === 0 && (
                        <li className="py-2 text-muted">No roster.</li>
                      )}
                      {(inspect.students || []).map((s) => (
                        <li key={s.id} className="py-2 flex items-center gap-2">
                          <span className="text-ink truncate flex-1">{s.first_name} {s.last_name}</span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                            {s.grade}{s.section ? `·${s.section}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
            )}

            {/* Schools */}
            {account.schools && account.schools.length > 0 && (
              <section>
                <SectionHeader label="Assigned schools" />
                <ul className="text-sm space-y-1.5">
                  {account.schools.map((s) => (
                    <li key={s.id} className="flex items-center gap-3">
                      <span className="text-ink">{s.name}</span>
                      <span className="text-muted text-xs">{s.emirate}</span>
                      {s.is_primary && (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-accent">
                          primary
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Permissions editor — granting capabilities is a super-admin
                power (sa_set_permissions is super-only), so it shows only to
                a super admin. For an admin account it edits the sub-admin
                capabilities; for a teacher, their studio permissions. */}
            {isSuper && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader label={account.role === "admin" ? "Sub-admin access" : "Permissions"} />
                <button
                  onClick={resetAll}
                  className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={11} /> reset all
                </button>
              </div>
              <p className="text-xs text-muted mb-5">
                Toggles override the {ROLE_LABELS[account.role] || account.role} role defaults.
                A purple dot marks per-account overrides; reset removes the override and falls back
                to the role default.
              </p>

              <div className="space-y-6">
                {PERMISSION_GROUPS
                  .filter((g) => (account.role === "admin" ? g.id === "admin" : g.id !== "admin"))
                  .map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-serif text-base text-ink">{g.label}</h4>
                      <button
                        onClick={() => resetGroup(g.id)}
                        className="font-mono text-[9px] uppercase tracking-wider text-muted hover:text-ink transition"
                      >
                        reset group
                      </button>
                    </div>
                    <p className="text-xs text-muted mb-3">{g.description}</p>
                    <div className="space-y-1">
                      {g.keys.map(({ key, label }) => {
                        const v = valueFor(key);
                        const isOverride = key in overrides;
                        return (
                          <label key={key} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-paper-warm cursor-pointer">
                            <Toggle on={v} />
                            <input
                              type="checkbox"
                              checked={v}
                              onChange={() => toggle(key)}
                              className="sr-only"
                            />
                            <span className="text-sm text-ink-soft flex-1">{label}</span>
                            {isOverride && (
                              <span
                                title="Per-account override"
                                className="w-1.5 h-1.5 rounded-full bg-accent"
                              />
                            )}
                            <span className="font-mono text-[10px] text-muted">{key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            )}
          </div>
        )}

        {/* Footer — sticky save */}
        {account && (
          <footer className="sticky bottom-0 bg-paper border-t border-line px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isSelf && canManage && (
                <>
                  {account.status === "suspended" ? (
                    <Button variant="secondary" onClick={() => setStatus("active")}>
                      <Play size={13} className="mr-2" /> Reactivate
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => setStatus("suspended")}>
                      <Pause size={13} className="mr-2" /> Suspend
                    </Button>
                  )}
                </>
              )}
              {isSelf && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  this is you
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>Close</Button>
              <Button onClick={save} disabled={!dirty || saving}>
                <Save size={13} className="mr-2" /> {saving ? "Saving…" : "Save permissions"}
              </Button>
            </div>
          </footer>
        )}
      </aside>
    </>
  );
}

function SectionHeader({ label }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
      <span className="w-6 h-px bg-accent" /> {label}
    </p>
  );
}

function Cell({ label, value, mono }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted mb-0.5">{label}</dt>
      <dd className={`text-ink ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <span
      className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full transition border ${
        on ? "bg-accent border-accent" : "bg-paper-warm border-line"
      }`}
      aria-hidden
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-paper transition ${
          on ? "left-3" : "left-0.5"
        }`}
      />
    </span>
  );
}
