"use client";

// The key pool console.
//
// One free OpenRouter key has a daily allowance, and with one key the
// whole product stops the moment it is spent — until somebody edits an
// environment variable and redeploys. The pool moves the keys into a
// table the rotation walks: when one caps out the next answers and the
// teacher never learns anything happened. This screen is what fills and
// tends it.
//
// Three things, in this order: the number that predicts an outage, the
// keys, and the box you paste new ones into. Server-side gate: the
// backend puts every /api/superadmin/* path behind requireRole
// ('superadmin'), so this surface carries no authorisation of its own —
// StudioShell only routes a super admin (or a granted admin) here.

import React, { useCallback, useEffect, useState } from "react";
import { KeySquare, RotateCcw, Power, PowerOff, Trash2, Sunrise } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { flash } from "@/shared/lib/flash";
import {
  getPool, patchKey, removeKey, keyState, STATE_LABEL,
  type PoolKey, type PoolSnapshot, type PoolSettings, type KeyState,
} from "../api";
import AddKeysPanel from "./AddKeysPanel";
import PoolSettingsForm from "./PoolSettingsForm";
import EventFeed from "./EventFeed";

const DAY_MS = 24 * 60 * 60 * 1000;

// Resting is the most common state in a healthy pool, so it is not an
// alarm colour. Only a refused credential and a switched-off key are
// worth a reader's attention.
const STATE_CHIP: Record<KeyState, string> = {
  in_use: "border-sage text-sage bg-paper",
  resting: "border-line text-muted bg-paper",
  refused: "border-crit text-crit bg-paper",
  off: "border-line text-muted bg-paper-warm",
};

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

const shortTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";

