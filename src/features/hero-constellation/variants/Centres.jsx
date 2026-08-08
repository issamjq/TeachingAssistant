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

// ── ribbon ───────────────────────────────────────────────────────────
// One sine across the box. The SAME sine the layout samples to place the
// modules, written in a stretched viewBox so both agree at any width —
// a ribbon whose modules sit near it rather than on it is just a stray
// line through the composition.
//
// The line is not decoration, it is a conveyor: it draws itself in on
// load, then a bead of light runs it end to end forever, and each module
// lights as the bead reaches it (the glow's delay comes from the same
// arc-length position the layout computes — see pulseAt).
//
// pathLength="1" is what makes that affordable. It renormalises the
// path's length to 1, so the dash pattern and the offset can be written
// as plain fractions instead of being measured with getTotalLength() on
// every resize.
function Ribbon({ isRTL, w = 1240, h = 170 }) {
  // The viewBox is the box's REAL pixel size, and the sine is plotted in
  // those same pixels. That is load-bearing, not tidiness.
  //
  // The first version drew into a square 0 0 100 100 and let
  // preserveAspectRatio="none" stretch it — x by about twelve, y by
  // under two. Dash lengths and pathLength are measured in USER space, so
  // a dash pattern that looked even in the square came out wildly uneven
  // once stretched: the draw-on arrived in disconnected patches and never
  // closed up, and the bead's position along the path had no fixed
  // relation to where it appeared on screen — which would have silently
  // desynced it from the module glows, whose delays the layout computes
  // in screen pixels.
  //
  // At 1:1 there is no distortion, so user space, screen space and the
  // layout's arithmetic are all the same space.
  const amp = h / 2.24;
  const pts = Array.from({ length: 241 }, (_, i) => {
    const u = i / 240;
    return `${(u * w).toFixed(2)},${(h / 2 - Math.sin(u * Math.PI * 2) * amp).toFixed(2)}`;
  }).join(" ");
  const line = { points: pts, pathLength: 1 };
  return (
    <div className={cx.ribbon} aria-hidden="true">
      {/* RTL mirrors the modules' x, so the drawn wave has to mirror with
          them or its crests land under the wrong ones — and the bead then
          runs right-to-left, which is also the reading direction. */}
      <svg
        className={cx.rbSvg}
        viewBox={`0 0 ${w} ${h}`}
        style={isRTL ? { transform: "scaleX(-1)" } : undefined}
      >
        <polyline className={cx.rbGlow} {...line} />
        <polyline className={cx.rbLine} {...line} />
        <polyline className={cx.rbBead} {...line} />
      </svg>
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
      {/* The sweep: a soft beam crossing the arc, on the same run the
          modules' glows are, so each lights as the beam reaches it. */}
      <span className={cx.apSweep} />
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
        {/* Light falling from the apex down both jambs. The path runs
            foot → apex → foot, so ONE travelling dash descends both
            sides at once, mirrored — which is what the architecture
            asks for; a light running down one side and then the other
            would fight its symmetry. */}
        <path className={cx.archFall} d={archPath(0)} pathLength={1} vectorEffect="non-scaling-stroke" />
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
        {/* A bead running the rosette's outer circle, passing each of the
            eight points in turn. Rotating the whole star instead would
            have been cheaper and wrong: a khatim's orientation IS the
            shape. */}
        <circle className={cx.khBead} cx="50" cy="50" r="50" pathLength={1} />
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
export default function Centre({ kind, compact, isRTL, t, arch, size }) {
  switch (kind) {
    case "ribbon":
      return <Ribbon isRTL={isRTL} w={size?.w} h={size?.h} />;
    case "aperture":
      return <Aperture />;
    case "signal":
      return <Signal />;
    case "mihrab":
      return <Mihrab />;
    case "khatim":
      return <Khatim arch={arch} />;
    case "bureau":
      // The same studio window, laid back in perspective. The tilt is a
      // wrapper rather than a prop so StudioStage stays a flat surface
      // with no opinion about how it is presented.
      return (
        <div className={cx.bureau}>
          <StudioStage compact={compact} />
          {/* A lamp crossing the desk, in step with the objects' glows. */}
          <span className={cx.bureauSweep} />
        </div>
      );
    default:
      return <StudioStage compact={compact} />;
  }
}
