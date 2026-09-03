"use client";

// The two numbers that govern the pool. Small on purpose — it sits
// beside the header, not in a settings screen of its own, because the
// floor only means anything read against the usable count next to it.
//
// Uncontrolled inputs re-keyed on the server's value, the same shape
// SuperAdminCosts uses: the server is the authority, so a rejected save
// or a reload elsewhere on the screen snaps the field back rather than
// leaving a draft that disagrees with what the pool is actually doing.

import React, { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { flash } from "@/shared/lib/flash";
import { saveSettings, type PoolSettings } from "../api";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function PoolSettingsForm({
  settings,
  onSaved,
}: {
  settings: PoolSettings;
  onSaved: (s: PoolSettings) => void;
}) {
  const [busy, setBusy] = useState<keyof PoolSettings | null>(null);

  const commit = async (field: keyof PoolSettings, raw: string, lo: number, hi: number) => {
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed)) { onSaved({ ...settings }); return; }
    const n = clamp(parsed, lo, hi);
    if (n === settings[field]) return;
    setBusy(field);
    try {
      const next = await saveSettings({ [field]: n } as Partial<PoolSettings>);
      onSaved(next);
    } catch (e: any) {
      flash(e?.message || "Could not save that setting.");
      // Re-key the field off the unchanged value so it drops the
      // rejected number instead of displaying one the pool never took.
      onSaved({ ...settings });
    } finally {
      setBusy(null);
    }
  };

  const field =
    "w-20 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-base " +
    "font-serif outline-none focus:border-ink disabled:opacity-50";

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5 mb-4">
        <span className="w-6 h-px bg-accent" /> <SlidersHorizontal size={12} /> Settings
      </p>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink">
            Floor
            <span className="block text-[12px] text-muted">Removal cannot cross it</span>
          </span>
          <input
            type="number"
            min={0}
            max={50}
            key={`floor-${settings.min_active_keys}`}
            defaultValue={settings.min_active_keys}
            disabled={busy === "min_active_keys"}
            onBlur={(e) => commit("min_active_keys", e.target.value, 0, 50)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className={field}
          />
        </label>

        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink">
            Rest
            <span className="block text-[12px] text-muted">Minutes a spent key waits</span>
          </span>
          <input
            type="number"
            min={5}
            max={2880}
            step={5}
            key={`cooldown-${settings.cooldown_minutes}`}
            defaultValue={settings.cooldown_minutes}
            disabled={busy === "cooldown_minutes"}
            onBlur={(e) => commit("cooldown_minutes", e.target.value, 5, 2880)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className={field}
          />
        </label>
      </div>

      <p className="text-[12px] text-muted mt-4 leading-relaxed">
        Read on every rotation, so a change takes effect at once. Raise the floor as the pool
        grows — it ships at 1, which is right for a pool of one and far too low for twenty.
      </p>
    </div>
  );
}
