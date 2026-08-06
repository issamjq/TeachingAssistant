import type { Role } from "../shared/types/domain";

// Portal routing — privileged-role sign-in pages live at distinct
// pathnames so they can be shared as a link without exposing them in
// the marketing nav.
//
// Per-role portal mapping. Each portal targets ONE top-level role with
// one exception: dev is allowed everywhere. Dev is the universal
// tester / inspector and needs to be able to enter any surface to
// verify it. The PortalSignIn component additionally sets the local
// preview role to match the portal a dev entered through, so visiting
// /admin as dev shows the Admin console (not the Dev console).
// Canonical role on the server stays `dev` — API gates pass.
//
//   /dev         → dev only
//   /superadmin  → super_admin (+ dev)
//   /admin       → admin (+ dev)
//   /moe         → moe (+ dev)
//   /owner       → owner (+ dev)
//   /            → landing (teacher sign-up funnel)
//
// The App Router resolves these pathnames natively — the old Vercel SPA
// fallback rewrite is gone. window.location.pathname stays the source of
// truth here because this runs outside React (see getPortalFromPath).
//
// After a successful portal sign-in, the URL is replaced with /dashboard
// (clean pathname studio route) so refreshes don't re-trigger the portal
// page. App.jsx's role-based routing bounces to the right console for
// each role's default section (super_admin → /superadmin-dashboard, etc.).

export interface Portal {
  id: PortalId;
  /** Pathnames that resolve to this portal, with and without a trailing slash. */
  paths: string[];
  allowedRoles: Role[];
  /** When a dev enters this portal, preview as this role (UI only). */
  previewRoleForDev?: Role;
  titleKey: string;
  titleEmKey: string;
  eyebrowKey: string;
  leadKey: string;
}

export type PortalId = "dev" | "superadmin" | "admin" | "owner" | "moe";

export const PORTALS: Record<PortalId, Portal> = {
  dev: {
    id: "dev",
    paths: ["/dev", "/dev/"],
    allowedRoles: ["dev"],
    titleKey: "portal.dev.title",
    titleEmKey: "portal.dev.titleEm",
    eyebrowKey: "portal.dev.eyebrow",
    leadKey: "portal.dev.lead",
  },
  superadmin: {
    id: "superadmin",
    paths: ["/superadmin", "/superadmin/"],
    allowedRoles: ["super_admin", "dev"],
    // When a dev enters this portal, preview as super_admin (UI only).
    previewRoleForDev: "super_admin",
    titleKey: "portal.superadmin.title",
    titleEmKey: "portal.superadmin.titleEm",
    eyebrowKey: "portal.superadmin.eyebrow",
    leadKey: "portal.superadmin.lead",
  },
  admin: {
    id: "admin",
    paths: ["/admin", "/admin/"],
    allowedRoles: ["admin", "dev"],
    previewRoleForDev: "admin",
    titleKey: "portal.admin.title",
    titleEmKey: "portal.admin.titleEm",
    eyebrowKey: "portal.admin.eyebrow",
    leadKey: "portal.admin.lead",
  },
  owner: {
    id: "owner",
    paths: ["/owner", "/owner/"],
    allowedRoles: ["owner", "dev"],
    previewRoleForDev: "owner",
    titleKey: "portal.owner.title",
    titleEmKey: "portal.owner.titleEm",
    eyebrowKey: "portal.owner.eyebrow",
    leadKey: "portal.owner.lead",
  },
  moe: {
    id: "moe",
    paths: ["/moe", "/moe/"],
    allowedRoles: ["moe", "dev"],
    previewRoleForDev: "moe",
    titleKey: "portal.moe.title",
    titleEmKey: "portal.moe.titleEm",
    eyebrowKey: "portal.moe.eyebrow",
    leadKey: "portal.moe.lead",
  },
};

export function getPortalFromPath(): Portal | null {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname;
  for (const portal of Object.values(PORTALS)) {
    if (portal.paths.includes(p)) return portal;
  }
  return null;
}

// After a successful portal sign-in, swap the portal pathname for the
// studio dashboard. App.jsx's SECTIONS_BY_ROLE bounce handles routing
// to the right console for whatever role just signed in. A refresh on
// /dashboard re-enters the studio, not the portal.
export function exitPortalToStudio(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", "/dashboard");
  window.dispatchEvent(new Event("popstate"));
}
