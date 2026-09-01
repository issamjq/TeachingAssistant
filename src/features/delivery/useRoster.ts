"use client";

// The teacher's roster, shared by every audience preview.
//
// Delivery previews appear in the schedule modal, the studio's finalise
// step, and the quiz/homework builders — often two of them mounted at
// once. One in-flight request serves them all; a short TTL keeps a
// just-added student from being invisible to the preview for long,
// without turning every keystroke in a form into a fetch.

import { useEffect, useState } from "react";
import { api } from "@/shared/lib/apiClient";
import type { RosterStudent } from "@/shared/lib/classMatch";

const TTL_MS = 60_000;

let cached: { at: number; promise: Promise<RosterStudent[]> } | null = null;

function fetchRoster(): Promise<RosterStudent[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = api<RosterStudent[]>("/api/students").then(
    (rows) => (Array.isArray(rows) ? rows : []),
    () => {
      // A failed load must not be cached as "no students" for a minute.
      cached = null;
      return [];
    },
  );
  cached = { at: now, promise };
  return promise;
}

/**
 * The roster, or [] while loading. `ready` separates "no students" from
 * "not loaded yet" so a preview never says "reaches nobody" about a
 * roster it has not seen.
 */
export function useRoster(): { roster: RosterStudent[]; ready: boolean } {
  const [state, setState] = useState<{ roster: RosterStudent[]; ready: boolean }>({
    roster: [],
    ready: false,
  });
  useEffect(() => {
    let live = true;
    fetchRoster().then((roster) => {
      if (live) setState({ roster, ready: true });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
