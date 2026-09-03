// =====================================================================
// Attachments for the bulletin board, straight from the browser
//
// Same shape as onboarding/uploadDocument.ts, with two differences that
// matter. The bucket is PUBLIC — students read the board over an
// unauthenticated share link, so every URL must resolve without a
// session — and failure here throws instead of returning null: a post
// whose photo silently vanished is worse than an editor that says so.
//
// The path is `<uid>/<timestamp>-<name>` and the leading segment is the
// access control: the bucket policy only lets a teacher write inside
// their own uid folder.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";
import type { BulletinMedia, BulletinMediaType } from "./types";

const BUCKET = "bulletin-media";

const MB = 1024 * 1024;

// Ceilings chosen under the storage service's own per-object cap, sized
// to the medium: a photo has no business being 40MB, a clip does.
export const MEDIA_LIMITS: Record<BulletinMediaType, number> = {
  image: 10 * MB,
  video: 50 * MB,
  audio: 20 * MB,
};

export const limitLabel = (type: BulletinMediaType) =>
  `${Math.round(MEDIA_LIMITS[type] / MB)}MB`;

/** Sort a picked file into image/video/audio, or null for anything else. */
export function mediaTypeOf(file: File | Blob): BulletinMediaType | null {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

/** Strip anything that would make a storage key awkward or ambiguous. */
const safeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "attachment";

/**
 * Upload one attachment and return the row that goes into the post's
 * media array. Throws with a human-readable message on any failure.
 */
export async function uploadBulletinMedia(
  file: File | Blob,
  type: BulletinMediaType,
  name?: string,
  duration?: number
): Promise<BulletinMedia> {
  if (file.size > MEDIA_LIMITS[type]) {
    throw Object.assign(new Error("too-big"), { code: "too-big" });
  }

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const fileName =
    name || (file instanceof File ? file.name : `${type}-${Date.now()}`);
  const path = `${uid}/${Date.now()}-${safeName(fileName)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    type,
    path,
    url: data.publicUrl,
    name: fileName,
    mime: file.type || undefined,
    size: file.size,
    ...(duration ? { duration: Math.round(duration) } : {}),
  };
}

/**
 * Best-effort cleanup — when a post is deleted, or an attachment is
 * removed before it was ever saved. A stranded object costs pennies;
 * failing the user's actual action over it would cost trust.
 */
export async function removeBulletinMedia(items: BulletinMedia[]): Promise<void> {
  const paths = items.map((m) => m.path).filter(Boolean);
  if (!paths.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch (e) {
    console.warn("[bulletin] could not remove media:", e);
  }
}
