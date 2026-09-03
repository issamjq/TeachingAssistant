"use client";

// The keys, and the three controls a pool of forty needs that a pool of
// one does not: search, a state filter, and sort.
//
// All three are client-side. The whole pool arrives in one GET — it is
// tens of rows, not thousands — so paging it over the network would add
// a round trip per keystroke to answer a question the browser already
// holds the data for.

import React, { useMemo, useState } from "react";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, Power, PowerOff, Search,
  Sunrise, Trash2, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { keyState, STATE_LABEL, type KeyState, type PoolKey } from "../api";

// Resting is the most common state in a healthy pool, so it is not an
// alarm colour. Only a refused credential and a switched-off key are
// worth a reader's attention.
const STATE_CHIP: Record<KeyState, string> = {
  in_use: "border-sage text-sage bg-paper",
  resting: "border-line text-muted bg-paper",
  refused: "border-crit text-crit bg-paper",
  off: "border-line text-muted bg-paper-warm",
};

// Sorting by state sorts by how much it wants attention, not
// alphabetically: "Off, In use, Refused, Resting" is the alphabetical
// answer and it is useless.
const STATE_RANK: Record<KeyState, number> = { refused: 0, in_use: 1, resting: 2, off: 3 };

const STATES: KeyState[] = ["in_use", "resting", "refused", "off"];

type SortKey = "label" | "state" | "last_ok" | "added";
type Dir = "asc" | "desc";

// Labels are `openrouter-<n>`, so a plain string compare files
// openrouter-10 before openrouter-2 and the list stops being readable at
// exactly the size where sorting starts to matter.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const time = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

const shortTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";

export interface KeysTableProps {
  keys: PoolKey[];
  /** The clock cooldowns are measured against — see KeyPoolRoute. */
  now: number;
  loading: boolean;
  busyId: number | null;
  onPatch: (id: number, body: { status?: PoolKey["status"]; clear_cooldown?: boolean }) => void;
  onRemove: (id: number) => void;
}

