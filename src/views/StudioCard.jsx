import React, { useEffect, useState } from "react";
import { Pencil, Sparkles, X, Check, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "../lib/markdown";
import { inputClasses } from "./_shared";
import { useT } from "../lib/i18n";

// One per parsed section. Three modes:
//   view       — rendered markdown + Edit / Regenerate / Remove icon row
//   editing    — raw markdown in a textarea + Save / Cancel
//   hint open  — small "what to change?" input + Regenerate / Cancel
//
// During an active regeneration we render `streamingMarkdown` instead of
// the persisted markdown, with a blinking cursor at the tail.
//
// `editTrigger` is a `{id, ts}` object the parent updates when the user
// clicks the corresponding section in the live preview. The ts changes on
// every click so re-clicking the same section re-fires the effect.
export default function StudioCard({ section, editTrigger, onSave, onRegenerate, onCancelRegenerate, onRemove }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.markdown);
  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState("");

  // Open in edit mode when the parent fires a trigger for this section.
  // Skip if the section is currently regenerating — that UI takes priority.
  useEffect(() => {
    if (!editTrigger || editTrigger.id !== section.id) return;
    if (section.regenerating) return;
    setDraft(section.markdown);
    setEditing(true);
    setHintOpen(false);
  }, [editTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginEdit = () => {
    setDraft(section.markdown);
    setEditing(true);
  };
  const commitEdit = () => {
    onSave(draft);
    setEditing(false);
  };
  const beginRegen = () => {
    setHint("");
    setHintOpen(true);
  };
  const fireRegen = () => {
    setHintOpen(false);
    onRegenerate(hint.trim() || null);
  };

  // --- regenerating ---------------------------------------------------------
  if (section.regenerating) {
    return (
      <Card className="border-accent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs text-accent inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> {t("sc.regenerating")} · {section.title}
            </p>
            <button
              onClick={onCancelRegenerate}
              title={t("sc.cancelRegen")}
              className="text-muted hover:text-accent"
            >
              <X size={13} />
            </button>
          </div>
          <pre className="text-xs text-ink-soft whitespace-pre-wrap font-sans bg-paper border border-line/60 rounded-md p-3 max-h-[240px] overflow-y-auto">
            {section.streamingMarkdown || ""}
            <span className="inline-block w-1 h-3 bg-accent ml-0.5 align-text-bottom animate-pulse" />
          </pre>
        </CardContent>
      </Card>
    );
  }

  // --- inline edit ----------------------------------------------------------
  if (editing) {
    // Compose-style shortcuts (Gmail / Twitter convention):
    //   Enter           → Save
    //   Shift + Enter   → newline (so multi-line markdown still works)
    //   Esc             → Cancel
    const onKey = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
      }
    };
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted">
              {t("sc.editing")} · {section.title}
            </p>
          </div>
          <textarea
            rows={Math.max(6, draft.split("\n").length + 1)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            className={`${inputClasses} font-mono text-[12px] leading-relaxed`}
          />
          <div className="flex items-center justify-between gap-2 mt-3">
            <div className="flex items-center gap-2">
              <Button onClick={commitEdit} className="text-xs px-3 py-1.5">
                <Check size={13} className="mr-1.5" /> {t("studio.save")}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5">
                {t("studio.cancel")}
              </Button>
            </div>
            <p className="text-[10px] text-muted">
              {t("sc.shortcuts")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- regen hint -----------------------------------------------------------
  if (hintOpen) {
    return (
      <Card className="border-accent">
        <CardContent className="p-4">
          <p className="text-xs text-muted mb-2">
            {t("sc.regenerate")} · {section.title}
          </p>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder={t("sc.hintPlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter") fireRegen(); }}
            autoFocus
            className={`${inputClasses}`}
          />
          <div className="flex items-center gap-2 mt-3">
            <Button onClick={fireRegen} className="text-xs px-3 py-1.5">
              <Sparkles size={13} className="mr-1.5" /> {t("sc.regenerate")}
            </Button>
            <Button variant="secondary" onClick={() => setHintOpen(false)} className="text-xs px-3 py-1.5">
              {t("studio.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- default view ---------------------------------------------------------
  return (
    <Card className="hover:border-ink/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-xs text-muted truncate">
            {section.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={beginEdit}
              title={t("sc.edit")}
              className="h-7 w-7 rounded-md border border-line hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={beginRegen}
              title={t("sc.regenerate")}
              className="h-7 w-7 rounded-md border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center text-ink-soft hover:text-accent transition"
            >
              <Sparkles size={12} />
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                title={t("sc.remove")}
                className="h-7 w-7 rounded-md border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center text-ink-soft hover:text-accent transition"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="text-ink-soft -mt-1">
          {renderMarkdown(section.markdown)}
        </div>
      </CardContent>
    </Card>
  );
}
