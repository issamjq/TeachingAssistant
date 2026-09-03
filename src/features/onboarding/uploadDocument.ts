// =====================================================================
// Put an uploaded CV or staff card into storage, from the browser
//
// The file goes straight from the tab to Supabase Storage under the
// teacher's own session. It never passes through the API, and that is
// deliberate: a server-side upload would need a service-role key, and a
// leaked service key mints tokens rather than merely reading rows. This
// backend holds none.
//
// The path is `<uid>/<timestamp>-<name>`, and the leading segment is not
// cosmetic — the bucket policies match on it (`(storage.foldername(name))[1]
// = auth.uid()`). A file written anywhere else is rejected by the
// database, so the folder IS the access control.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

/** Which bucket a document belongs in. Both are private. */
const BUCKETS = {
  resume: "resumes",
  id_card: "id-cards",
  certificate: "resumes",
  other: "imports",
} as const;

export type DocKind = keyof typeof BUCKETS;

/** Strip anything that would make a storage key awkward or ambiguous. */
const safeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "document";

export type UploadedDoc = { path: string; bucket: string };

/**
 * Upload and return where it landed.
 *
 * Returns null rather than throwing when storage is unreachable or the
 * session has gone: the parse still works from the bytes in memory, and
 * failing to archive a copy should not cost the teacher the extraction
 * they were actually waiting for.
 */
export async function uploadDocument(
  file: File,
  kind: DocKind = "resume"
): Promise<UploadedDoc | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;

    const bucket = BUCKETS[kind] ?? BUCKETS.other;
    // Date.now() keeps two uploads of "cv.pdf" apart without needing to
    // read the folder first.
    const path = `${uid}/${Date.now()}-${safeName(file.name)}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      // Never overwrite. The timestamp already makes collisions
      // vanishingly unlikely, and on the one that happens, losing the
      // earlier document silently is the worse outcome.
      upsert: false,
    });
    if (error) {
      console.warn("[upload] storage rejected the file:", error.message);
      return null;
    }
    return { path, bucket };
  } catch (e) {
    console.warn("[upload] failed:", e);
    return null;
  }
}
