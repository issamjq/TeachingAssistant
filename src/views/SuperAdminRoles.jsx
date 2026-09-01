"use client";

// =====================================================================
// Roles & access — who may do what across the platform
//
// Access in Murchid resolves in four steps, and until this screen
// existed only two of them were visible anywhere:
//
//   1. super_admin / dev              everything, always
//   2. the account's own override     users.permissions[cap]
//   3. the role's default             role_capabilities[role][cap]
//   4. deny
//
// Step 3 used to be a literal inside admin_can() — `p_cap IN
// ('admin.dashboard','admin.accounts')` — which meant giving a new kind
// of staff member a new kind of access was a migration. Since §95 it is
// a table, and this is the screen that edits it.
//
// Showing the default WITHOUT showing the exceptions to it would be
// worse than showing nothing: a grid that says "admins cannot touch
// billing" while four admins carry an override saying otherwise is a
// confident lie. So every cell carries its override count, and the
// second half of the screen lists the staff those overrides belong to.
//
// One hard floor, enforced in the database and not here: a teacher or a
// student can never hold an admin.* capability, whatever is typed into
// this grid. The table decides how much a staff member gets. It does
// not decide who counts as staff — that is the role, and changing it is
// Account access, one screen up.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Check, Minus, RotateCcw, Info, Lock } from "lucide-react";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/role";

/** The platform capabilities, with their labels, straight from the catalog. */
const CAPS = PERMISSION_GROUPS.find((g) => g.id === "admin")?.keys || [];

/** Roles that hold capabilities by definition — the grid shows them as
 *  locked rather than hiding them, because "why isn't dev listed" is a
 *  question the answer should not require reading the source for. */
const ABSOLUTE = ["super_admin", "dev"];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never";

