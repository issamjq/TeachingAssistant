// The shapes the template-library API speaks. Mirrors the contract in
// the backend reference (murchid-api-reference) exactly — field names
// and optionality are the server's, not ours to invent.

/** A document kind a library card can carry. */
export type DocKind =
  | "lesson_plan"
  | "teaching_guide"
  | "student_notes"
  | "presentation"
  | "quiz"
  | "homework"
  | "activity";

export type Stream = "general" | "advanced" | "applied";
export type Language = "en" | "ar";
export type LibrarySort = "curriculum" | "relevance" | "newest" | "popular";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "withdrawn";

/* ── filters ─────────────────────────────────────────────────────── */

export interface FilterSubject {
  subject: string;
  cards: number;
}

export interface FilterGrade {
  grade: number;
  cards: number;
  streams: Stream[];
  subjects: FilterSubject[];
}

export interface LibraryFilters {
  curriculum: string;
  language: Language;
  kinds: DocKind[];
  grades: FilterGrade[];
}

/* ── card grid ───────────────────────────────────────────────────── */

/** A card as it appears in the grid — never carries document bodies. */
export interface TemplateSummary {
  id: string;
  chapter_title: string;
  summary: string;
  doc_kinds: DocKind[];
  grade: number;
  subject: string;
  stream: Stream | null;
  use_count: number;
  origin: string; // "official" | "community" | …
}

export interface TemplatePage {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  items: TemplateSummary[];
}

/* ── single card ─────────────────────────────────────────────────── */

export interface TemplateDocument {
  kind: DocKind;
  title: string | null;
  content_md: string;
  /** Structured payload (e.g. a quiz's questions), when the kind has one. */
  structured: unknown | null;
  position: number;
}

export interface TemplateDetail {
  id: string;
  chapter_title: string;
  grade: number;
  subject: string;
  curriculum: string;
  documents: TemplateDocument[];
}

/* ── submissions ─────────────────────────────────────────────────── */

export interface SubmissionInput {
  curriculum: string;
  grade: number;
  subject: string;
  chapter_title: string;
  title: string;
  documents: { kind: DocKind; content_md: string }[];
}

export interface Submission {
  id: string;
  status: SubmissionStatus;
  curriculum: string;
  grade: number;
  subject: string;
  chapter_title: string;
  title: string;
  review_note: string | null;
}

/* ── query params for the grid ───────────────────────────────────── */

export interface TemplateQuery {
  q?: string;
  curriculum?: string;
  grade?: number;
  stream?: Stream;
  subject?: string;
  chapter_no?: number;
  language?: Language;
  kind?: DocKind;
  limit?: number;
  offset?: number;
  sort?: LibrarySort;
}
