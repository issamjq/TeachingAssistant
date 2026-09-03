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
import { KeySquare, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { flash } from "@/shared/lib/flash";
import {
  getPool, patchKey, removeKey,
  type PoolKey, type PoolSnapshot, type PoolSettings,
} from "../api";
import AddKeysPanel from "./AddKeysPanel";
import PoolSettingsForm from "./PoolSettingsForm";
import EventFeed from "./EventFeed";
import KeysTable from "./KeysTable";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function KeyPoolRoute() {
  const [pool, setPool] = useState<PoolSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
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

  const patch = useCallback(
    async (id: number, body: { status?: PoolKey["status"]; clear_cooldown?: boolean }) => {
      setBusy(id);
      try {
        await patchKey(id, body);
        await reload();
      } catch (e: any) {
        flash(e?.message || "That did not work.");
      } finally {
        setBusy(null);
      }
    },
    [reload]
  );

  const drop = useCallback(
    async (id: number) => {
      setBusy(id);
      try {
        await removeKey(id);
        await reload();
      } catch (e: any) {
        // 409 at the floor carries the sentence worth reading, so it is
        // shown as the server wrote it rather than restated.
        flash(e?.message || "Could not remove that key.");
      } finally {
        setBusy(null);
      }
    },
    [reload]
  );

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
             is only meaningful against. The per-state counts live on the
             table's filter chips, where the number is also the way to
             act on it. ────────────────────────────────────────────── */}
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
                    of {keys.length} {keys.length === 1 ? "key" : "keys"} in rotation right now,
                    against a floor of <strong className="text-ink font-medium">{floor}</strong>
                  </span>
                  <button
                    onClick={reload}
                    className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition inline-flex items-center gap-1.5 pb-1.5"
                  >
                    <RotateCcw size={11} /> refresh
                  </button>
                </div>

                {usable === 0 && (
                  <p className="text-[13px] text-crit mt-5 pt-4 border-t border-line/60 leading-relaxed">
                    Nothing is usable. Every AI generation on the platform is failing right now —
                    add a key.
                  </p>
                )}
                {usable > 0 && usable <= floor && (
                  <p className="text-[13px] text-warn mt-5 pt-4 border-t border-line/60 leading-relaxed">
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

      <KeysTable
        keys={keys}
        now={now}
        loading={!pool && !error}
        busyId={busy}
        onPatch={patch}
        onRemove={drop}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AddKeysPanel onAdded={reload} />
        <EventFeed events={pool?.events ?? []} />
      </div>
    </div>
  );
}
