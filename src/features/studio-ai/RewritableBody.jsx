"use client";

// =====================================================================
// A prose artifact whose sections can be rewritten one at a time
//
// The per-section half of /api/studio/regenerate: hover a section of a
// finished document, say what should change ("shorter", "make the
// starter a demonstration", "harder numbers"), and only that section is
// rewritten — streamed live into place while the rest of the document
// stands still. parseSections/joinSections were built for exactly this
// (each block carries a streamingMarkdown slot); this component is the
// UI that finally uses them.
// =====================================================================
import React, { useState } from "react";
import { Wand2, ArrowUp, X } from "lucide-react";
import { parseSections, renderMarkdown } from "@/lib/markdown";
import s from "./Studio.module.css";

export function RewritableBody({ markdown, kind, onChange }) {
  const [activeId, setActiveId] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState(null);

  const sections = parseSections(markdown || "");

  // One block (or none) means there is no section to aim at — the
  // "Ask for a change" chip already covers whole-document rework.
  if (sections.length <= 1) {
    return <div className={s.reply}>{renderMarkdown(markdown || "")}</div>;
  }

  const rewrite = async (section) => {
    const prompt = instruction.trim();
    if (!prompt || busyId) return;
    setBusyId(section.id);
    setError(null);
    setPreview("");
    try {
      const { streamSSE } = await import("@/shared/lib/apiStream");
      let acc = "";
      await streamSSE("/api/studio/regenerate", {
        body: { kind, section: section.title, current: section.markdown, prompt },
        onEvent: (ev) => {
          if (ev.type === "delta") {
            acc += ev.text || "";
            setPreview(acc);
          }
        },
      });
      let next = acc.trim();
      if (!next) throw new Error("The rewrite came back empty — the section was left as it was.");
      // The service returns only the section body. Keep the document's
      // shape: a targeted H2 block must still open with its heading.
      if (section.id !== "header" && !/^##\s/.test(next)) {
        next = `## ${section.title}\n\n${next}`;
      }
      onChange(
        sections
          .map((x) => (x.id === section.id ? next : x.markdown))
          .filter(Boolean)
          .join("\n\n"),
      );
      setActiveId(null);
      setInstruction("");
    } catch (e) {
      setError(
        e?.code === "no_backend"
          ? "Rewriting needs the Murchid API service, which isn't connected yet."
          : e.message,
      );
    } finally {
      setBusyId(null);
      setPreview("");
    }
  };

  return (
    <div className={s.reply}>
      {sections.map((section) => {
        const busy = busyId === section.id;
        const active = activeId === section.id;
        return (
          <div key={section.id} className="group relative">
            {busy ? (
              <>
                {renderMarkdown(preview || "")}
                <span className={s.caret} aria-hidden="true" />
              </>
            ) : (
              renderMarkdown(section.markdown)
            )}

            {!busy && !active && !busyId && (
              <button
                type="button"
                className={`${s.chipBtn} absolute top-0 end-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity`}
                title={`Rewrite “${section.title}”`}
                onClick={() => {
                  setActiveId(section.id);
                  setInstruction("");
                  setError(null);
                }}
              >
                <Wand2 size={13} /> Rewrite
              </button>
            )}

            {active && !busy && (
              <div className="flex items-center gap-2 mt-2 mb-3">
                <input
                  autoFocus
                  className="flex-1 min-w-0 text-sm bg-transparent border border-line rounded-lg px-3 py-1.5 outline-none focus:border-accent/50"
                  placeholder={`How should “${section.title}” change?`}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rewrite(section);
                    if (e.key === "Escape") setActiveId(null);
                  }}
                />
                <button
                  type="button"
                  className={s.chipBtn}
                  data-primary
                  disabled={!instruction.trim()}
                  onClick={() => rewrite(section)}
                >
                  <ArrowUp size={13} /> Rewrite
                </button>
                <button
                  type="button"
                  className={s.chipBtn}
                  aria-label="Cancel rewrite"
                  onClick={() => setActiveId(null)}
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-[12.5px] text-crit mt-2">{error}</p>}
    </div>
  );
}
