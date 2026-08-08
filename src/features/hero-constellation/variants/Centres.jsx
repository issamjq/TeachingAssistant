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
import { archPath } from "./arch";
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
// A monumental pointed arch. The masthead stands inside it — that is the
// point of the variant — so nothing is set within the arch here; it is
// the frame, and the frame stays empty.
//
// Two arches, one inside the other, and a pool of light at the foot so it
// stands on something. The path comes from arch.js, which also places the
// niches, so the drawn line and the modules on it cannot drift apart.
function Mihrab() {
  return (
    <div className={cx.mihrab} aria-hidden="true">
      <svg className={cx.archSvg} viewBox="0 0 100 160" preserveAspectRatio="none">
        <path className={cx.archLine} d={archPath(0)} vectorEffect="non-scaling-stroke" />
        <path className={cx.archLineIn} d={archPath(9)} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className={cx.archPool} />
    </div>
  );
}

// ── colonnade ────────────────────────────────────────────────────────
// An arcade of `bays` slender arches, one per module. Drawn as one SVG
// with a repeated path rather than as N elements, so the bays share a
// single stroke width and cannot end up a hair apart from each other.
function Colonnade({ bays = 8 }) {
  const W = 100 * bays;
  return (
    <div className={cx.colonnade} aria-hidden="true">
      <svg className={cx.archSvg} viewBox={`0 0 ${W} 168`} preserveAspectRatio="none">
        {Array.from({ length: bays }, (_, i) => (
          <g key={i} transform={`translate(${i * 100} 0)`}>
            <path className={cx.archLine} d={archPath(6)} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {/* The base the arcade stands on — without it the bays read as
            eight loose shapes rather than as one building. */}
        <line
          className={cx.archLine}
          x1="0" y1="161" x2={W} y2="161"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className={cx.archPool} />
    </div>
  );
}

// ── khatim ───────────────────────────────────────────────────────────
// The eight-pointed star, inside its arch. Two squares at 45° to each
// other — which is how the khatim is actually constructed — plus the
// rosette's radii running out to the eight points the modules stand on.
//
// Struck geometrically rather than drawn as ornament: the star has to
// hold a masthead in its middle without competing with it.
function Khatim({ arch }) {
  const R = 50;
  // Two squares at 45° to each other, both offset by 22.5° so the eight
  // resulting points fall exactly where the layout stands the modules —
  // and none of them on the vertical axis, where the masthead is.
  const pts = (rot) =>
    [0, 1, 2, 3]
      .map((i) => {
        const a = ((i * 90 + rot) * Math.PI) / 180;
        return `${(50 + Math.cos(a) * R).toFixed(2)},${(50 + Math.sin(a) * R).toFixed(2)}`;
      })
      .join(" ");
  return (
    <div className={cx.khatim} aria-hidden="true">
      {arch && (
        <svg
          className={cx.khArch}
          viewBox="0 0 100 160"
          preserveAspectRatio="none"
          style={{
            width: arch.w,
            height: arch.h,
            insetBlockStart: arch.top,
          }}
        >
          <path className={cx.archLine} d={archPath(0)} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <svg className={cx.khStar} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon className={cx.khLine} points={pts(22.5)} />
        <polygon className={cx.khLine} points={pts(67.5)} />
        <circle className={cx.khLineSoft} cx="50" cy="50" r="50" />
        <circle className={cx.khLineSoft} cx="50" cy="50" r="33" />
      </svg>
      <span className={cx.archPool} />
    </div>
  );
}

/**
 * Dispatch. `kind` comes from the variant's layout; anything unknown
 * (including undefined) falls back to the studio window, which is the
 * centre most variants want.
 */
export default function Centre({ kind, compact, isRTL, t, bays, arch }) {
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
      return <Mihrab />;
    case "colonnade":
      return <Colonnade bays={bays} />;
    case "khatim":
      return <Khatim arch={arch} />;
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
