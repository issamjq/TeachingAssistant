import { PortalSignIn, portalMetadata } from "@/features/portal";
import { PORTALS } from "@/lib/portal";

export const metadata = portalMetadata("Owner portal");

export default function OwnerPortalPage() {
  return <PortalSignIn portal={PORTALS.owner} />;
}
