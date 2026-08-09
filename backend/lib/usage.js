// =====================================================================
// What each generation cost, recorded once
//
// Every studio call already knows its token counts — it sends them to
// the browser in the final SSE event — and then drops them. usage_logs
// and credits exist for exactly this, and neither was ever written.
//
// The consequence is not abstract: with no ledger there is no way to
// answer "why is the Anthropic bill this size", no per-teacher usage on
// any admin screen, and a credits balance that can never move because
// nothing decrements it.
//
// Two writes, deliberately separate:
//   usage_logs  an append-only record of what happened. Never blocks.
//   credits     a balance that goes down. Only for metered plans.
// =====================================================================
import { pool } from "./db.js";

// Rough per-million-token prices, in USD. Kept here rather than fetched
// so a cost is recorded even when nothing is watching, and approximate
// on purpose — this is for spotting a runaway loop, not for invoicing.
// A model we have no price for logs tokens and a null cost, which is
// honest; guessing a number would be worse than admitting we lack one.
const PRICES = {
  "claude-haiku-4-5":  { in: 1.0,  out: 5.0 },
  "claude-sonnet-5":   { in: 3.0,  out: 15.0 },
  "claude-opus-5":     { in: 15.0, out: 75.0 },
  "gemini-flash-latest": { in: 0.30, out: 2.50 },
};

const costOf = (model, tin, tout) => {
  // Longest-prefix match, so a dated id like claude-haiku-4-5-20251001
  // still prices against its family instead of falling through to null.
  const key = Object.keys(PRICES)
    .filter((k) => String(model || "").startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  const p = PRICES[key];
  return Number((((tin || 0) * p.in + (tout || 0) * p.out) / 1_000_000).toFixed(6));
};

/**
 * Record one generation.
 *
 * Never throws and never blocks the response: a teacher's lesson plan
 * must not fail because the meter did. A dropped log line is a gap in
 * reporting; a thrown error here would be a lost piece of work.
 *
 * @param userId    the USER id — usage follows the person, not the profile
 * @param facultyId used only to move the credit balance
 */
export function recordUsage({
  userId = null,
  facultyId = null,
  model = null,
  operation = null,
  tokensIn = 0,
  tokensOut = 0,
  credits = 0,
} = {}) {
  // Fire-and-forget. The caller has already streamed its response by the
  // time this runs, so awaiting it would only delay closing the socket.
  (async () => {
    try {
      await pool.query(
        `INSERT INTO usage_logs (user_id, model, operation, tokens_in, tokens_out, cost_usd)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, model, operation, tokensIn, tokensOut, costOf(model, tokensIn, tokensOut)]
      );
      if (facultyId && credits > 0) {
        // GREATEST(0, …) so a balance cannot go negative. A teacher who
        // runs out mid-generation should finish the one they are in,
        // not be left owing the system credits.
        await pool.query(
          `UPDATE credits SET balance = GREATEST(0, balance - $2), updated_at = now()
            WHERE faculty_id = $1`,
          [facultyId, credits]
        );
      }
    } catch (e) {
      console.error("[usage] not recorded:", e.message);
    }
  })();
}

export { costOf };
