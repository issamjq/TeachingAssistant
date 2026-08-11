import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeSync from "@/shared/theme/ThemeSync";
// Root layout — replaces index.html.
//
// This is a SERVER component and must stay one. Every client-side concern
// (LanguageProvider, auth, the accessibility widget) lives below it, inside
// the client boundary declared in app/[[...slug]]/page.tsx. Keeping the root
// on the server is what makes per-route server rendering possible later
// without re-plumbing the tree — see docs/11-nextjs-migration.md §4.4.
//
// Fonts load in THREE requests, not one, because they have three different
// audiences. The single 23-family <link> this replaced cost 526KB and
// 113.7KB of render-blocking CSS on every page — measured at 280-370ms of
// FCP on localhost, where nothing else has any latency at all. Nineteen of
// those families were referenced nowhere outside the SlideBuilder's theme
// picker, and Amiri alone (208KB, 40% of all font bytes) downloaded on the
// English page to set two runs of Arabic.
//
//   1. CORE, below — every page needs these.
//   2. ARABIC — injected by LanguageProvider only when Arabic is selected.
//      See src/shared/i18n/index.tsx.
//   3. DECK — the 19 presentation typefaces, injected by the SlideBuilder
//      when it mounts. See src/features/presentations/DeckFonts.tsx.
//
// Fraunces is requested as a true variable range (`wght@300..900`) rather
// than the six discrete instances it used to list. Google serves discrete
// `font-weight: 400` faces for an enumerated list and a single
// `font-weight: 300 900` face for a range — only the latter can be
// interpolated, which the studio's scroll-linked weight animation needs.
// Rendering at any fixed weight is unchanged.
//
// Archivo was dropped when the marketing page was rebuilt on the product's
// own material: the site now uses the same Fraunces + Inter Tight pairing
// the studio ships, so a third family was bytes nobody rendered.

// Reem Kufi is in the core set despite being an Arabic face: the Murchid
// lockup carries مرشد in every language, so an English visitor still needs
// it. It is small. Amiri and Cairo — the faces that set running Arabic
// text — stay on the Arabic path.
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter+Tight:wght@400;500;600;700&family=Reem+Kufi:wght@400;600&display=swap";


// Runs BEFORE first paint, stamping the saved palette onto <html>.
//
// This has to be a blocking inline script, not an effect. The server cannot
// know a device preference, so it always renders the default; if the
// correction waited for React to hydrate, anyone on the alternate palette
// would see the default flash on every single page load. Keep it tiny and
// dependency-free — it is on the critical path for first paint.
//
// The storage key is duplicated from src/config/palette.ts on purpose: this
// string is inlined into the document head and cannot import a module.
const PALETTE_BOOTSTRAP = `
(function(){try{
  var p = localStorage.getItem("murchid.palette");
  document.documentElement.dataset.palette =
    (p === "firozeh" || p === "verdigris") ? p : "firozeh";
}catch(e){
  document.documentElement.dataset.palette = "firozeh";
}})();
`;


// Runs BEFORE first paint, stamping the theme onto <html>.
//
// LIGHT IS THE DEFAULT (owner decision, 2026-08-11): a first-time visitor
// sees the light page regardless of their device setting. Dark applies only
// when explicitly chosen, or when the visitor picked "Auto" and their
// device is dark. That is why there is no data-theme="light" state and no
// prefers-color-scheme CSS anywhere: the base tokens ARE light, and the
// only attribute that exists is data-theme="dark".
const THEME_BOOTSTRAP = `
(function(){try{
  var t = localStorage.getItem("murchid.theme");
  var dark = t === "dark" ||
    (t === "system" && window.matchMedia &&
     matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.dataset.theme = "dark";
}catch(e){}})();
`;

export const metadata: Metadata = {
  title: "Murchid — The lesson director",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // lang/dir are the server default; LanguageProvider rewrites both on the
    // client when the teacher switches to Arabic (see src/lib/i18n.jsx).
    // data-palette is set by PALETTE_BOOTSTRAP below before paint; the
    // attribute here is the server-render default so the markup is never
    // palette-less.
    // suppressHydrationWarning is load-bearing, not cosmetic: THEME_BOOTSTRAP
    // stamps data-theme onto <html> before paint, the server cannot know the
    // preference so it never renders that attribute, and React was therefore
    // REMOVING it during hydration. Measured: "dark" at commit, gone once
    // hydrated. data-palette survives only because it IS rendered below.
    <html
      lang="en"
      dir="ltr"
      data-palette="firozeh"
      suppressHydrationWarning
    >
      <head>
        <script
          // Must run before the stylesheet paints, so it goes first in head.
          dangerouslySetInnerHTML={{ __html: PALETTE_BOOTSTRAP }}
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link href={GOOGLE_FONTS_HREF} rel="stylesheet" />
      </head>
      {/* The #root wrapper reproduces the element index.html provided before
          the migration. It is NOT vestigial — it's a live styling contract:

            - globals.css targets `#root.a11y-zoom-on`, `.a11y-readable`,
              `.a11y-spaced`, the colour-blind filters, etc. The
              accessibility toolbar toggles those classes via
              document.getElementById("root").
            - The print/export stylesheet scopes `html, body, #root` when
              generating PDFs.

          Without it every accessibility control and the print path silently
          no-op: the toolbar still renders (it portals to <body>) but nothing
          it does has any effect. The toolbar deliberately sits OUTSIDE #root
          so the visual filters never apply to the toolbar itself. */}
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <div
          dangerouslySetInnerHTML={{
            __html: `<!--
MURCHID MARKETING DIRECTION CONTRACT — seed 0df4eaa5 (assigned index 4)
THESIS: The page teaches itself the way a classroom wall teaches photosynthesis —
one labelled diagram with numbered callouts. It refuses the category's scroll of
feature cards, and equally refuses cream-plus-editorial-serif, its predictable opposite.
OWN-WORLD: Saturated screenprint spot inks on chart stock — chart green #0E3B33,
screenprint ochre #E8A33D, diagram red #D6402C, chalk #F2EFE6, firozeh #16646C.
Heavy 3px keylines, numbered callout bubbles, dashed leader lines, laminate sheen.
Archivo for lettering; Reem Kufi and Cairo carry Arabic. No eyebrows anywhere.
STORY: A teacher sees a whole term's material — plans, notes, presentations, quizzes,
exams, homework, activities — produced from one spoken brief, believes it is ready to
teach, and starts the seven-day trial. (Revised 2026-08-11: the owner corrected the
mechanism mid-build. Dispatch to every division is real but a SMALL feature, and now
sits as a note beneath the outputs rather than owning a third of the diagram.)
FIRST VIEWPORT: Full-bleed chart on green stock. A prepared Grade 9 physics TERM held
at centre, laid out week by week; dashed leader lines out to every artefact the
assistant hands back; callouts 01-04 naming each real step. Primary action sits as the
chart's own printed plate, lower left.
FORM: The laminated classroom didactic chart; candidate 4 of 7 grounded directions,
chosen by the user over three challengers. Seed key 0df4eaa5.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, and DESIGN.md
-->`,
          }}
        />
        <ThemeSync />
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
