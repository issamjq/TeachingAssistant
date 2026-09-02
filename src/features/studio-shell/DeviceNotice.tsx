"use client";

// =====================================================================
// "Why is everything empty?"
//
// The account stays active on one device at a time, and the database
// enforces it: every policy on the teacher's own data is ANDed with
// is_current_device(), which compares users.active_session_id against
// the session_id claim in the access token.
//
// The failure mode that produces is nasty, because a superseded device
// is not refused — it is answered. RLS filters rows out of a SELECT; the
// query succeeds and returns nothing. So the roster says "no students
// yet", the library says "nothing made", the graphs draw a flat line,
// and the teacher concludes the product lost their term's work. It is
// the most alarming possible way to say "you're signed in elsewhere".
//
// Worse, the two tables that ARE readable — subscriptions and credits —
// keep the plan tile working, so the dashboard looks half alive rather
// than obviously locked.
//
// What used to stand here was a 20-second poll of /api/auth/me waiting
// for a 401 that stopped existing when that endpoint became a Supabase
// read: /api/auth/me reads users, faculty, subscriptions and credits,
// none of which are device-gated, so it answered 200 forever and the
// enforcement it was guarding had no voice at all.
//
// This asks the question directly instead, and says the answer out loud.
// =====================================================================
import React, { useCallback, useEffect, useState } from "react";
import { MonitorSmartphone, LogOut, RefreshCw } from "lucide-react";
import { claimDevice, deviceState } from "@/lib/data/device";

/**
 * How often to re-check while the tab is open.
 *
 * 5s, down from 20s: the scary case is a laptop sitting OPEN while the
 * phone signs in — its screens re-fetch and drain to "no students yet"
 * with no explanation until this poll notices. Twenty seconds of
 * apparently-lost term work is how a teacher stops trusting the
 * product; the check is one tiny read, so ask often. Focus and
 * visibility changes still check immediately.
 */
const EVERY_MS = 5000;

export default function DeviceNotice({ onSignOut }: { onSignOut: () => void }) {
  const [superseded, setSuperseded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = useCallback(async () => {
    try {
      const s = await deviceState();
      // Only "superseded" is actionable. "unknown" means the question
      // could not be asked — a network blip should not throw a lock
      // screen over a working session.
      setSuperseded(s.state === "superseded");
    } catch {
      /* leave the last known answer standing */
    }
  }, []);

  useEffect(() => {
    let live = true;
    const run = () => { if (live) void check(); };

    run();
    const id = setInterval(run, EVERY_MS);
    // Coming back to a tab is exactly when supersession has usually
    // happened — the other device was used while this one sat idle.
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  if (!superseded) return null;

  /**
   * Take the account back on this device.
   *
   * A full reload rather than a refetch: every screen already mounted
   * holds empty data it fetched while locked out, and re-running the
   * whole tree is both simpler and more certain than trying to invalidate
   * each of them.
   */
  const useThisDevice = async () => {
    setClaiming(true);
    setFailed(false);
    const claimed = await claimDevice();
    if (!claimed) {
      setClaiming(false);
      setFailed(true);
      return;
    }
    window.location.reload();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="device-notice-title"
      className="fixed inset-0 z-[2147483000] grid place-items-center p-5"
      style={{ background: "color-mix(in oklab, var(--p-ink) 55%, transparent)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 shadow-2xl">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent-soft text-accent">
          <MonitorSmartphone size={20} />
        </span>

        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted mt-5">
          Signed in elsewhere
        </p>
        <h2 id="device-notice-title" className="font-serif text-[26px] leading-tight text-ink mt-1.5">
          You&rsquo;re using Murchid on{" "}
          <em className="italic text-accent">another device.</em>
        </h2>
        <p className="text-[13.5px] leading-relaxed text-ink-soft mt-3">
          Your account stays active on one device at a time, so this one has
          stopped showing your work. Nothing has been lost &mdash; your
          students, lessons and library are all exactly where you left them.
        </p>

        {failed && (
          <p className="text-[13px] text-crit mt-4">
            That didn&rsquo;t work. Check your connection and try again, or sign
            in once more.
          </p>
        )}

        <div className="flex flex-wrap gap-2.5 mt-6">
          <button
            type="button"
            onClick={useThisDevice}
            disabled={claiming}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper-cool cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={15} className={claiming ? "animate-spin" : undefined} />
            {claiming ? "Switching over…" : "Use this device instead"}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[13.5px] text-ink-soft hover:border-ink cursor-pointer"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>

        <p className="text-[11.5px] text-muted mt-4">
          Continuing here will sign the other device out.
        </p>
      </div>
    </div>
  );
}
