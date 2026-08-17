// =====================================================================
// AI credits — spend on use, refresh on the billing cycle
//
// Credits are the one thing a teacher must not be able to write directly
// (they could hand themselves a balance), so the mutations live in
// SECURITY DEFINER functions (db/tune.sql §32) that only ever touch the
// caller's OWN row and can only reduce or reset it. This module is the
// browser side of those: it calls the RPCs and announces a new balance so
// every surface showing credits updates without its own poll.
//
// Metering is POST-hoc: the AI request itself runs on the separate backend
// (it holds the model key), so the charge is applied here the moment a
// generation reports success — which is exactly "reduced according to the
// usage".
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

export interface ConsumeResult {
  ok: boolean;
  insufficient?: boolean;
  balance: number;
  spent?: number;
  cost?: number;
}

export interface CreditsStatus {
  balance: number;
  allowance: number;
  next_refresh_at: string | null;
  costs: Record<string, number>;
}

/** Tell every credits display the balance just changed. */
function announce(balance: number): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("murchid:credits", { detail: { balance } }));
  }
}

/** Subscribe to balance changes. Returns an unsubscribe. */
export function onCreditsChange(fn: (balance: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => fn((e as CustomEvent).detail?.balance);
  window.addEventListener("murchid:credits", handler);
  return () => window.removeEventListener("murchid:credits", handler);
}

/**
 * Spend credits for one AI action. Best-effort: a metering failure must
 * never surface as a generation failure, so a Supabase error resolves to
 * null rather than throwing. Announces the new balance on success.
 */
export async function consumeCredits(feature: string, ref?: string): Promise<ConsumeResult | null> {
  const { data, error } = await supabase.rpc("consume_credits", {
    p_feature: feature,
    p_ref: ref ?? null,
  });
  if (error) return null;
  const r = data as ConsumeResult;
  if (r?.ok && typeof r.balance === "number") announce(r.balance);
  return r;
}

/** Current balance, allowance, next refresh date, and the cost table. */
export async function creditsStatus(): Promise<CreditsStatus | null> {
  const { data, error } = await supabase.rpc("credits_status");
  if (error) return null;
  return (data as CreditsStatus) ?? null;
}

/**
 * Apply a due monthly refresh, if any. Idempotent and cheap — called on
 * load so "the counts refresh on those days" happens the first time the
 * teacher opens the app on or after the boundary.
 */
export async function refreshCreditsIfDue(): Promise<void> {
  const { data, error } = await supabase.rpc("refresh_credits_if_due");
  if (error) return;
  if (data && typeof (data as any).balance === "number") announce((data as any).balance);
}

// Which feature each AI endpoint bills as. Generate is a batch — one
// charge per artifact produced, keyed on its kind — so it is handled by
// counting artifact frames rather than a single feature here.
const METER: Record<string, { perArtifact?: boolean; feature?: string }> = {
  "/api/studio/generate":      { perArtifact: true },
  "/api/studio/regenerate":    { feature: "regenerate" },
  "/api/studio/quiz-tweak":    { feature: "quiz_tweak" },
  "/api/studio/bulletin":      { feature: "bulletin" },
  "/api/studio/skill-profile": { feature: "skill_profile" },
  "/api/chat":                 { feature: "chat" },
};

/**
 * Charge for a completed stream. Called by streamSSE once a stream ends
 * without error, with the artifact kinds it produced and whether it
 * reached `done`. Fire-and-forget from the caller's point of view.
 */
export async function meterStream(path: string, kinds: string[], sawDone: boolean): Promise<void> {
  const cfg = METER[path];
  if (!cfg) return;
  try {
    if (cfg.perArtifact) {
      // One charge per artifact the batch produced; a refusal yields no
      // artifact frames, so a declined request costs nothing.
      for (const k of kinds) await consumeCredits(k || "lesson_plan");
    } else if (cfg.feature && sawDone) {
      await consumeCredits(cfg.feature);
    }
  } catch {
    /* metering is best-effort */
  }
}
