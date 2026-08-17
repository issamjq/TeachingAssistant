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
  | "lesson_plan" | "teaching_guide" | "student_notes" | "quiz" | "homework"
  | "presentation" | "activity" | "template";

/** Route segment → stored type. The screens' words on the left. */
export const KIND_BY_PATH: Record<string, Kind> = {
  drafts: "lesson_plan",
  // A lesson is three documents. The studio has always generated the guide
  // and the notes alongside the plan, and neither had a route — so both fell
  // through to /api/drafts and were stored as `lesson_plan`, putting three
  // identical-looking entries in the library where one lesson belonged.
  "teaching-guides": "teaching_guide",
  "student-notes": "student_notes",
  quizzes: "quiz",
  homework: "homework",
  presentations: "presentation",
  activities: "activity",
  templates: "template",
};

/** The three documents of one lesson, in the order a teacher reads them. */
export const LESSON_KINDS: Kind[] = ["lesson_plan", "teaching_guide", "student_notes"];

const COLS =
  "id, type, status, content, batch_id, prompt_text, model_used, tokens_in, tokens_out, created_at, updated_at, deleted_at";

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
/**
 * `prompt_text` joins these because what she asked for is part of the record.
 *
 * The column has always existed and nothing ever wrote it, so a saved artifact
 * carried no memory of the request that produced it — and anything reading the
 * row later has to ask her again for something she already typed.
 */
const REAL = new Set([
  "status", "model_used", "tokens_in", "tokens_out", "skill_id", "batch_id", "prompt_text",
]);
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

/**
 * Every document generated in the same breath as this one.
 *
 * A lesson plan, its teaching guide and its student notes come out of one
 * request sharing a `batch_id`, and the lesson card has to show all three as
 * its resources. Looked up from the plan's own id rather than the batch id,
 * because the card only ever knows the plan — and a row saved before batches
 * were recorded still returns itself, so an older lesson opens with one
 * document instead of coming up empty.
 */
export async function batchOf(id: string) {
  const { data: one, error: readErr } = await supabase
    .from("ai_studio").select(COLS)
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (readErr) throw readErr;
  if (!one) throw notFound();

  const batch = (one as Row).batch_id as string | null;
  if (!batch) return [flatten(one as Row)];

  const { data, error } = await supabase
    .from("ai_studio").select(COLS)
    .eq("batch_id", batch).is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Reading order, not insertion order: whichever document she saved first,
  // the plan comes before the guide before the notes.
  return (data as Row[])
    .map(flatten)
    .sort((a, b) => LESSON_KINDS.indexOf(a!.type) - LESSON_KINDS.indexOf(b!.type));
}

/**
 * The saved rows for one generation batch, keyed by kind.
 *
 * Lets a conversation reopened tomorrow still know which library card it
 * produced. Both halves already record the batch — the transcript keeps it on
 * the turn, the library keeps it on the row — so the link survives a reload
 * without storing anything new.
 */
export async function savedForBatch(batchId: string) {
  const { data, error } = await supabase
    .from("ai_studio").select(COLS)
    .eq("batch_id", batchId).is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data as Row[]).map(flatten) as Record<string, any>[];
  const row = rows.find((r) => LESSON_KINDS.includes(r.type)) ?? rows[0];
  return row
    ? { batchId, id: row.id, title: row.name || row.title || "", prompt: row.prompt_text || "" }
    : null;
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
    // `...cols` matters: `split` sorts the body into real columns and jsonb,
    // and every real column except `status` used to be dropped on the floor
    // here. `batch_id` is the one that showed — with no value sent, the
    // column's `gen_random_uuid()` default gave each document its own batch,
    // so the three parts of one lesson became three unrelated rows.
    .insert({ ...cols, faculty_id: fid, type: kind, status: cols.status ?? "complete", content })
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

  /**
   * `...cols` matters here for the same reason it does on insert.
   *
   * This applied `status` and dropped every other real column on the floor.
   * The one that showed was `prompt_text`: reworking a lesson rewrote its
   * documents but left the row still carrying the ORIGINAL request, so the
   * scheduler read "a grade 5 science lesson on magnets" and asked her for a
   * time she had just given in "move it to friday at 2pm".
   */
  const patch: Record<string, any> = {
    ...cols,
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
