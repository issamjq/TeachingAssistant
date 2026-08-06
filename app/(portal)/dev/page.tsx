import { PortalSignIn, portalMetadata } from "@/features/portal";
import { PORTALS } from "@/lib/portal";

export const metadata = portalMetadata("Dev portal");

export default function DevPortalPage() {
  return <PortalSignIn portal={PORTALS.dev} />;
}
