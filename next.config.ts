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

  // Replaces the `rewrites` block that lived in vercel.json. The SPA
  // catch-all rewrite from that file is NOT carried over — the App Router
  // resolves paths natively, so it is no longer needed.
  async rewrites() {
    if (!API_TARGET) return [];
    return [{ source: "/api/:path*", destination: `${API_TARGET}/api/:path*` }];
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