export default function SuperAdminRoles() {
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);   // "role:cap" mid-flight
  const [notice, setNotice] = useState(null);

  const load = React.useCallback(() => {
    setError(null);
    api("/api/superadmin/roles")
      .then(setMatrix)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  // role → cap → {allowed, overrides}
  const cells = useMemo(() => {
    const m = {};
    for (const c of matrix?.cells || []) {
      (m[c.role] ||= {})[c.cap] = c;
    }
    return m;
  }, [matrix]);

  const editableRoles = useMemo(
    () => (matrix?.roles || []).filter((r) => !ABSOLUTE.includes(r)),
    [matrix]
  );

  async function toggle(role, cap, next) {
    const key = `${role}:${cap}`;
    setBusy(key);
    setNotice(null);
    // Optimistic: the grid is a wall of switches and a round trip per
    // click would make it feel broken. Reverted from the reload below if
    // the write was refused.
    setMatrix((m) => ({
      ...m,
      cells: (m?.cells || []).map((c) =>
        c.role === role && c.cap === cap ? { ...c, allowed: next } : c
      ),
    }));
    try {
      await api("/api/superadmin/roles/cap", {
        method: "PATCH",
        body: { role, cap, allowed: next },
      });
      setNotice(
        `${ROLE_LABELS[role] || role} ${next ? "can now" : "can no longer"} ${
          (CAPS.find((c) => c.key === cap)?.label || cap).toLowerCase()
        } — for anyone without their own override.`
      );
    } catch (e) {
      setError(e.message);
      load();
    } finally {
      setBusy(null);
    }
  }

  async function clearOverride(facultyId, cap) {
    try {
      await api(`/api/superadmin/account/${facultyId}/permissions`, {
        method: "DELETE",
        body: { cap },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !matrix) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Super admin
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Roles &amp; <em className="italic font-light text-accent">access</em>
        </h2>
        <p className="text-muted mt-2 max-w-3xl">
          What each staff role can reach by default. Every switch here gates a
          function in the database, not just a hidden button — a role without a
          capability is refused by Postgres even if it types the URL.
        </p>
      </div>

      {error && (
        <div className="bg-paper border border-accent rounded-lg px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}
      {notice && (
        <div className="bg-paper border border-line rounded-lg px-4 py-3 flex items-start gap-3">
          <Check size={15} className="text-sage flex-shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-sm text-ink-soft">{notice}</p>
        </div>
      )}

      {/* ── the grid ── */}
      <section className="bg-paper border border-line rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="font-serif text-xl text-ink">Default access by role</h3>
            <p className="text-xs text-muted mt-1 max-w-2xl">
              A change here moves everyone holding that role who does not carry
              their own override. The count beside a switch is how many of them
              do — those people are unaffected, and listed below.
            </p>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-ink inline-block" /> granted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-line inline-block" /> denied
            </span>
          </div>
        </div>

        {!matrix ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-muted font-normal py-2 pr-4">
                    Capability
                  </th>
                  {ABSOLUTE.concat(editableRoles).map((r) => (
                    <th key={r} className="py-2 px-2 min-w-[104px]">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-ink">
                        {ROLE_LABELS[r] || r}
                      </span>
                      <span className="block font-mono text-[10px] text-muted mt-0.5">
                        {matrix.holders?.[r] || 0} account{(matrix.holders?.[r] || 0) === 1 ? "" : "s"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPS.map((cap) => (
                  <tr key={cap.key} className="border-b border-line/50">
                    <td className="py-3 pr-4">
                      <span className="text-ink">{cap.label}</span>
                      <span className="block font-mono text-[10px] text-muted">{cap.key}</span>
                    </td>

                    {/* super_admin and dev pass every gate before the table
                        is consulted, so a switch for them would be a
                        control that does nothing. Shown, locked. */}
                    {ABSOLUTE.map((r) => (
                      <td key={r} className="py-3 px-2 text-center">
                        <span
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-ink/10 text-ink-soft"
                          title={`${ROLE_LABELS[r]} holds every capability by definition`}
                        >
                          <Lock size={12} strokeWidth={2} />
                        </span>
                      </td>
                    ))}

                    {editableRoles.map((r) => {
                      const cell = cells[r]?.[cap.key];
                      const on = !!cell?.allowed;
                      const key = `${r}:${cap.key}`;
                      return (
                        <td key={r} className="py-3 px-2 text-center">
                          <button
                            disabled={busy === key}
                            onClick={() => toggle(r, cap.key, !on)}
                            aria-pressed={on}
                            aria-label={`${ROLE_LABELS[r] || r}: ${cap.label}`}
                            className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition disabled:opacity-40 ${
                              on
                                ? "bg-ink border-ink text-paper hover:bg-accent hover:border-accent"
                                : "bg-transparent border-line text-muted hover:border-ink hover:text-ink"
                            }`}
                          >
                            {on ? <Check size={13} strokeWidth={2.4} /> : <Minus size={13} strokeWidth={2.4} />}
                          </button>
                          {cell?.overrides > 0 && (
                            <span
                              className="block font-mono text-[10px] text-accent mt-1"
                              title={`${cell.overrides} account(s) override this default`}
                            >
                              {cell.overrides} set
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-line/60 flex items-start gap-3">
          <Info size={14} className="text-muted flex-shrink-0 mt-0.5" strokeWidth={1.9} />
          <p className="text-xs text-muted max-w-3xl">
            Teachers and students are absent on purpose. The database refuses
            an <code className="font-mono text-[11px] text-ink-soft">admin.*</code>{" "}
            capability for either, whatever is written here — this grid decides
            how much a staff member gets, not who counts as staff. To make
            someone staff, change their role in{" "}
            <span className="text-ink-soft">Account access</span>.
          </p>
        </div>
      </section>

      {/* ── the people ── */}
      <section className="bg-paper border border-line rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="font-serif text-xl text-ink">Staff accounts</h3>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Everyone holding a staff role, and any capability pinned on their
            account. A pinned capability ignores the grid above — clearing it
            hands the account back to its role&rsquo;s default.
          </p>
        </div>

        {!matrix ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (matrix.staff || []).length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted py-6 text-center">
            No staff accounts yet
          </p>
        ) : (
          <ul className="divide-y divide-line/60">
            {matrix.staff.map((s) => {
              const pinned = Object.entries(s.permissions || {}).filter(([k]) =>
                k.startsWith("admin.")
              );
              return (
                <li key={s.user_id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink flex items-center gap-2">
                        <ShieldCheck size={14} className="text-muted" strokeWidth={1.9} />
                        {s.name}
                        <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                          {ROLE_LABELS[s.role] || s.role}
                          {s.sub_role ? ` · ${s.sub_role}` : ""}
                        </span>
                      </p>
                      <p className="font-mono text-[10px] text-muted mt-0.5">{s.email}</p>
                      <p className="text-xs text-muted mt-1">
                        {ROLE_DESCRIPTIONS[s.role] || ""}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">
                      last in {fmtDate(s.last_login_at)}
                    </p>
                  </div>

                  {pinned.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pinned.map(([cap, val]) => (
                        <span
                          key={cap}
                          className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-paper border border-line font-mono text-[10px] uppercase tracking-wider"
                        >
                          <span className={val ? "text-sage" : "text-accent"}>
                            {val ? "granted" : "denied"}
                          </span>
                          <span className="text-ink-soft normal-case tracking-normal">{cap}</span>
                          {s.faculty_id && (
                            <button
                              onClick={() => clearOverride(s.faculty_id, cap)}
                              title="Clear this override — fall back to the role default"
                              className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted hover:text-accent transition"
                            >
                              <RotateCcw size={11} strokeWidth={2.2} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
