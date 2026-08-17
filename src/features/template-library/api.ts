// Network access for the template library.
//
// Unlike most of the app, these paths are NOT answered browser→Supabase:
// the library is curated content the API service publishes and moderates,
// so `/api/library/*` is on the SERVER_ONLY list (see lib/data/index.ts)
// and every call here rides the /api proxy to the Render service. When
// that service is cold or unconnected, api() surfaces `no_backend` and
// the screen says so rather than showing an empty shelf.
import { api } from "@/shared/lib/apiClient";
import type {
  LibraryFilters,
  TemplatePage,
  TemplateDetail,
  TemplateQuery,
  Submission,
  SubmissionInput,
  SubmissionStatus,
} from "./types";

/** Drop undefined/empty params so the query string stays clean. */
function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const getFilters = (curriculum = "cbse", language: "en" | "ar" = "en") =>
  api<LibraryFilters>(`/api/library/filters${qs({ curriculum, language })}`);

export const listTemplates = (query: TemplateQuery = {}) =>
  api<TemplatePage>(`/api/library/templates${qs(query as Record<string, unknown>)}`);

export const getTemplate = (id: string) =>
  api<TemplateDetail>(`/api/library/templates/${id}`);

/** Fire-and-count: record that a card was imported. Best-effort. */
export const markUsed = (id: string) =>
  api<{ ok: true }>(`/api/library/templates/${id}/used`, { method: "POST" });

/* ── teacher submissions ─────────────────────────────────────────── */

export const listSubmissions = (status?: SubmissionStatus) =>
  api<Submission[]>(`/api/library/submissions${qs({ status })}`);

export const createSubmission = (body: SubmissionInput) =>
  api<{ id: string; status: SubmissionStatus }>("/api/library/submissions", {
    method: "POST",
    body,
  });

export const withdrawSubmission = (id: string) =>
  api<{ ok: true }>(`/api/library/submissions/${id}`, { method: "DELETE" });
