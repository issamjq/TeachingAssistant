"use client";

// =====================================================================
// Hero constellation — the studio stage
//
// The single object the opening frame is built around.
//
// This was a drawn scene — a line-art teacher at a desk with an AI
// screen behind her. It did not survive being next to the rest of the
// page. Every other surface on this landing is REAL product UI rendered
// in live type (the card faces, the walkthrough deck, the contents
// index), and an illustrated figure sitting among them read as clip art
// no matter how carefully it was drawn. Illustration appears nowhere
// else in Murchid; introducing it here was the mistake, not the
// execution.
//
// So the centre is the studio itself: a window frame, the module rail,
// a lesson being drafted, the outputs it produced. Same material as the
// cards the tiles are about to become, which is what makes the opening
// frame belong to the same page as the two acts after it.
//
// Fixed design size, scaled by the caller — so the type inside stays in
// proportion at every viewport instead of reflowing into a different
// composition. Purely decorative: the eight modules are named by the
// tiles around it and by the contents index, so nothing here is content
// a reader needs, and the whole block is hidden from assistive tech.
// =====================================================================

import st from "./StudioStage.module.css";

/** Design size. The caller scales the whole block by STAGE_W. */
export const STAGE_W = 520;
export const STAGE_H = 300;

const RAIL = [
  "AI Studio",
  "Goal Planner",
  "Teaching Profile",
  "Subjects",
  "Proctoring",
  "Dashboard",
  "Scheduling",
  "Assistant",
];

/** The three things one prompt hands back. */
const OUTPUTS = [
  { name: "Lesson", meta: "6 parts" },
  { name: "Quiz", meta: "12 Q" },
  { name: "Deck", meta: "18 slides" },
];

/**
 * @param compact Portrait crop. A phone renders this block at ~0.7 scale,
 *   where the rail's 10px labels and the outputs' 7.5px meta land under
 *   5px — texture pretending to be text. The crop drops both and sizes up
 *   what remains, so every element left on screen is one a reader can
 *   actually make out.
 */
export default function StudioStage({ compact = false }) {
  return (
    <div className={`${st.frame} ${compact ? st.compact : ""}`} aria-hidden="true">
      <div className={st.bar}>
        <span className={st.dot} />
        <span className={st.dot} />
        <span className={st.dot} />
        <span className={st.barTitle}>Murchid — Studio</span>
        <span className={st.barLive}>Drafting</span>
      </div>

      <div className={st.body}>
        <aside className={st.rail}>
          {RAIL.map((r, i) => (
            <div key={r} className={`${st.railItem} ${i === 0 ? st.railActive : ""}`}>
              <span className={st.railTag} />
              {r}
            </div>
          ))}
        </aside>

        <div className={st.main}>
          <div className={st.eyebrow}>AI Studio</div>
          <div className={st.title}>Make the material</div>

          {/* The teacher's own words — the input half of the product. */}
          <div className={st.prompt}>
            A Grade 9 physics lesson on the second law
            <span className={st.caret} />
          </div>

          {/* …and what comes back. */}
          <div className={st.outputs}>
            {OUTPUTS.map((o) => (
              <div key={o.name} className={st.output}>
                <div className={st.outputName}>{o.name}</div>
                <div className={st.outputMeta}>{o.meta}</div>
                <div className={st.outputLines}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>

          <div className={st.foot}>
            <span className={st.footCheck} />
            Ready to hand out · English and Arabic
          </div>
        </div>
      </div>

      {/* The light the stage sits in, and its reflection on the floor.
          Both are the frame's own children so they scale with it. */}
      <span className={st.glow} />
      <span className={st.reflection} />
    </div>
  );
}
