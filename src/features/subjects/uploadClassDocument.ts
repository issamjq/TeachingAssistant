// =====================================================================
// Put a required document into storage, from the browser (§106)
//
// Same shape as onboarding/uploadDocument.ts: the file goes straight
// from the tab to Supabase Storage under the teacher's own session, and
// the path's leading segment is what the bucket policy checks against
// — `class-documents_own_folder` in db/tune.sql matches
// `(storage.foldername(name))[1] = auth.uid()`. A file written under
// anyone else's uid is rejected by the database, not by this code.
//
// The class id is folded into the path (not just the row) so a listing
// of the bucket alone — support debugging a storage quota, say — still
// shows which class a stray file belonged to.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

const BUCKET = "class-documents";

/** Strip anything that would make a storage key awkward or ambiguous. */
const safeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "document";

export type UploadedClassDocument = { path: string; bucket: string; name: string; mime_type: string | null; size_bytes: number };

/**
 * Upload one file for one class and return where it landed.
 *
 * Throws rather than swallowing the error: unlike the onboarding upload
 * (which is a best-effort archive of a CV the parse already used), this
 * IS the feature — a failed upload here must not be reported to the
 * teacher as "document added".
 */
export async function uploadClassDocument(file: File, classId: string): Promise<UploadedClassDocument> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("You need to be signed in to add a document.");

  const path = `${uid}/${classId}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Could not upload that file.");

  return { path, bucket: BUCKET, name: file.name, mime_type: file.type || null, size_bytes: file.size };
}
