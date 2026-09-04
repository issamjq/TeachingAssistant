import { KeyRound } from "lucide-react";

import { NotWiredUpYet } from "@/features/admin/not-wired-up";

export default function SuperAdminKeysPage() {
  return (
    <NotWiredUpYet
      icon={KeyRound}
      title="API keys"
      description="The AI provider key pool — add, rotate, and disable credentials."
      whatItNeeds="This lives on the separate AI backend (murchid-backend-no24.onrender.com), not this app — it's the one super-admin screen that was never answered by Supabase, even in the old build."
    />
  );
}
