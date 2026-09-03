"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Modal } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { createClassDocument, deleteClassDocument, listClassDocuments, type ClassDocument, type ClassRow } from "./api";
import { uploadClassDocument } from "./uploadClassDocument";

/** The required documents for one class — attach more, or remove one. */
export default function ClassDocumentsModal({ cls, onClose }: { cls: ClassRow; onClose: () => void }) {
  const [docs, setDocs] = useState<ClassDocument[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    listClassDocuments(cls.id).then(setDocs).catch(() => setDocs([]));
  }, [cls.id]);

  useEffect(() => { reload(); }, [reload]);

  const addFiles = async (list: FileList | null) => {
    const chosen = Array.from(list || []);
    if (!chosen.length || busy) return;
    setBusy(true);
    try {
      for (const file of chosen) {
        const uploaded = await uploadClassDocument(file, cls.id);
        await createClassDocument({
          class_id: cls.id, name: uploaded.name, path: uploaded.path,
          mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes,
        });
      }
      reload();
    } catch (e) {
      flash((e as Error).message || "Could not add that document.", "error");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Modal open onClose={onClose} title={`Required documents — ${cls.subject}`}>
      {docs === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !docs.length ? (
        <p className="text-sm text-muted">
          Nothing attached yet. Add the files this class needs — a syllabus, a rubric, a form.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <FileText size={14} aria-hidden="true" className="shrink-0 text-muted" />
                <span className="truncate">{doc.name}</span>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs text-muted transition-colors hover:text-crit"
                onClick={async () => {
                  await deleteClassDocument(doc.id);
                  setDocs((cur) => (cur || []).filter((x) => x.id !== doc.id));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <Upload size={13} aria-hidden="true" /> {busy ? "Adding…" : "Attach a document"}
      </button>
    </Modal>
  );
}
