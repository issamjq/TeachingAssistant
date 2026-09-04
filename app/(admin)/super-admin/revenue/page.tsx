import { DollarSign } from "lucide-react";

import { NotWiredUpYet } from "@/features/admin/not-wired-up";

export default function SuperAdminRevenuePage() {
  return (
    <NotWiredUpYet
      icon={DollarSign}
      title="Revenue"
      description="Payments-derived revenue and per-account billing history."
      whatItNeeds="Needs a subscriptions/payments table and a real billing provider integration — neither exists yet. There's no paid plan wired up in this build."
    />
  );
}
