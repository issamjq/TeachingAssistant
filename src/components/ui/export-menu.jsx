"use client";

import { flash } from "@/shared/lib/flash";
import React, { useEffect, useRef, useState } from "react";
import { Download, FileCode2, FileText, FileType2, Loader2 } from "lucide-react";
import { printDoc, exportDocx, exportMarkdown } from "../../lib/export";
import { useT } from "../../lib/i18n";

// Export control shared by every teaching surface.
//
//   formats  — any of ["pdf","doc","md"]. Controls which options show.
//   buildDoc — () => doc | Promise<doc>; produces the normalized doc model
//              (see src/lib/export.js). Builders pass current state; list
//              rows pass an async loader that fetches the full item first.
//   compact  — true → a small icon button (list rows); false → a labelled
//              "Export" pill (builder headers).
//
// One format → click acts immediately. Two → a small popover offers PDF /
// Word. Labels are bilingual via the export.* i18n keys.
export function ExportMenu({ formats = ["pdf"], buildDoc, compact = false, className = "" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // "pdf" | "doc" | null
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (fmt) => {
    setOpen(false);
    setBusy(fmt);
    try {
      const doc = await buildDoc();
      if (!doc) return;
      if (fmt === "doc") await exportDocx(doc);
      else if (fmt === "md") exportMarkdown(doc);
      else printDoc(doc);
    } catch (e) {
      console.error("Export failed", e);
      flash(`${t("export.failed") === "export.failed" ? "Could not export" : t("export.failed")}: ${e.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  const onTrigger = () => {
    if (formats.length === 1) run(formats[0]);
    else setOpen((o) => !o);
  };

  const lbl = (k, fb) => { const v = t(`export.${k}`); return v === `export.${k}` ? fb : v; };

  const trigger = compact ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onTrigger(); }}
      aria-label={lbl("export", "Export")}
      title={lbl("export", "Export")}
      disabled={!!busy}
      className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink text-ink-soft flex items-center justify-center transition disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <Download size={12} strokeWidth={2} />}
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onTrigger(); }}
      disabled={!!busy}
      className="murchid-pressable murchid-focus inline-flex items-center justify-center gap-1.5 font-medium leading-none rounded-full whitespace-nowrap px-4 py-2 text-sm bg-paper-cool text-ink border border-line hover:border-ink/40 hover:bg-paper-warm disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {busy ? lbl("exporting", "Exporting…") : lbl("export", "Export")}
    </button>
  );

  return (
    <span ref={ref} className={`relative inline-flex ${className}`} onClick={(e) => e.stopPropagation()}>
      {trigger}
      {open && formats.length > 1 && (
        <div
          className={`absolute z-50 ${compact ? "right-0" : "left-0"} top-full mt-1.5 w-40 rounded-xl border border-line bg-paper-cool shadow-[0_18px_44px_-18px_rgba(15,20,16,0.32)] p-1.5 animate-[popIn_160ms_cubic-bezier(0.22,1,0.36,1)]`}
        >
          <button
            type="button"
            onClick={() => run("pdf")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-ink hover:bg-paper-warm transition text-left"
          >
            <FileText size={14} className="text-accent" /> {lbl("pdf", "PDF")}
          </button>
          {formats.includes("doc") && (
            <button
              type="button"
              onClick={() => run("doc")}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-ink hover:bg-paper-warm transition text-left"
            >
              <FileType2 size={14} className="text-sage" /> {lbl("word", "Word")}
            </button>
          )}
          {formats.includes("md") && (
            <button
              type="button"
              onClick={() => run("md")}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-ink hover:bg-paper-warm transition text-left"
            >
              <FileCode2 size={14} className="text-ink-soft" /> {lbl("markdown", "Markdown")}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
