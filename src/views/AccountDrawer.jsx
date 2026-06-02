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
import { X, Save, RotateCcw, Pause, Play, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import {
  PERMISSION_GROUPS, ROLE_DEFAULTS, resolvePermissions, PERMISSION_KEYS,
} from "../lib/permissions";
import { ROLE_LABELS, SUB_ROLE_LABELS } from "../lib/role";

const STATUS_LABEL = {
  active: "Active",
  suspended: "Suspended",
  deleted: "Deleted",
};

export default function AccountDrawer({ accountId, isSelf, onClose, onChanged }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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
              {loading ? "…" : (account ? `${account.first_name} ${account.last_name}` : "Not found")}
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

            {/* Permissions editor */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader label="Permissions" />
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
                {PERMISSION_GROUPS.map((g) => (
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
          </div>
        )}

        {/* Footer — sticky save */}
        {account && (
          <footer className="sticky bottom-0 bg-paper border-t border-line px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isSelf && (
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
