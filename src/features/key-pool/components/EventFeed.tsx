"use client";

// The trail. It answers "why is the pool smaller than it was on
// Tuesday" six weeks later, which is why it outlives the keys it names.

import React from "react";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PoolEvent } from "../api";

// Colour carries meaning here, so it is spent sparingly. `refused` is
// the loud one: the key is failing, the service knows, and it is still
// in rotation because taking it out would leave nothing to dial.
const TONE: Record<string, string> = {
  refused: "text-crit",
  probation: "text-crit",
  removed: "text-crit",
  cooled: "text-warn",
  transient: "text-muted",
  added: "text-sage",
  probed_ok: "text-sage",
  reenabled: "text-sage",
  seeded: "text-sage",
  disabled: "text-muted",
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function EventFeed({ events }: { events: PoolEvent[] }) {
  const rows = events.slice(0, 50);

  return (
    <Card>
      <CardContent>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2.5 mb-4">
          <span className="w-6 h-px bg-accent" /> <History size={12} /> Trail
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">Nothing has happened to the pool yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {rows.map((e, i) => (
              <li key={`${e.created_at}-${e.label}-${i}`} className="py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted w-28 shrink-0">
                  {when(e.created_at)}
                </span>
                <span className="font-mono text-[12px] text-ink w-32 shrink-0">{e.label}</span>
                <span className={`font-mono text-[10px] uppercase tracking-wider ${TONE[e.event] || "text-muted"}`}>
                  {e.event.replace(/_/g, " ")}
                </span>
                {e.detail && <span className="text-[13px] text-muted">{e.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
