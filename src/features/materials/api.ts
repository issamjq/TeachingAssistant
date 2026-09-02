// The teacher's own material — her textbook, her syllabus, her notes.
//
// One upload path, used by the studio composer, the goal planner and the
// shelf itself. It was copied into two screens before, which is how the
// two ended up filing the same file under different folders with
// different columns set.

import { api } from "@/views/_shared";
import { supabase } from "@/lib/supabaseClient";
import { facultyId } from "@/lib/data/session";

export const MAX_BYTES = 25 * 1024 * 1024;

export interface Material {
  id: string;
  title: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  /** uploaded → processing → ready | failed. Written by the service. */
  status: string | null;
  kind: "textbook" | "syllabus" | "notes" | "other" | null;
  grade: string | null;
  subject: string | null;
  section: string | null;
  pages: number | null;
  created_at: string;
  updated_at: string;
}

/** What a generation needs to name a file: nothing more travels. */
export interface Attachment {
  id: string;
  name: string;
  path?: string;
  mime?: string;
  /**
   * Extraction state, carried so the composer can quote honestly: a
   * material already `ready` costs no reading surcharge, because the
   * service serves its stored text rather than opening the file again.
   */
  status?: string | null;
}

export const listMaterials = (q: { grade?: string; subject?: string } = {}) => {
  const qs = new URLSearchParams();
  if (q.grade) qs.set("grade", q.grade);
  if (q.subject) qs.set("subject", q.subject);
  const tail = qs.toString();
  return api<Material[]>(`/api/materials${tail ? `?${tail}` : ""}`);
};

export const updateMaterial = (id: string, body: Partial<Material>) =>
  api<Material>(`/api/materials/${id}`, { method: "PATCH", body });

export const deleteMaterial = (id: string) =>
  api<{ ok: true }>(`/api/materials/${id}`, { method: "DELETE" });

/** Display name, falling back to the filename she never chose. */
export const materialLabel = (m: Material) =>
  (m.title || "").trim() || m.file_name;

const safeName = (n: string) => n.replace(/[^\w.-]+/g, "_").slice(-80);

/**
 * Upload one file and file it.
 *
 * Browser → Storage under the teacher's own session: a server-side
 * upload would need a service-role key and nothing in this system holds
 * one. The path's first segment is her uid, which is what the bucket
 * policy checks.
 *
 * `where` labels the folder only — the row is the same wherever it came
 * from, so a file attached in the studio is on the shelf too.
 */
export async function uploadMaterial(
  file: File,
  opts: {
    where?: string;
    kind?: Material["kind"];
    audience?: { grade?: string | null; subject?: string | null; section?: string | null } | null;
  } = {},
): Promise<Attachment> {
  if (file.size > MAX_BYTES) {
    throw new Error(`"${file.name}" is over 25 MB.`);
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  const fid = await facultyId();
  const path = `${uid}/${opts.where || "studio"}/${Date.now()}-${safeName(file.name)}`;

  const { error } = await supabase.storage.from("imports").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  const { data: row, error: rowErr } = await supabase
    .from("materials")
    .insert({
      faculty_id: fid,
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      status: "uploaded",
      kind: opts.kind ?? null,
      // Bound to a class from the first save. Retrofitting this later
      // would mean a migration and asking her to upload it all again.
      grade: opts.audience?.grade ?? null,
      subject: opts.audience?.subject ?? null,
      section: opts.audience?.section ?? null,
    })
    .select("id")
    .single();
  if (rowErr) throw rowErr;

  // Ask the service to read it once, so later generations use the stored
  // text instead of re-downloading and re-charging for the same pages.
  // Fire-and-forget: extraction is an optimisation, and a service that
  // has not shipped it yet must not block an upload that already worked.
  void extractMaterial(row.id).catch(() => {});

  // Freshly uploaded, so not read yet — this one still costs a read.
  return { id: row.id, name: file.name, path, mime: file.type, status: "uploaded" };
}

/**
 * Ask the service to read a file, once.
 *
 * Idempotent by contract: a row already `ready` returns what is there
 * and charges nothing, so retrying is free. Also the BACKFILL path —
 * everything uploaded before extraction existed is sitting at
 * `uploaded` with no text, and nothing else would ever ask again.
 */
export const extractMaterial = (id: string) =>
  api<{ id: string; status: string; chars?: number; pages?: number }>(
    `/api/materials/${id}/extract`, { method: "POST" },
  );

/**
 * Read everything of hers that has never been read.
 *
 * Files uploaded before extraction existed sit at `uploaded` with no
 * text, and nothing goes back for them on its own — each one costing the
 * reading surcharge on every generation that attaches it. A server-side
 * cron cannot do this: the service holds no service-role key on purpose,
 * and storage is read with the teacher's own token, so the sweep has to
 * be a call SHE makes.
 *
 * 25 per call. `remaining` above zero means there are more; deliberately
 * one batch per press rather than a loop, because every successful read
 * is charged and a button that quietly spends is not one she can trust.
 */
export const extractPending = () =>
  api<{
    read: number;
    failed: number;
    remaining: number;
    files?: { id: string; status: string; chars?: number; pages?: number }[];
  }>("/api/materials/extract-pending", { method: "POST" });
