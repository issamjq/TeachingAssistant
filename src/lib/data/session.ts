// =====================================================================
// Who is asking, in terms the tables understand
//
// Going direct to Supabase means the browser has to supply the owner id
// on every insert — RLS checks it, it does not fill it in. Two ids
// matter and they are not interchangeable:
//
//   userId     auth.uid(). Notices, chat sessions and the profile.
//   facultyId  the teaching profile. Classes, lesson plans, the
//              register, the timetable — everything a teacher owns.
//
// Confusing them writes a row that RLS then refuses, and the error
// arrives as a policy violation rather than as anything that names the
// mistake. So they are resolved once, here, and cached for the session.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

export type Ident = { userId: string; facultyId: string | null };

let cache: Ident | null = null;
let inflight: Promise<Ident> | null = null;

/** Forget the cached identity. Call on sign-out, or the next teacher inherits it. */
export function clearIdent(): void {
  cache = null;
  inflight = null;
}

/**
 * The signed-in teacher's ids.
 *
 * Deduplicated: several screens mount at once and each wants the faculty
 * id, and without this they would each issue the same query. `inflight`
 * is what makes the concurrent case one request rather than five.
 */
export async function ident(): Promise<Ident> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) throw new NotSignedIn();

    const { data, error } = await supabase
      .from("faculty")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    cache = { userId, facultyId: data?.id ?? null };
    return cache;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** The faculty id, or a clear failure. Most tables key on this. */
export async function facultyId(): Promise<string> {
  const { facultyId: id } = await ident();
  if (!id) throw new NoTeacherRow();
  return id;
}

export class NotSignedIn extends Error {
  status = 401;
  code = "not_signed_in";
  constructor() { super("You're not signed in."); }
}

/**
 * Signed in, but with no teaching profile — the state a brand-new
 * account is in before onboarding provisions one. Callers branch on the
 * code to start onboarding rather than showing an error, which is why it
 * keeps the same `code` the API used to return.
 */
export class NoTeacherRow extends Error {
  status = 404;
  code = "no_teacher_row";
  constructor() { super("Your teaching profile hasn't been set up yet."); }
}

// A sign-out must not leave the previous teacher's faculty id in memory:
// the next sign-in on the same tab would write their rows against it.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN") clearIdent();
  });
}
