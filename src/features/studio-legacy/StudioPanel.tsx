"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";

import { useStudio } from "./studio-context";
import styles from "./StudioPanel.module.css";

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
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={handleClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              {item.kind} studio{item.classLabel ? ` · ${item.classLabel}` : ""}
            </p>
            <h2 className={styles.title}>{item.title}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.thread}>
          {turns.length === 0 ? (
            <p className={styles.emptyState}>
              Prompt the assistant to draft or revise this {item.kind.toLowerCase()} —
              it only sees this one record, nothing else in your account.
            </p>
          ) : (
            turns.map((t, i) => (
              <div
                key={i}
                className={`${styles.turn} ${t.role === "user" ? styles.turnUser : ""}`}
              >
                <div
                  className={`${styles.bubble} ${
                    t.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                  }`}
                >
                  {t.text}
                </div>
              </div>
            ))
          )}
          {typing ? <p className={styles.typing}>Drafting…</p> : null}
        </div>

        <div className={styles.composer}>
          <textarea
            className={styles.textarea}
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
            className={styles.sendButton}
            onClick={send}
            disabled={!draft.trim()}
            title="Send"
          >
            <Send size={16} />
          </button>
        </div>
        <p className={styles.scopeNote}>
          Large-scale term planning still belongs in the Goal Planner — this
          studio is for one record at a time.
        </p>
      </div>
    </div>
  );
}
