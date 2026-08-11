// =====================================================================
// Generated work — lesson plans, quizzes, homework, presentations,
// activities and templates — straight from ai_studio
//
// This is the client-side twin of what the API's artifact router did:
// one table, discriminated by `type`, with the body in a jsonb `content`
// column, presented to the screens as the flat rows they were written
// against.
//
// The flattening has to live somewhere, and the alternative — rewriting
// every studio screen to read `content.objectives` — is a much larger
// change for no benefit. So it lives here, once.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";
import { facultyId } from "./session";

export type Kind =
  | "lesson_plan" | "quiz" | "homework"
  | "presentation" | "activity" | "template";

/** Route segment → stored type. The screens' words on the left. */
export const KIND_BY_PATH: Record<string, Kind> = {
  drafts: "lesson_plan",
  quizzes: "quiz",
  homework: "homework",
  presentations: "presentation",
  activities: "activity",
  templates: "template",
};

const COLS =
  "id, type, status, content, model_used, tokens_in, tokens_out, created_at, updated_at, deleted_at";

type Row = {
  id: string; type: string; status: string; content: Record<string, any> | null;
  created_at: string; updated_at: string; deleted_at: string | null;
  [k: string]: unknown;
};

/**
 * A stored row as a screen expects it: real columns at the top level,
 * the jsonb body spread out beside them.
 *
 * `name` and `title` are served as each other because the old tables
 * disagreed about which one a thing had, and a screen written against
 * either should find it.
 */
export function flatten(row: Row | null): Record<string, any> | null {
  if (!row) return null;
  const { content, ...rest } = row;
  const out: Record<string, any> = { ...rest, ...(content || {}) };
  if (out.name == null && content?.title != null) out.name = content.title;
  if (out.title == null && content?.name != null) out.title = content.name;
  // Several screens sort and label by this; it is updated_at by another
  // name, and was a real column on the old tables.
  out.last_edited = row.updated_at;
  return out;
}

/**
 * The words the screens use for a status, and the ones the column allows.
 *
 * ai_studio.status is CHECKed against a generation lifecycle —
 * queued/generating/complete/failed/canceled — but several screens
 * predate that and still send what they always displayed: "In progress"
 * from cloning a template, "Ready to use" from finishing a draft,
 * "Draft" from the presentation builder. Each of those was a 23514 the
 * teacher saw as "violates check constraint ai_studio_status_check".
 *
 * Mapped here rather than at the four call sites so a fifth cannot
 * reintroduce it, and because this is the only file that already knows
 * `status` is a real column rather than part of the jsonb body.
 *
 * "In progress" becomes `generating` rather than `queued` deliberately:
 * the dashboard already reads `generating` as "still drafting" and
 * raises a "finish this" task from it, which is exactly what a
 * half-written draft is.
 */
const STATUS_WORDS: Record<string, string> = {
  "in progress": "generating",
  "in-progress": "generating",
  draft: "generating",
  drafting: "generating",
  processing: "generating",
  "ready to use": "complete",
  ready: "complete",
  done: "complete",
  published: "complete",
  cancelled: "canceled",
};
const STATUS_OK = new Set(["queued", "generating", "complete", "failed", "canceled"]);

function normaliseStatus(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = String(value).trim();
  if (STATUS_OK.has(raw)) return raw;
  const mapped = STATUS_WORDS[raw.toLowerCase()];
  if (mapped) return mapped;
  // Anything unrecognised is dropped rather than sent: the column's
  // default is a valid status, and a refused INSERT loses the teacher's
  // whole draft over a label nobody reads.
  console.warn(`[artifacts] ignoring unknown status "${raw}"`);
  return undefined;
}

/** Split an incoming flat body into real columns and content keys. */
const REAL = new Set(["status", "model_used", "tokens_in", "tokens_out", "skill_id", "batch_id"]);
function split(body: Record<string, any> = {}) {
  const cols: Record<string, any> = {};
  const content: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "id" || k === "faculty_id" || k === "type") continue; // never client-set
    if (k === "status") {
      const status = normaliseStatus(v);
      if (status) cols.status = status;
    } else if (REAL.has(k)) cols[k] = v;
    else content[k] = v;
  }
  return { cols, content };
}

export async function list(kind: Kind, { trash = false } = {}) {
  const q = supabase
    .from("ai_studio")
    .select(COLS)
    .eq("type", kind)
    .order("updated_at", { ascending: false });
  const { data, error } = trash
    ? await q.not("deleted_at", "is", null)
    : await q.is("deleted_at", null);
  if (error) throw error;
  return (data as Row[]).map(flatten);
}

export async function get(kind: Kind, id: string) {
  const { data, error } = await supabase
    .from("ai_studio").select(COLS)
    .eq("id", id).eq("type", kind).is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return flatten(data as Row | null);
}

export async function create(kind: Kind, body: Record<string, any>) {
  const fid = await facultyId();
  const { cols, content } = split(body);
  const { data, error } = await supabase
    .from("ai_studio")
    .insert({ faculty_id: fid, type: kind, status: cols.status ?? "complete", content })
    .select(COLS).single();
  if (error) throw error;
  return flatten(data as Row);
}

export async function update(kind: Kind, id: string, body: Record<string, any>) {
  const { cols, content } = split(body);

  // A PATCH must leave jsonb keys it did not mention alone, and
  // PostgREST cannot merge jsonb — sending `content` would REPLACE it,
  // silently discarding every field the screen did not have on hand.
  // So the current body is read first and merged here.
  const { data: cur, error: readErr } = await supabase
    .from("ai_studio").select("content")
    .eq("id", id).eq("type", kind).is("deleted_at", null).maybeSingle();
  if (readErr) throw readErr;
  if (!cur) throw notFound();

  const patch: Record<string, any> = {
    content: { ...(cur.content || {}), ...content },
    updated_at: new Date().toISOString(),
  };
  if (cols.status !== undefined) patch.status = cols.status;

  const { data, error } = await supabase
    .from("ai_studio").update(patch)
    .eq("id", id).eq("type", kind)
    .select(COLS).single();
  if (error) throw error;
  return flatten(data as Row);
}

/** Soft delete — the studio's trash restores from this. */
export async function remove(kind: Kind, id: string) {
  const { error, count } = await supabase
    .from("ai_studio")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id).eq("type", kind).is("deleted_at", null);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

export async function restore(kind: Kind, id: string) {
  const { data, error } = await supabase
    .from("ai_studio").update({ deleted_at: null })
    .eq("id", id).eq("type", kind).not("deleted_at", "is", null)
    .select(COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return flatten(data as Row);
}

export async function purge(kind: Kind, id: string) {
  const { error, count } = await supabase
    .from("ai_studio").delete({ count: "exact" })
    .eq("id", id).eq("type", kind);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

/**
 * Quiz questions live in content.questions as an array. Each keeps a
 * `qid` so the screens that address one by id still can — see the note
 * in todo/backend-requirements.md for why an array is the right
 * shape for a document that is authored and marked as a whole.
 */
export async function questions(quizId: string) {
  const q = await get("quiz", quizId);
  if (!q) throw notFound();
  const list = (q.questions || []) as any[];
  return list
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((x) => ({ ...x, id: x.qid, quiz_id: quizId }));
}

export async function saveQuestions(quizId: string, next: any[]) {
  return update("quiz", quizId, { questions: next });
}

function notFound() {
  return Object.assign(new Error("Not found"), { status: 404 });
}
