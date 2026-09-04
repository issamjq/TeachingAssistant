import type { NextConfig } from "next";

// Where the remaining /api/* calls go.
//
// Almost nothing uses this any more: the teacher's data comes from
// Supabase directly (see src/lib/data). What is left is the handful of
// endpoints that need a secret or a privilege the browser must never
// hold — AI generation, CV parsing, the auth bootstrap, and the
// privileged consoles — and those are served by a SEPARATE backend
// project. See todo/backend-requirements.md.
//
// No default. The old one pointed at localhost:3001 in dev and a Render
// URL in production, which meant that with no backend running the calls
// were proxied into a void and surfaced as an HTML error page rather
// than as anything a caller could read. With the variable unset there is
// no rewrite at all, so those paths 404 as themselves — which is the
// truth, and is what src/lib/data reports as a clear message.
const API_TARGET = process.env.API_PROXY_TARGET || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The marketing page's photography (src/features/marketing) is sourced
  // from Unsplash rather than shipped as local assets, so next/image can
  // optimise it — this is the "marketing image host" the CSP comment
  // below already anticipated.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },

  // Replaces the `rewrites` block that lived in vercel.json. The SPA
  // catch-all rewrite from that file is NOT carried over — the App Router
  // resolves paths natively, so it is no longer needed.
  async rewrites() {
    if (!API_TARGET) return [];
    return [{ source: "/api/:path*", destination: `${API_TARGET}/api/:path*` }];
  },

  // /schedule was the Timetable screen. It drew the same week over the
  // same table as the calendar, with its own entry form, so a lesson
  // added in one was missing from the other. The screen folded into
  // /planner (see src/features/planner) and the URL follows it —
  // permanently, because it is a move and not an experiment.
  //
  // Here rather than as a page that calls redirect(): redirects are
  // checked before the filesystem, so nothing of the studio has to boot
  // to bounce. In-app jumps never reach this — navTargetFor("schedule")
  // resolves to /planner directly (src/config/nav.ts).
  async redirects() {
    return [{ source: "/schedule", destination: "/planner", permanent: true }];
  },

  // Response headers. The Express app used to set these with Helmet; when
  // the API was deleted they went with it, and nothing replaced them —
  // SECURITY.md went on describing a policy that no response carried.
  //
  // Deliberately NOT a Content-Security-Policy. A CSP for this app has to
  // allow Google Fonts, Supabase over wss, the avatar and marketing image
  // hosts, and the OAuth redirect origins; getting one wrong does not
  // degrade, it blanks the page. It needs writing against a running app
  // with a real Supabase project, which is a change worth making on its
  // own and verifying in a preview deploy. The headers below cannot break
  // a working page, so they should not wait for it.
  //
  // HSTS carries no `preload` and no `includeSubDomains`: both are
  // effectively irreversible once a browser has cached them, and neither
  // is ours to commit to on the strength of a config edit.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },

  // Next 16 removed `next lint` and the `eslint` config key — linting is
  // its own CI step now (see docs/11-nextjs-migration.md §6).

  typescript: {
    // Type errors DO fail the build. This is the gate that keeps the typed
    // surface from regressing while `.jsx` files are still being ported.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
