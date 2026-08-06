import { PortalSignIn, portalMetadata } from "@/features/portal";
import { PORTALS } from "@/lib/portal";

export const metadata = portalMetadata("MoE portal");

export default function MoePortalPage() {
  return <PortalSignIn portal={PORTALS.moe} />;
}
