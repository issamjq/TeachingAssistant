import { api } from "@/shared/lib/apiClient";
import type { BulletinDraft, BulletinPatch, BulletinPost } from "./types";

// Network calls for the bulletin board. Components never call fetch
// directly — this is the only place the feature touches the API.

export const listPosts = () => api<BulletinPost[]>("/api/bulletin");

export const createPost = (draft: BulletinDraft) =>
  api<BulletinPost, BulletinDraft>("/api/bulletin", { method: "POST", body: draft });

export const updatePost = (id: string, patch: BulletinPatch) =>
  api<BulletinPost, BulletinPatch>(`/api/bulletin/${id}`, { method: "PATCH", body: patch });

export const deletePost = (id: string) =>
  api<{ ok: true }>(`/api/bulletin/${id}`, { method: "DELETE" });

/** The class share token, minted server-side on first ask. */
export const getShare = () => api<{ token: string }>("/api/bulletin/share");
