import NotFoundRedirect from "@/features/studio-shell/NotFoundRedirect";

// Reached for any path with no matching segment.
//
// Before the migration every unknown path fell into the SPA catch-all, where
// App.jsx bounced it to the signed-in role's default section (or, for a
// signed-out visitor, to the landing page). Deleting the catch-all in Phase 4
// would otherwise have turned that silent recovery into a hard 404, so the
// behaviour is reproduced here explicitly.
export default function NotFound() {
  return <NotFoundRedirect />;
}
