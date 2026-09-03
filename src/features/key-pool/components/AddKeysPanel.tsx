"use client";

// Adding keys. A textarea, not a field: what an admin actually has is a
// page copied out of a browser tab, and asking them to add fifteen keys
// one at a time is asking them to do the splitting the server already
// does.
//
// The one thing to get right here is the WAIT. Every key is probed with
// a real completion before it is stored — sequentially, up to ~20
// seconds each — so ten keys is a couple of minutes. A spinner that
// looks hung gets the tab closed halfway through a run that is still
// writing keys, so this states what is happening, counts the elapsed
// time, and never pretends to know the progress it cannot see.

import React, { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addKeys, splitKeys, MAX_KEYS_PER_PASTE, type AddResult } from "../api";

const SECONDS_PER_KEY = 20;

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AddKeysPanel({ onAdded }: { onAdded: () => void }) {
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<AddResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const parsed = splitKeys(raw);
  const tooMany = parsed.length > MAX_KEYS_PER_PASTE;

  const submit = async () => {
    if (!parsed.length || tooMany || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const res = await addKeys(raw, note);
      setResult(res);
      // Only clear the paste on a clean run. If some were rejected the
      // admin needs the original text to see which lines to fix — and
      // re-pasting a corrected batch is safe, since keys already in the
      // pool are skipped silently and rejected ones were never stored.
      if (!res.rejected?.length) { setRaw(""); setNote(""); }
      onAdded();
    } catch (e: any) {
      setError(e?.message || "Could not add those keys.");
    } finally {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5 mb-4">
          <span className="w-6 h-px bg-accent" /> <KeyRound size={12} /> Add keys
        </p>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={busy}
          rows={5}
          spellCheck={false}
          placeholder={"sk-or-v1-…\nsk-or-v1-…\nsk-or-v1-…"}
          aria-label="Paste OpenRouter keys, one per line"
          className="w-full px-3.5 py-3 rounded-xl border border-line bg-paper text-ink
                     font-mono text-[12px] leading-relaxed outline-none resize-y
                     focus:border-ink disabled:opacity-50 placeholder:text-muted/60"
        />

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            maxLength={200}
            placeholder="Note — where this batch came from (optional)"
            className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border border-line bg-paper
                       text-ink text-sm outline-none focus:border-ink disabled:opacity-50
                       placeholder:text-muted/70"
          />
          <Button onClick={submit} disabled={busy || !parsed.length || tooMany}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Probing…
              </span>
            ) : (
              `Probe and add${parsed.length ? ` ${parsed.length}` : ""}`
            )}
          </Button>
        </div>

        {tooMany && (
          <p className="text-[13px] text-crit mt-3">
            {parsed.length} keys in that paste — {MAX_KEYS_PER_PASTE} is the most that can go
            in at once. Split it.
          </p>
        )}

        {/* The honest wait. An estimate of the ceiling, not a fake bar:
            the server probes one key at a time and tells us nothing until
            the whole run is done. */}
        {busy ? (
          <p className="text-[13px] text-muted mt-3 leading-relaxed">
            Probing {parsed.length} {parsed.length === 1 ? "key" : "keys"}, one at a time —{" "}
            <strong className="text-ink font-medium">{mmss(elapsed)}</strong> elapsed, up to{" "}
            {mmss(parsed.length * SECONDS_PER_KEY)} for this batch. Leave this page open;
            keys are written as they pass.
          </p>
        ) : (
          <p className="text-[13px] text-muted mt-3 leading-relaxed">
            Every key is tried with one real completion before it is stored, about 20 seconds
            each — a mistyped key that skips the probe is discovered by a teacher losing a
            lesson to it. A key that answers <strong className="text-ink font-medium">429</strong>{" "}
            still passes: a free key whose allowance is already spent today is a real
            credential, and rotating around it is what the pool is for.
          </p>
        )}

        {error && <p className="text-[13px] text-crit mt-3">{error}</p>}

        {result && (
          <div className="mt-5 pt-5 border-t border-line/60">
            <p className="text-sm text-ink">
              {result.added > 0 ? (
                <>
                  Added <strong>{result.added}</strong>{" "}
                  {result.added === 1 ? "key" : "keys"} —{" "}
                  <span className="font-mono text-[12px] text-muted">
                    {result.labels.join(", ")}
                  </span>
                </>
              ) : (
                "Nothing was added."
              )}
            </p>

            {/* Per key, never as a count. "3 of 5 worked" without saying
                which three is not an answer an admin can act on. */}
            {!!result.rejected?.length && (
              <ul className="mt-3 space-y-1.5">
                {result.rejected.map((r, i) => (
                  <li
                    key={`${r.key}-${i}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]"
                  >
                    <span className="font-mono text-[12px] text-ink">{r.key}</span>
                    <span className="text-crit">{r.reason}</span>
                  </li>
                ))}
                <li className="text-[12px] text-muted pt-1.5">
                  Rejected keys were never stored. Fix those lines and paste again — the ones
                  that worked are skipped, and do not take a second label.
                </li>
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
