"use client";

import { useState } from "react";
import { UserPlus, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";
import { inviteStudent } from "@/lib/data/classes";

export function InviteStudentButton({
  classId,
  onInvited,
}: {
  classId: string;
  onInvited: () => void;
}) {
  const { user } = useSession();
  const approved = user?.status === "active";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!approved) {
    return (
      <Button size="sm" disabled title="Available once your account is approved">
        <Lock /> Invite student
      </Button>
    );
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus /> Invite student
      </Button>
    );
  }

  async function submit() {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await inviteStudent(user.id, classId, { name: name.trim(), rollNo, email });
      setOpen(false);
      setName("");
      setRollNo("");
      setEmail("");
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-36" autoFocus />
      <Input placeholder="Roll no." value={rollNo} onChange={(e) => setRollNo(e.target.value)} className="h-8 w-20" />
      <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 w-44" />
      <Button size="sm" onClick={submit} disabled={saving}>
        Send invite
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
