import { PortalSignIn, portalMetadata } from "@/features/portal";
import { PORTALS } from "@/lib/portal";

export const metadata = portalMetadata("Super admin portal");

export default function SuperAdminPortalPage() {
  return <PortalSignIn portal={PORTALS.superadmin} />;
}
