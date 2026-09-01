"use client";

// The one fact a list row was hiding: does the class get this or not?
//
// A quiz row proudly shows its own `scheduled_for` date, but that field
// delivers nothing — delivery is a schedule entry carrying the row
// (db/tune.sql §48). The chip reads the timetable and says which state
// the row is really in, so "Saved" can never again mean "invisible to
// every student" without saying so.

import { useEffect, useState } from "react";
import { CalendarCheck2, EyeOff } from "lucide-react";
import { api } from "@/shared/lib/apiClient";

interface EntryLite {
  id: string;
  draft_id: string | null;
  date: string;
  status: string | null;
}

let cache: { at: number; promise: Promise<EntryLite[]> } | null = null;
const TTL_MS = 60_000;

function fetchEntries(): Promise<EntryLite[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.promise;
  const promise = api<EntryLite[]>("/api/schedule").then(
    (rows) => (Array.isArray(rows) ? rows : []),
    () => {
      cache = null;
      return [];
    },
  );
  cache = { at: now, promise };
  return promise;
}

/**
 * Map of draft_id → its timetable entries (cancelled ones excluded).
 * `null` while loading, so a list can render nothing rather than a wrong
 * "not visible" that flickers to "on timetable".
 */
export function useDeliveryMap(): Map<string, EntryLite[]> | null {
  const [map, setMap] = useState<Map<string, EntryLite[]> | null>(null);
  useEffect(() => {
    let live = true;
    fetchEntries().then((rows) => {
      if (!live) return;
      const next = new Map<string, EntryLite[]>();
      for (const e of rows) {
        if (!e.draft_id || e.status === "cancelled") continue;
        const key = String(e.draft_id);
        const list = next.get(key);
        if (list) list.push(e);
        else next.set(key, [e]);
      }
      setMap(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return map;
}

const short = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function DeliveryChip({
  entries,
  className = "",
}: {
  /** This row's timetable entries from useDeliveryMap (undefined = none). */
  entries: EntryLite[] | undefined;
  className?: string;
}) {
  if (!entries?.length) {
    return (
      <span
        className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-line text-warn inline-flex items-center gap-1 ${className}`}
        title="Students receive work only through a timetable slot — this has none yet."
      >
        <EyeOff size={10} aria-hidden /> Not visible to students
      </span>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...entries].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const shown = upcoming[0] ?? [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]!;
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-line text-ok inline-flex items-center gap-1 ${className}`}
      title="On the timetable — students in the matching class receive it."
    >
      <CalendarCheck2 size={10} aria-hidden /> On timetable · {short(shown.date)}
    </span>
  );
}
