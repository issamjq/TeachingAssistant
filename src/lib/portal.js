// Portal routing — privileged-role sign-in pages live at distinct
// pathnames so they can be shared as a link without exposing them in
// the marketing nav.
//
//   /admin   → admin + super_admin portal
//   /owner   → owner portal
//   /moe     → MoE portal
//
// Vercel's SPA fallback (vercel.json) rewrites all paths to /index.html
// while preserving the browser's pathname, so window.location.pathname
// is the source of truth. Vite's dev server does the same out of the
// box for unknown paths.
//
// After a successful portal sign-in, the URL is replaced with /#/dashboard
// (clean pathname, hash-based studio route) so refreshes don't re-trigger
// the portal page.

export const PORTALS = {
  admin: {
    id: "admin",
    paths: ["/admin", "/admin/"],
    allowedRoles: ["admin", "super_admin", "dev"],
    titleKey: "portal.admin.title",
    titleEmKey: "portal.admin.titleEm",
    eyebrowKey: "portal.admin.eyebrow",
    leadKey: "portal.admin.lead",
  },
  owner: {
    id: "owner",
    paths: ["/owner", "/owner/"],
    allowedRoles: ["owner", "dev"],
    titleKey: "portal.owner.title",
    titleEmKey: "portal.owner.titleEm",
    eyebrowKey: "portal.owner.eyebrow",
    leadKey: "portal.owner.lead",
  },
  moe: {
    id: "moe",
    paths: ["/moe", "/moe/"],
    allowedRoles: ["moe", "dev"],
    titleKey: "portal.moe.title",
    titleEmKey: "portal.moe.titleEm",
    eyebrowKey: "portal.moe.eyebrow",
    leadKey: "portal.moe.lead",
  },
};

export function getPortalFromPath() {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname;
  for (const portal of Object.values(PORTALS)) {
    if (portal.paths.includes(p)) return portal;
  }
  return null;
}

// After a successful portal sign-in, swap the pathname for `/` and set
// the studio hash. This keeps the studio URL clean (no `/admin#/...`)
// and means a refresh lands on the studio dashboard, not the portal.
export function exitPortalToStudio() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", "/#/dashboard");
  window.dispatchEvent(new Event("popstate"));
}