export default function KeyPoolRoute() {
  const [pool, setPool] = useState<PoolSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  /**
   * The clock a cooldown is measured against.
   *
   * Held in state rather than read during render: a cooldown is the
   * only thing on this screen that changes without anyone touching it,
   * and Date.now() in the render body makes the server and the client
   * paint different rows. It is stamped when the pool is read and
   * nudged every half minute, so a key that finishes resting turns
   * itself back to "In use" without a refresh.
   */
  const [now, setNow] = useState(0);

  const reload = useCallback(
    () =>
      getPool()
        .then((p) => { setPool(p); setNow(Date.now()); setError(null); })
        .catch((e) => setError(e?.message || "Could not read the key pool.")),
    []
  );

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const act = async (id: number, body: { status?: PoolKey["status"]; clear_cooldown?: boolean }) => {
    setBusy(id);
    try {
      await patchKey(id, body);
      await reload();
    } catch (e: any) {
      flash(e?.message || "That did not work.");
    } finally {
      setBusy(null);
    }
  };

  const drop = async (id: number) => {
    setBusy(id);
    try {
      await removeKey(id);
      setConfirming(null);
      await reload();
    } catch (e: any) {
      // 409 at the floor carries the sentence worth reading, so it is
      // shown as the server wrote it rather than restated.
      flash(e?.message || "Could not remove that key.");
    } finally {
      setBusy(null);
    }
  };

  const settings: PoolSettings = pool?.settings ?? { min_active_keys: 1, cooldown_minutes: 90 };
  const usable = pool?.usable ?? 0;
  const floor = settings.min_active_keys;
  const keys = pool?.keys ?? [];

  // "Refused but KEPT" — the key is failing, the service knows, and it
  // is still in rotation because taking it out would leave nothing to
  // dial. That is a pool about to stop working, and it is the one event
  // worth interrupting someone for.
  const keptRefused = (pool?.events ?? []).filter(
    (e) => e.event === "refused" && now - Date.parse(e.created_at) < DAY_MS
  );

  const tone = usable === 0 ? "text-crit" : usable <= floor ? "text-warn" : "text-ink";

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Super admin
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          OpenRouter <em className="italic font-light text-accent">key pool</em>
        </h2>
        <p className="text-muted mt-2 max-w-2xl">
          The keys every AI generation on the platform is dialled through. The rotation walks
          them, rests the ones that hit their daily allowance, and puts a refused credential
          aside for a human — it never deletes one. Key values are never returned here, only a
          mask: this screen exists to add and tend keys, not to read them.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {/* ── The number that predicts an outage, and the two settings it
             is only meaningful against. ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card className="lg:col-span-2">
          <CardContent>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5 mb-5">
              <span className="w-6 h-px bg-accent" /> <KeySquare size={12} /> Usable now
            </p>

            {!pool && !error ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : (
              <>
                <div className="flex items-end gap-4 flex-wrap">
                  <span className={`font-serif text-6xl leading-none ${tone}`}>{usable}</span>
                  <span className="text-sm text-muted pb-1.5">
                    {usable === 1 ? "key" : "keys"} in rotation right now, against a floor of{" "}
                    <strong className="text-ink font-medium">{floor}</strong>
                  </span>
                  <button
                    onClick={reload}
                    className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition inline-flex items-center gap-1.5 pb-1.5"
                  >
                    <RotateCcw size={11} /> refresh
                  </button>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-5 pt-4 border-t border-line/60">
                  {(["in_use", "resting", "refused", "off"] as KeyState[]).map((s) => {
                    const n = keys.filter((k) => keyState(k, now) === s).length;
                    return (
                      <span key={s} className="font-mono text-[10px] uppercase tracking-wider text-muted">
                        {STATE_LABEL[s]} <strong className="text-ink not-italic">{n}</strong>
                      </span>
                    );
                  })}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Total <strong className="text-ink not-italic">{keys.length}</strong>
                  </span>
                </div>

                {usable === 0 && (
                  <p className="text-[13px] text-crit mt-4 leading-relaxed">
                    Nothing is usable. Every AI generation on the platform is failing right now —
                    add a key.
                  </p>
                )}
                {usable > 0 && usable <= floor && (
                  <p className="text-[13px] text-warn mt-4 leading-relaxed">
                    At the floor. Nothing can be removed, and one more key spending its
                    allowance stops the platform.
                  </p>
                )}
                {keptRefused.length > 0 && (
                  <p className="text-[13px] text-crit mt-3 leading-relaxed">
                    {keptRefused.length === 1 ? "A key is" : `${keptRefused.length} keys are`} being
                    refused by OpenRouter and{" "}
                    <strong className="font-medium">still in rotation</strong> — removing{" "}
                    {keptRefused.length === 1 ? "it" : "them"} would breach the floor. Add a
                    working key before this becomes an outage.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <PoolSettingsForm
              settings={settings}
              onSaved={(s) => setPool((p) => (p ? { ...p, settings: s } : p))}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── The keys ──────────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-5 font-medium">Key</th>
                  <th className="text-left py-3 font-medium">State</th>
                  <th className="text-left py-3 font-medium">Last success</th>
                  <th className="text-left py-3 font-medium">Added</th>
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {!pool && !error &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-b border-line/60 last:border-0">
                      <td className="py-3 px-5"><Skeleton className="h-4 w-40" /></td>
                      <td className="py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="py-3"><Skeleton className="h-3 w-16" /></td>
                      <td className="py-3"><Skeleton className="h-3 w-16" /></td>
                      <td className="py-3 px-5"><Skeleton className="h-7 w-24 rounded-md" /></td>
                    </tr>
                  ))}

                {keys.map((k) => {
                  const state = keyState(k, now);
                  const working = busy === k.id;
                  return (
                    <tr key={k.id} className="border-b border-line/60 last:border-0 align-top">
                      <td className="py-3 px-5">
                        <p className="text-ink">{k.label}</p>
                        <p className="font-mono text-[11px] text-muted mt-0.5">{k.masked}</p>
                        {k.note && <p className="text-[12px] text-muted mt-1 max-w-xs">{k.note}</p>}
                      </td>

                      <td className="py-3">
                        <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATE_CHIP[state]}`}>
                          {STATE_LABEL[state]}
                        </span>
                        {/* Resting is not broken: say when it comes back
                            rather than leaving a bare grey chip that reads
                            as a fault. */}
                        {state === "resting" && (
                          <p className="text-[12px] text-muted mt-1">
                            until {shortTime(k.cooldown_until)}
                          </p>
                        )}
                        {state === "refused" && (
                          <p className="text-[12px] text-crit mt-1">needs a human</p>
                        )}
                      </td>

                      <td className="py-3 text-muted text-xs">
                        {shortDate(k.last_ok_at)}
                        {k.last_ok_at && (
                          <span className="block text-[11px]">{shortTime(k.last_ok_at)}</span>
                        )}
                      </td>

                      <td className="py-3 text-muted text-xs">{shortDate(k.added_at)}</td>

                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {state === "resting" && (
                            <RowAction
                              icon={<Sunrise size={12} />}
                              label="Wake"
                              title="Back in rotation now — use when you know the allowance reset early"
                              disabled={working}
                              onClick={() => act(k.id, { clear_cooldown: true })}
                            />
                          )}
                          {(state === "refused" || state === "off") && (
                            <RowAction
                              icon={<Power size={12} />}
                              label={state === "off" ? "Enable" : "Re-enable"}
                              title="Put it back in rotation — for a credential that has been fixed at the provider"
                              disabled={working}
                              onClick={() => act(k.id, { status: "active", clear_cooldown: true })}
                            />
                          )}
                          {(state === "in_use" || state === "resting") && (
                            <RowAction
                              icon={<PowerOff size={12} />}
                              label="Disable"
                              title="Take it out of rotation without deleting it"
                              disabled={working}
                              onClick={() => act(k.id, { status: "disabled" })}
                            />
                          )}

                          {/* Deleting a credential cannot be undone, so
                              the confirmation is in the row rather than in
                              an OS dialog that gets dismissed by reflex. */}
                          {confirming === k.id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <RowAction
                                label="Remove for good"
                                tone="crit"
                                disabled={working}
                                onClick={() => drop(k.id)}
                              />
                              <RowAction label="Cancel" disabled={working} onClick={() => setConfirming(null)} />
                            </span>
                          ) : (
                            <RowAction
                              icon={<Trash2 size={12} />}
                              label="Remove"
                              tone="crit"
                              title="Delete it. The trail outlives it; the key cannot be recovered"
                              disabled={working}
                              onClick={() => setConfirming(k.id)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {pool && keys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted">
                      The pool is empty. Paste a key below to start it.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AddKeysPanel onAdded={reload} />
        <EventFeed events={pool?.events ?? []} />
      </div>
    </div>
  );
}

function RowAction({
  icon, label, title, onClick, disabled, tone = "plain",
}: {
  icon?: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "crit";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border transition",
        "inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed",
        tone === "crit"
          ? "border-line text-muted hover:border-crit hover:text-crit"
          : "border-line text-muted hover:border-ink hover:text-ink",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
