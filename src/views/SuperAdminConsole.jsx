// Super admin console — pyramid top. Creates / edits / removes accounts
// across roles (admin, moe, owner, teacher) and assigns sub-roles where
// applicable. Per-role business rules (what each role *does* in the app)
// are defined elsewhere; this surface is just the account management
// layer.
//
// Server-side gate: requireRole("admin", "super_admin", "dev") +
// per-handler canGrantRole(). dev / super_admin / admin all reach
// /api/admin/*; super_admin is the only one with full grant scope below.

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pause, Play, Trash2, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Field, Modal, ConfirmDelete,
  inputClasses, selectClasses, api,
} from "./_shared";
import {
  ROLES, ROLE_LABELS, SUB_ROLES, SUB_ROLE_LABELS, rolesGrantableBy,
} from "../lib/role";

const STATUS_LABEL = {
  active: "Active",
  suspended: "Suspended",
  deleted: "Deleted",
};

// Hardcode actor = super_admin for this console — it's only reachable
// when role === "super_admin" (App.jsx routing). Server still validates.
const ACTOR = { role: "super_admin", sub_role: null };
const GRANTABLE = rolesGrantableBy(ACTOR);

const roleBadgeStyles = {
  super_admin: "border-accent text-accent",
  dev:         "border-ink text-ink",
  admin:       "border-gold text-gold",
  moe:         "border-sage text-sage",
  owner:       "border-ink text-ink",
  teacher:     "border-line text-ink-soft",
};

