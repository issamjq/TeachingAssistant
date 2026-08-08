"use client";

// =====================================================================
// Stage-one variants — the centre pieces
//
// What sits behind the eight sources while they rest. One component per
// `kind`, dispatched by Centre below; a variant with no centre passes
// none and nothing renders.
//
// House rule, learned the hard way: NOTHING here is illustrated. The
// first cut of this hero drew a teacher at a desk, and next to the real
// product surfaces in the two acts that follow it read as clip art —
// illustration appears nowhere else in Murchid. So every centre is
// either real product UI in live type, or pure geometry (an arc, a
// ring, a rule). Both are materials this page already uses.
//
// Each centre is drawn at a fixed DESIGN size and scaled as one block by
// its caller, so type inside keeps its proportions at every viewport
// instead of reflowing into a different composition.
// =====================================================================

import StudioStage from "../StudioStage";
import cx from "./Centres.module.css";

/** Design size of the specimen plate used by the cover variant. */
const SPEC_W = 300;
const SPEC_H = 400;

// ── specimen ─────────────────────────────────────────────────────────
// A single tall plate, set like the cover of an issue. Same dark glass
// as the card faces, but portrait and given over almost entirely to
// type — a cover sells the publication, not the contents.
function Specimen({ t }) {
  return (
    <div className={cx.spec} aria-hidden="true">
      <div className={cx.specTop}>
        <span className={cx.specIssue}>No. 01</span>
        <span className={cx.specRule} />
        <span className={cx.specIssue}>KG–G12</span>
      </div>
      <div className={cx.specBody}>
        <div className={cx.specEyebrow}>{t("atl.art.studio")}</div>
        <div className={cx.specTitle}>
          Make the <em>material</em>
        </div>
        <div className={cx.specPrompt}>
          A Grade 9 physics lesson on the second law
          <span className={cx.specCaret} />
        </div>
        <div className={cx.specLines}>
          <span /><span /><span /><span /><span />
        </div>
      </div>
      <div className={cx.specFoot}>Lesson · Quiz · Deck · Homework</div>
      <span className={cx.specGlow} />
    </div>
  );
}

// ── aperture ─────────────────────────────────────────────────────────
// A shallow arc of light with the horizon it stands on. Geometry only:
// two ellipses and a rule, so it scales to any size without any of the
// resolution or taste problems a drawn scene brings.
function Aperture() {
  return (
    <div className={cx.aperture} aria-hidden="true">
      <span className={cx.apRing} />
      <span className={cx.apRingInner} />
      <span className={cx.apPool} />
      <span className={cx.apHorizon} />
    </div>
  );
}

// ── orbit ────────────────────────────────────────────────────────────
// Two concentric ellipses. The outer is the one the modules stand on, so
// it is drawn a shade stronger than the inner — the ring should read as
// a track, not as a decoration the tiles happen to sit near.
function Orbit() {
  return (
    <div className={cx.orbit} aria-hidden="true">
      <span className={cx.orbRing} />
      <span className={cx.orbRingInner} />
      <span className={cx.orbCore} />
    </div>
  );
}

// ── signal ───────────────────────────────────────────────────────────
// One luminous rule across the frame, brightest in the middle and
// falling off to nothing at both ends so it never collides with the edge
// of the pin.
function Signal() {
  return (
    <div className={cx.signal} aria-hidden="true">
      <span className={cx.sigLine} />
      <span className={cx.sigPulse} />
    </div>
  );
}

// ── mihrab ───────────────────────────────────────────────────────────
// A pointed arch, struck as geometry rather than drawn: a rectangle
// whose top two corners are rounded to meet at a point, inset by a
// second, and مرشد set inside it. The one centre that draws on where
// this product is — and it stays architecture precisely because nothing
// about it is illustrated.
function Mihrab({ isRTL }) {
  return (
    <div className={cx.mihrab} aria-hidden="true">
      {/* Drawn as a path, not with border-radius. Rounded corners give a
          DOME — the two curves meet tangentially at the top — and the
          whole point of this shape is that they meet at a point. Two
          quadratics sharing an apex are the only way to get it. */}
      <svg className={cx.mihSvg} viewBox="0 0 100 160" preserveAspectRatio="none">
        <path
          className={cx.mihLine}
          d="M2 160 L2 86 Q2 20 50 2 Q98 20 98 86 L98 160"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={cx.mihLineIn}
          d="M11 160 L11 88 Q11 32 50 15 Q89 32 89 88 L89 160"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className={cx.mihWord}>{isRTL ? "Murchid" : "مرشد"}</span>
      <span className={cx.mihPool} />
    </div>
  );
}

/**
 * Dispatch. `kind` comes from the variant's layout; anything unknown
 * (including undefined) falls back to the studio window, which is the
 * centre most variants want.
 */
export default function Centre({ kind, compact, isRTL, t }) {
  switch (kind) {
    case "specimen":
      return <Specimen t={t} />;
    case "aperture":
      return <Aperture />;
    case "orbit":
      return <Orbit />;
    case "signal":
      return <Signal />;
    case "mihrab":
      return <Mihrab isRTL={isRTL} />;
    case "bureau":
      // The same studio window, laid back in perspective. The tilt is a
      // wrapper rather than a prop so StudioStage stays a flat surface
      // with no opinion about how it is presented.
      return (
        <div className={cx.bureau}>
          <StudioStage compact={compact} />
        </div>
      );
    default:
      return <StudioStage compact={compact} />;
  }
}

export { SPEC_H, SPEC_W };
