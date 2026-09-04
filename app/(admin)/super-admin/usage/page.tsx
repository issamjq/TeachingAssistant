import { Cpu } from "lucide-react";

import { NotWiredUpYet } from "@/features/admin/not-wired-up";

export default function SuperAdminUsagePage() {
  return (
    <NotWiredUpYet
      icon={Cpu}
      title="AI usage & credits"
      description="Tokens burned vs. charged vs. upstream cost, per account."
      whatItNeeds="Needs an AI-request logging table (usage_logs) recorded server-side every time a generation runs. Nothing calls a real AI backend yet, so there's nothing to log."
    />
  );
}
