"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function StudioComposerBar({
  placeholder,
  buttonLabel,
  onSubmit,
}: {
  placeholder: string;
  buttonLabel: string;
  onSubmit: (prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = prompt.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
      setPrompt("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
      <Textarea
        rows={1}
        placeholder={placeholder}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="min-h-10 flex-1 resize-none rounded-xl border-0 shadow-none focus-visible:ring-0"
      />
      <Button onClick={submit} disabled={busy || !prompt.trim()} className="shrink-0 rounded-full">
        <Sparkles className="size-4" />
        {busy ? "Drafting…" : buttonLabel}
      </Button>
    </div>
  );
}
