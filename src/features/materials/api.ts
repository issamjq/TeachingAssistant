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
/** File a material under one or more classes (§103). */
export async function setMaterialClasses(
  id: string,
  classes: { grade: string; subject: string; section?: string | null }[],
) {
  const { error } = await supabase.rpc("set_material_classes", {
    p_material: id,
    p_classes: (classes || []).map((c) => ({
      grade: String(c.grade ?? "").trim(),
      subject: String(c.subject ?? "").trim(),
      section: String(c.section ?? "").trim(),
    })),
  });
  if (error) throw error;
}

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
  /**
   * A file with no class reaches no class (§103).
   *
   * This used to be optional and nothing ever supplied it, so all 34
   * live materials arrived with no grade and no subject — and the
   * readers treated a blank as "matches everything". Refused at the
   * upload rather than filed as "any class", because "any class" was
   * never an answer; it was the absence of one, rendered as a match
   * against every class she teaches.
   */
  const grade = String(opts.audience?.grade ?? "").trim();
  const subject = String(opts.audience?.subject ?? "").trim();
  if (!grade || !subject) {
    throw new Error("Pick the class this is for before uploading it — a file with no class reaches none.");
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
      // The legacy columns keep the first class so anything still
      // reading them sees a truth. material_classes is the source.
      grade,
      subject,
      section: String(opts.audience?.section ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (rowErr) throw rowErr;

  // Filed in the same breath as it is stored. An upload that succeeded
  // and then failed to say which class it is for is exactly the state
  // this section exists to stop.
  const { error: fileErr } = await supabase.rpc("set_material_classes", {
    p_material: row.id,
    p_classes: [{ grade, subject, section: String(opts.audience?.section ?? "").trim() }],
  });
  if (fileErr) throw fileErr;

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
