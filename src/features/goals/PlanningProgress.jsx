"use client";

// =====================================================================
// While a term is being planned
//
// Planning takes most of a minute and used to show a button reading
// "Planning…" and nothing else. A teacher watching that has no way to
// tell a working request from a dead one, and the honest fear — that it
// has hung — is why people press the button twice.
//
// The same answer the studio uses: the shape of what is coming. Weeks,
// with days inside them, greyed until they are real. It reads as a plan
// being written rather than as a spinner.
//
// No percentage, and not for want of trying. POST /api/studio/goal-plan
// does not stream — it thinks for as long as it needs and answers with
// the finished plan in one piece (the route says so). There is no signal
// between "sent" and "arrived" to measure, so a number here would be a
// function of elapsed time pretending to be a function of progress, and
// a bar that marches to 90% and sits there through a stall is worse than
// none: it turns a correct suspicion into misplaced confidence. The
// elapsed seconds are shown instead, which is true.
// =====================================================================
import { useEffect, useState } from "react";

import s from "./Goals.module.css";

export default function PlanningProgress({ weeks }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // The plan's real shape when she gave a timeline; a readable stand-in
  // when she did not. Capped so a full-year goal does not draw fifty rows.
  const rows = Math.min(weeks || 3, 4);

  return (
    <div className="mt-4 rounded-xl border border-line bg-paper p-4" role="status" aria-live="polite">
      <div className="flex items-baseline gap-2 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Writing the plan
        </p>
        <span className="font-mono text-[11px] text-muted tabular-nums ms-auto">
          {seconds}s
        </span>
      </div>

      <div className="flex flex-col gap-4" aria-hidden="true">
        {Array.from({ length: rows }, (_, w) => (
          <div key={w}>
            <span className={s.skelBlock} style={{ width: "22%", height: 9 }} />
            <span className={s.skelBlock} style={{ width: "64%", height: 12, marginTop: 8 }} />
            <div className="mt-2.5 ps-3 flex flex-col gap-1.5" style={{ borderInlineStart: "2px solid var(--p-line)" }}>
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className={s.skelBlock}
                  style={{ width: `${78 - d * 11}%`, height: 8 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-muted mt-4">
        It reads your material, decides what each day covers, then writes them
        out. Usually under a minute — you can leave this page and come back.
      </p>
    </div>
  );
}