export default function KeysTable({
  keys, now, loading, busyId, onPatch, onRemove,
}: KeysTableProps) {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<KeyState | null>(null);
  const [sort, setSort] = useState<SortKey>("label");
  const [dir, setDir] = useState<Dir>("asc");
  const [confirming, setConfirming] = useState<number | null>(null);

  // Search first, so the filter chips count within what was searched: a
  // chip reading "Refused 0" while a query is typed is the useful
  // answer — none of your matches are refused — and a chip counting the
  // whole pool would contradict the table beneath it.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) =>
      [k.label, k.masked, k.note, k.provider]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [keys, query]);

  const counts = useMemo(() => {
    const c: Record<KeyState, number> = { in_use: 0, resting: 0, refused: 0, off: 0 };
    for (const k of searched) c[keyState(k, now)] += 1;
    return c;
  }, [searched, now]);

  const rows = useMemo(() => {
    const list = only ? searched.filter((k) => keyState(k, now) === only) : [...searched];
    const sign = dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      switch (sort) {
        case "state":
          return (STATE_RANK[keyState(a, now)] - STATE_RANK[keyState(b, now)]) * sign
            || collator.compare(a.label, b.label);
        case "added":
          return (time(a.added_at) - time(b.added_at)) * sign;
        case "last_ok": {
          // "Never succeeded" is not a date. Sorting it as one would put
          // a key added a minute ago and not yet dialled at the top of a
          // list about recency, so it sinks in both directions instead.
          const x = time(a.last_ok_at), y = time(b.last_ok_at);
          if (Number.isNaN(x) && Number.isNaN(y)) return collator.compare(a.label, b.label);
          if (Number.isNaN(x)) return 1;
          if (Number.isNaN(y)) return -1;
          return (x - y) * sign;
        }
        default:
          return collator.compare(a.label, b.label) * sign;
      }
    });
  }, [searched, only, sort, dir, now]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) { setDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSort(k);
    // Dates read newest-first; names read A–Z. Defaulting both to "asc"
    // means every date column opens on its least interesting end.
    setDir(k === "added" || k === "last_ok" ? "desc" : "asc");
  };

  const filtered = !!query.trim() || !!only;
  const clear = () => { setQuery(""); setOnly(null); };

  return (
    <Card className="mb-5">
      <CardContent className="p-0">
        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 border-b border-line">
          <label className="relative flex-1 min-w-[220px]">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search label, mask or note"
              aria-label="Search keys"
              className="w-full pl-8 pr-8 py-2 rounded-lg border border-line bg-paper text-ink
                         text-sm outline-none focus:border-ink placeholder:text-muted/70"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition"
              >
                <X size={13} />
              </button>
            )}
          </label>

          {/* The state counts live here rather than in a summary strip:
              on a chip the number is also the way to act on it. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              label="All"
              count={searched.length}
              active={only === null}
              onClick={() => setOnly(null)}
            />
            {STATES.map((s) => (
              <FilterChip
                key={s}
                label={STATE_LABEL[s]}
                count={counts[s]}
                active={only === s}
                tone={s === "refused" && counts[s] > 0 ? "crit" : "plain"}
                onClick={() => setOnly((cur) => (cur === s ? null : s))}
              />
            ))}
          </div>
        </div>

        {filtered && (
          <div className="px-5 py-2.5 border-b border-line/60 flex items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {rows.length} of {keys.length} {keys.length === 1 ? "key" : "keys"}
            </p>
            <button
              onClick={clear}
              className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition"
            >
              clear
            </button>
          </div>
        )}

        {/* ── The table ───────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                <SortableTh label="Key" col="label" sort={sort} dir={dir} onSort={toggleSort} className="px-5" />
                <SortableTh label="State" col="state" sort={sort} dir={dir} onSort={toggleSort} />
                <SortableTh label="Last success" col="last_ok" sort={sort} dir={dir} onSort={toggleSort} />
                <SortableTh label="Added" col="added" sort={sort} dir={dir} onSort={toggleSort} />
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-line/60 last:border-0">
                    <td className="py-3 px-5"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="py-3"><Skeleton className="h-3 w-16" /></td>
                    <td className="py-3"><Skeleton className="h-3 w-16" /></td>
                    <td className="py-3 px-5"><Skeleton className="h-7 w-24 rounded-md" /></td>
                  </tr>
                ))}

              {rows.map((k) => {
                const state = keyState(k, now);
                const working = busyId === k.id;
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
                        <p className="text-[12px] text-muted mt-1">until {shortTime(k.cooldown_until)}</p>
                      )}
                      {state === "refused" && (
                        <p className="text-[12px] text-crit mt-1">needs a human</p>
                      )}
                    </td>

                    <td className="py-3 text-muted text-xs">
                      {shortDate(k.last_ok_at)}
                      {k.last_ok_at && <span className="block text-[11px]">{shortTime(k.last_ok_at)}</span>}
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
                            onClick={() => onPatch(k.id, { clear_cooldown: true })}
                          />
                        )}
                        {(state === "refused" || state === "off") && (
                          <RowAction
                            icon={<Power size={12} />}
                            label={state === "off" ? "Enable" : "Re-enable"}
                            title="Put it back in rotation — for a credential that has been fixed at the provider"
                            disabled={working}
                            onClick={() => onPatch(k.id, { status: "active", clear_cooldown: true })}
                          />
                        )}
                        {(state === "in_use" || state === "resting") && (
                          <RowAction
                            icon={<PowerOff size={12} />}
                            label="Disable"
                            title="Take it out of rotation without deleting it"
                            disabled={working}
                            onClick={() => onPatch(k.id, { status: "disabled" })}
                          />
                        )}

                        {/* Deleting a credential cannot be undone, so the
                            confirmation is in the row rather than in an OS
                            dialog that gets dismissed by reflex. */}
                        {confirming === k.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <RowAction
                              label="Remove for good"
                              tone="crit"
                              disabled={working}
                              onClick={() => { setConfirming(null); onRemove(k.id); }}
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

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    {keys.length === 0 ? (
                      "The pool is empty. Paste a key below to start it."
                    ) : (
                      <>
                        No keys match.{" "}
                        <button onClick={clear} className="text-accent hover:underline">
                          Clear the filters
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableTh({
  label, col, sort, dir, onSort, className = "",
}: {
  label: string;
  col: SortKey;
  sort: SortKey;
  dir: Dir;
  onSort: (c: SortKey) => void;
  className?: string;
}) {
  const active = sort === col;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th
      className={`text-left py-3 font-medium ${className}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.15em] transition
                    ${active ? "text-ink" : "hover:text-ink"}`}
      >
        {label}
        <Icon size={11} className={active ? "" : "opacity-40"} aria-hidden />
      </button>
    </th>
  );
}

function FilterChip({
  label, count, active, onClick, tone = "plain",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "plain" | "crit";
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        "font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-full border transition",
        "inline-flex items-center gap-1.5",
        // Filled, not merely outlined. The first pass tinted the
        // selected chip with bg-paper-warm, which on the card's own
        // surface is almost the same colour — so the one control saying
        // which slice of the pool you are looking at said nothing.
        active
          ? "border-ink bg-ink text-paper-cool"
          : tone === "crit"
            ? "border-crit/40 text-crit hover:border-crit"
            : "border-line text-muted hover:border-ink hover:text-ink",
      ].join(" ")}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
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
