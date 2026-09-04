"use client";

import { useState } from "react";
import { Paperclip, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { logGeneration } from "@/lib/data/analytics";
import { ComposerAttachMenu } from "./ComposerAttachMenu";

export function StudioComposerBar({
  placeholder,
  buttonLabel,
  onSubmit,
  classId,
  ownerId,
  feature,
  canSend = true,
  disabledHint,
  onAttached,
}: {
  placeholder: string;
  buttonLabel: string;
  onSubmit: (prompt: string) => Promise<void>;
  classId: string;
  ownerId: string | null;
  feature: string;
  canSend?: boolean;
  disabledHint?: string;
  onAttached?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  async function submit() {
    const value = prompt.trim();
    if (!value || busy || !canSend) return;
    setBusy(true);
    try {
      await onSubmit(value);
      if (ownerId) logGeneration(ownerId, feature, classId);
      setPrompt("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-2">
      {attachOpen && ownerId ? (
        <ComposerAttachMenu
          ownerId={ownerId}
          classId={classId}
          onAttached={() => {
            setAttachOpen(false);
            onAttached?.();
          }}
        />
      ) : null}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setAttachOpen((o) => !o)}
          disabled={!ownerId}
          className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          title="Choose from deck or add a syllabus/curriculum"
        >
          {attachOpen ? <X className="size-4" /> : <Paperclip className="size-4" />}
        </Button>
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
        <Button
          onClick={submit}
          disabled={busy || !prompt.trim() || !canSend}
          className="shrink-0 rounded-full"
        >
          <Sparkles className="size-4" />
          {busy ? "Drafting…" : buttonLabel}
        </Button>
      </div>
      {!canSend ? (
        <p className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
          {disabledHint ?? (
            <>
              Add a syllabus or reference with the <Paperclip className="size-3" /> button first —
              it keeps the draft grounded.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
