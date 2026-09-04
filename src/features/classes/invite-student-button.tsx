"use client";

import { UserPlus, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-context";

export function InviteStudentButton() {
  const { user } = useSession();
  const approved = user?.status === "active";

  if (!approved) {
    return (
      <Button size="sm" disabled title="Available once your account is approved">
        <Lock /> Invite student
      </Button>
    );
  }

  return (
    <Button size="sm">
      <UserPlus /> Invite student
    </Button>
  );
}
