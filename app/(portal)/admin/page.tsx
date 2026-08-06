import { PortalSignIn, portalMetadata } from "@/features/portal";
import { PORTALS } from "@/lib/portal";

export const metadata = portalMetadata("Admin portal");

export default function AdminPortalPage() {
  return <PortalSignIn portal={PORTALS.admin} />;
}
