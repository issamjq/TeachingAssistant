import type { Metadata, Viewport } from "next";
import "./globals.css";

// Root layout — replaces index.html.
//
// This is a SERVER component and must stay one. Every client-side concern
// (LanguageProvider, auth, the accessibility widget) lives below it, inside
// the client boundary declared in app/[[...slug]]/page.tsx. Keeping the root
// on the server is what makes per-route server rendering possible later
// without re-plumbing the tree — see docs/11-nextjs-migration.md §4.4.
//
// Fonts are still loaded via the Google Fonts <link>, carried over verbatim
// from index.html. The app pulls 25 families (the SlideBuilder theme picker
// offers them as deck typefaces), so next/font would mean 25 self-hosted
// loaders and a much slower build. Phase 1's contract is zero visual change,
// so this stays as-is; narrowing it to the families actually used at runtime
// is a Phase 5 performance item.

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400&family=Inter+Tight:wght@400;500;600;700&family=Amiri:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,600;0,800;1,400&family=Lora:ital,wght@0,400;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Manrope:wght@400;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;700&family=DM+Sans:ital,wght@0,400;0,600;1,400&family=Outfit:wght@400;600;700&family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&family=Shrikhand&family=Pacifico&family=Caveat:wght@400;600&family=Dancing+Script:wght@400;600&family=Cairo:wght@400;600;700&family=Reem+Kufi:wght@400;600&display=swap";


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
    <html lang="en" dir="ltr" data-palette="firozeh">
      <head>
        <script
          // Must run before the stylesheet paints, so it goes first in head.
          dangerouslySetInnerHTML={{ __html: PALETTE_BOOTSTRAP }}
        />
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
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
