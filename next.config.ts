import type { NextConfig } from "next";

// Where /api/* is served from.
//   dev  — the Express app running standalone on PORT (npm run dev starts
//          both concurrently). Vite used to mount buildApp() as middleware;
//          Next has no equivalent, so we proxy instead. Same Express app,
//          same routes, no behaviour drift.
//   prod — Render. Overridden by API_PROXY_TARGET in Vercel project settings.
//
// Note this is the SERVER-side proxy target. The browser always calls
// same-origin /api/*, so no CORS preflight and no VITE_API_URL equivalent
// is needed on the client.
// NOT process.env.PORT. Next sets PORT to the port IT is listening on, so
// deriving the API target from it made the rewrite point back at the Next
// server itself — every /api/* call became a proxy loop returning 500 while
// the API answered correctly on its own port. Use the dedicated variable,
// and default to the Express port from .env.example.
const API_TARGET =
  process.env.API_PROXY_TARGET ||
  (process.env.NODE_ENV === "production"
    ? "https://teachingassistant-twbz.onrender.com"
    : `http://localhost:${process.env.API_PORT || 3001}`);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Replaces the `rewrites` block that lived in vercel.json. The SPA
  // catch-all rewrite from that file is NOT carried over — the App Router
  // resolves paths natively, so it is no longer needed.
  async rewrites() {
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
