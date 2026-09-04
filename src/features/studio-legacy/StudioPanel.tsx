"use client";

import { useState } from "react";
import { X, Send, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStudio } from "./studio-context";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

function simulatedReply(kind: string, prompt: string): string {
  return `Drafting the ${kind.toLowerCase()} — "${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}". This is a simulated reply; real generation needs the AI backend, not yet wired up in this build.`;
}

export function StudioPanel() {
  const { item, close } = useStudio();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);

  if (!item) return null;

  function send() {
    const prompt = draft.trim();
    if (!prompt || !item) return;
    setTurns((t) => [...t, { role: "user", text: prompt }]);
    setDraft("");
    setTyping(true);
    setTimeout(() => {
      setTurns((t) => [...t, { role: "assistant", text: simulatedReply(item.kind, prompt) }]);
      setTyping(false);
    }, 900);
  }

  function handleClose() {
    setTurns([]);
    setDraft("");
    close();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-foreground/30" onClick={handleClose} />
      <div className="relative flex h-full w-full max-w-[440px] flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.kind} studio{item.classLabel ? ` · ${item.classLabel}` : ""}
            </p>
            <h2 className="mt-0.5 font-serif text-lg font-medium text-foreground">
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto p-5">
          {turns.length === 0 ? (
            <p className="mx-auto max-w-[260px] pt-10 text-center text-sm text-muted-foreground">
              Prompt the assistant to draft or revise this {item.kind.toLowerCase()} —
              it only sees this one record, nothing else in your account.
            </p>
          ) : (
            turns.map((t, i) => (
              <div key={i} className={cn("flex", t.role === "user" && "justify-end")}>
                <div
                  className={cn(
                    "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    t.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-secondary-foreground",
                  )}
                >
                  {t.text}
                </div>
              </div>
            ))
          )}
          {typing ? (
            <p className="text-xs italic text-muted-foreground">Drafting…</p>
          ) : null}
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3.5">
          <textarea
            className="min-h-10 max-h-36 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={`Ask for changes to this ${item.kind.toLowerCase()}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            title="Send"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="flex items-center gap-1.5 border-t border-dashed border-border bg-secondary/30 px-5 py-2 text-[11px] text-muted-foreground">
          <Sparkles className="size-3" />
          Large-scale term planning still belongs in the Goal Planner — this
          studio is for one record at a time.
        </p>
      </div>
    </div>
  );
}
