import { Coins } from "lucide-react";

import { NotWiredUpYet } from "@/features/admin/not-wired-up";

export default function SuperAdminCostsPage() {
  return (
    <NotWiredUpYet
      icon={Coins}
      title="Feature costs"
      description="Per-feature AI credit costs, editable without a deploy."
      whatItNeeds="Needs a credits/feature_flags-style config table read by the generation backend. Since generation is still simulated, there's no live cost to price yet."
    />
  );
}
