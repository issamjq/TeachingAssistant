"use client";

// "Attach something you already have."
//
// The composer could only ever upload, so the same textbook chapter was
// re-uploaded for every lesson — and the read is priced per request that
// carries an attachment, so she paid for the same pages again each time.
// This offers what is already on her shelf.
//
// Shaped like SkillsPicker and ClassPicker: a small popover off the
// composer bar, not a modal. Attaching a file is a step inside writing a
// brief, and a dialog over the top would interrupt what she is doing.

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Check } from "lucide-react";
import { listMaterials, materialLabel } from "./api";
import { useMounted } from "@/shared/hooks/useMounted";

export default function MaterialPicker({ attached = [], onPick, audience = null }) {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const btnRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  // Loaded when it is opened, not on mount: most turns never attach
  // anything, and a shelf read on every studio load is a request a
  // teacher never asked for.
  useEffect(() => {
    if (!open || rows) return;
    listMaterials()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setAnchor({ left: r.left, bottom: window.innerHeight - r.top + 8 });
    };
    place();
    const close = (e) => {
      if (!btnRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Her material for THIS class first — 6A and 6B may work from
  // different notes — then everything else, so nothing is hidden.
  const ordered = React.useMemo(() => {
    if (!rows) return null;
    if (!audience?.grade && !audience?.subject) return rows;
    const fits = (m) =>
      (!m.grade || !audience?.grade || m.grade === audience.grade) &&
      (!m.subject || !audience?.subject || m.subject === audience.subject);
    return [...rows].sort((a, b) => Number(fits(b)) - Number(fits(a)));
  }, [rows, audience]);

  const isOn = (id) => attached.some((a) => a.id === id);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Attach something from your material"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-line text-[12px] text-ink-soft hover:text-ink"
      >
        <FileText size={13} aria-hidden />
        Material
      </button>

      {mounted && open && anchor &&
        createPortal(
          <div
            role="listbox"
            aria-label="Your material"
            style={{ position: "fixed", left: anchor.left, bottom: anchor.bottom, zIndex: 70 }}
            className="w-[19rem] max-h-[18rem] overflow-y-auto rounded-xl border border-line bg-paper shadow-lg p-1.5"
          >
            <p className="px-2.5 pt-1.5 pb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
              Attach from your material
            </p>

            {error && <p className="px-2.5 pb-2 text-[12px] text-accent">{error}</p>}

            {!ordered && !error && (
              <p className="px-2.5 pb-2.5 text-[12px] text-muted">Loading…</p>
            )}

            {ordered && !ordered.length && (
              <p className="px-2.5 pb-2.5 text-[12px] text-muted leading-relaxed">
                Nothing on your shelf yet. Anything you upload here is kept, so
                you only attach it once.
              </p>
            )}

            {ordered?.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={isOn(m.id)}
                onClick={() => {
                  onPick({ id: m.id, name: materialLabel(m), path: m.file_path, mime: m.mime_type, status: m.status });
                  setOpen(false);
                }}
                disabled={isOn(m.id)}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-paper-warm disabled:opacity-45 flex items-start gap-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] truncate">{materialLabel(m)}</span>
                  <span className="block text-[11px] text-muted truncate">
                    {[m.grade, m.section, m.subject].filter(Boolean).join(" · ") || "Any class"}
                    {m.status === "ready" ? " · read" : ""}
                  </span>
                </span>
                {isOn(m.id) && <Check size={13} className="flex-none mt-0.5 text-ok" aria-hidden />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