function RoleBadge({ role, subRole }) {
  const style = roleBadgeStyles[role] || roleBadgeStyles.teacher;
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border bg-paper ${style}`}>
      {ROLE_LABELS[role] || role}
      {subRole ? ` · ${SUB_ROLE_LABELS[subRole] || subRole}` : ""}
    </span>
  );
}

export default function SuperAdminConsole() {
  const [stats, setStats] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [me, setMe] = useState(null); // canonical actor row from /api/auth/me
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // "new" | row object
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all"); // role filter

  const reload = () => {
    setLoading(true);
    // /api/auth/me runs alongside stats + teachers so the row-action
    // logic can identify the actor and hide self-destructive controls
    // (suspend/delete on your own row).
    Promise.all([
      api("/api/admin/stats"),
      api("/api/admin/teachers"),
      api("/api/auth/me"),
    ])
      .then(([s, t, m]) => {
        setStats(s); setAccounts(t); setMe(m); setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const setStatus = async (t, status) => {
    await api(`/api/admin/teachers/${t.id}/status`, { method: "PATCH", body: { status } });
    reload();
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/teachers/${deleting.id}`, { method: "DELETE" });
      setAccounts((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onSaved = (saved) => {
    setAccounts((rows) => {
      const idx = rows.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const copy = [...rows];
        copy[idx] = { ...copy[idx], ...saved };
        return copy;
      }
      return [saved, ...rows];
    });
    setEditing(null);
  };

  const visible = useMemo(() => {
    if (filter === "all") return accounts;
    return accounts.filter((t) => t.role === filter);
  }, [accounts, filter]);

  // Counts by role for the filter chips. Computed once per render — the
  // teacher list is small enough that this is fine without memoization
  // beyond useMemo.
  const counts = useMemo(() => {
    const c = { all: accounts.length };
    for (const r of ROLES) c[r] = 0;
    for (const t of accounts) c[t.role] = (c[t.role] || 0) + 1;
    return c;
  }, [accounts]);

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Super admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Account <em className="italic font-light text-accent">access</em>
          </h2>
          <p className="text-muted mt-2">
            Create and manage accounts across the pyramid — admin, MoE, owner, teacher.
            Permissions per role land here once each dashboard is scoped.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> New account
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            ["Active teachers", stats.active_teachers],
            ["Suspended", stats.suspended_teachers],
            ["Total teachers", stats.total_teachers],
            ["Lapsed subs", stats.lapsed],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">{label}</p>
                <p className="font-serif text-5xl font-medium text-accent leading-none">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Role filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
        {ROLES.filter((r) => counts[r] > 0).map((r) => (
          <FilterChip
            key={r}
            active={filter === r}
            onClick={() => setFilter(r)}
            label={ROLE_LABELS[r]}
            count={counts[r]}
          />
        ))}
      </div>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-5 font-medium">Name</th>
                  <th className="text-left py-3 font-medium">Email</th>
                  <th className="text-left py-3 font-medium">Role</th>
                  <th className="text-left py-3 font-medium">Status</th>
                  <th className="text-left py-3 font-medium">Last login</th>
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  // Hide every destructive control on the actor's own
                  // row. The backend already rejects self-suspend /
                  // self-delete, but the UI shouldn't even offer them
                  // — clicking suspend on yourself locks you out, and
                  // the modal-less "are you sure" is too thin a guard.
                  const isSelf = me && me.id === t.id;
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                      <td className="py-3 px-5 text-ink">
                        {t.first_name} {t.last_name}
                        {isSelf && (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                            you
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-muted text-xs">{t.email || "—"}</td>
                      <td className="py-3"><RoleBadge role={t.role} subRole={t.sub_role} /></td>
                      <td className="py-3">
                        <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          t.status === "active"    ? "border-sage text-sage bg-paper" :
                          t.status === "suspended" ? "border-gold text-gold bg-paper" :
                                                     "border-accent text-accent bg-paper"
                        }`}>
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted text-xs">
                        {t.last_login_at ? new Date(t.last_login_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-1">
                          {!isSelf && GRANTABLE.includes(t.role) && (
                            <button onClick={() => setEditing(t)} title="Edit role"
                              className="h-7 w-7 rounded-md border border-line hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition">
                              <Pencil size={12} />
                            </button>
                          )}
                          {!isSelf && (t.status === "suspended" ? (
                            <button onClick={() => setStatus(t, "active")} title="Reactivate"
                              className="h-7 w-7 rounded-md border border-line hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition">
                              <Play size={12} />
                            </button>
                          ) : (
                            <button onClick={() => setStatus(t, "suspended")} title="Suspend"
                              className="h-7 w-7 rounded-md border border-line hover:border-gold hover:bg-paper-warm flex items-center justify-center text-ink-soft transition">
                              <Pause size={12} />
                            </button>
                          ))}
                          {!isSelf && GRANTABLE.includes(t.role) && (
                            <button onClick={() => setDeleting(t)} title="Delete"
                              className="h-7 w-7 rounded-md border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center text-ink-soft hover:text-accent transition">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted">No accounts match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <AccountModal
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete ${deleting.first_name} ${deleting.last_name}?` : ""}
        message="The account and ALL their content (lessons, students, etc.) will be removed."
      />
    </div>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-ink text-paper border-ink"
          : "bg-paper text-ink-soft border-line hover:border-ink"
      }`}
    >
      {label} <span className="opacity-60">· {count}</span>
    </button>
  );
}

function AccountModal({ row, onClose, onSaved }) {
  const isEdit = !!row;
  const [form, setForm] = useState({
    first_name: row?.first_name || "",
    last_name:  row?.last_name  || "",
    email:      row?.email      || "",
    staff_id:   row?.staff_id   || "",
    role:       row?.role       || GRANTABLE[0] || "teacher",
    sub_role:   row?.sub_role   || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Clear sub_role when switching to a role that doesn't have any.
  useEffect(() => {
    if (!SUB_ROLES[form.role]?.length && form.sub_role) {
      set("sub_role", "");
    }
  }, [form.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const body = {
        first_name: form.first_name,
        last_name:  form.last_name,
        email:      form.email || null,
        staff_id:   form.staff_id || null,
        role:       form.role,
        sub_role:   form.sub_role || null,
      };
      let saved;
      if (isEdit) {
        // Role/sub_role change uses the dedicated endpoint. Other field
        // edits aren't supported here yet — the super admin manages
        // access, not personal details (those live on the user's own
        // profile page).
        saved = await api(`/api/admin/teachers/${row.id}/role`, {
          method: "PATCH",
          body: { role: body.role, sub_role: body.sub_role },
        });
        saved = { ...row, ...saved };
      } else {
        saved = await api("/api/admin/teachers", { method: "POST", body });
      }
      onSaved(saved);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const subs = SUB_ROLES[form.role] || [];

  return (
    <Modal
      open onClose={onClose}
      eyebrow={isEdit ? "Edit role" : "New account"}
      title={isEdit ? `Edit ${row.first_name} ${row.last_name}` : "Create an account"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save role" : "Create")}
          </Button>
        </>
      }
    >
      {err && <div className="mb-4 bg-paper border border-accent rounded-lg p-3"><p className="text-sm text-accent">{err}</p></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isEdit && (
          <>
            <Field label="First name">
              <input className={inputClasses} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </Field>
            <Field label="Last name">
              <input className={inputClasses} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputClasses} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="ID">
              <input className={inputClasses} value={form.staff_id} onChange={(e) => set("staff_id", e.target.value)} />
            </Field>
          </>
        )}
        <div className={subs.length ? "" : "md:col-span-2"}>
          <Field label="Role">
            <select className={selectClasses} value={form.role} onChange={(e) => set("role", e.target.value)}>
              {GRANTABLE.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </Field>
        </div>
        {subs.length > 0 && (
          <div>
            <Field label="Sub-role">
              <select className={selectClasses} value={form.sub_role} onChange={(e) => set("sub_role", e.target.value)}>
                <option value="">— None —</option>
                {subs.map((s) => (
                  <option key={s} value={s}>{SUB_ROLE_LABELS[s] || s}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="md:col-span-2">
          <p className="text-xs text-muted">
            Dev and Super admin accounts are env-only — add the email to <code>DEV_EMAILS</code> /
            <code> SUPER_ADMIN_EMAILS</code> on the server. Per-role permissions land once each
            dashboard is scoped.
          </p>
        </div>
      </div>
    </Modal>
  );
}
