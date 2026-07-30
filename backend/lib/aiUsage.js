// AI usage ledger — the record of what every generation actually cost.
//
// Before this existed, all four studio endpoints computed `message.usage`,
// sent it to the browser in the `done` event, and threw it away. Cost was
// therefore unknowable: with the AI budget at roughly $1.40/user/month, the
// only thing standing between us and unbounded spend was the `ai_studio`
// feature flag being off.
//
// Two rules shape this module:
//
//   Money is integer arithmetic. Costs are stored in **nano-USD** (1e-9 USD)
//   as BIGINT. Anthropic's rates divide cleanly at this scale — $1.00/MTok is
//   exactly 1000 nano-USD per token — so every figure below is an integer and
//   nothing is ever rounded through a float. Storing money in a float is how
//   ledgers silently drift.
//
//   No prompt content is ever recorded. Teacher prompts routinely name real
//   students, so the ledger holds token counts and metadata only. This is a
//   privacy boundary, not an oversight — do not add a `prompt` column.

import { pool } from "./db.js";

// Rates in USD per million tokens, from the Anthropic pricing table.
// `version` is stamped on every row so historical rows stay meaningful after
// a price change — without it, a re-priced model silently rewrites history.
const PRICE_VERSION = "2026-06-24";

const PRICES_USD_PER_MTOK = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-5": { input: 5, output: 25 },
};

// Cache pricing is expressed as a multiple of the model's input rate:
// reads are ~0.1x, 5-minute writes 1.25x. Kept as numerator/denominator so
// the multiplication stays in integers.
const CACHE_READ_NUM = 1, CACHE_READ_DEN = 10;      // 0.1x
const CACHE_WRITE_NUM = 125, CACHE_WRITE_DEN = 100; // 1.25x

// USD per million tokens → nano-USD per token. $1.00/MTok = 1000 nano/token.
const perTokenNano = (usdPerMTok) => usdPerMTok * 1000;

/**
 * Cost of one call in nano-USD (1e-9 USD), as an integer.
 *
 * Returns 0 for an unknown model rather than throwing — an unpriced model is
 * a reporting gap, not a reason to fail a teacher's generation. The row still
 * records the token counts, so it can be re-priced later.
 */
export function computeCostNanoUsd(model, usage = {}) {
  const price = PRICES_USD_PER_MTOK[model];
  if (!price) return 0;

  const inNano = perTokenNano(price.input);
  const outNano = perTokenNano(price.output);

  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;

  return (
    input * inNano +
    output * outNano +
    Math.round((cacheRead * inNano * CACHE_READ_NUM) / CACHE_READ_DEN) +
    Math.round((cacheWrite * inNano * CACHE_WRITE_NUM) / CACHE_WRITE_DEN)
  );
}

/**
 * Append one row to the ledger. Never throws, never blocks the response.
 *
 * **Fire-and-forget by design.** The caller does not await the INSERT: a Neon
 * round-trip is ~96 ms, and awaiting it here would delay the `done` SSE frame
 * on every single generation — the teacher would wait on a bookkeeping write
 * that has no bearing on their result. The write still happens; it just
 * overlaps `res.end()` instead of preceding it.
 *
 * The failure contract is the same as recordAudit(): this runs at the end of a
 * streaming response, where headers are long gone and there is no way to
 * surface an error to the client, so a failure must not escalate into a broken
 * generation. A missing ledger row is a reporting gap; an exception thrown into
 * a finished SSE stream is a user-visible failure. Errors are logged only.
 *
 * Returns the pending promise so tests can await the write. Production callers
 * ignore it — that is the point.
 *
 * @param {object}  req       the request (for the verified req.account)
 * @param {string}  endpoint  generate | quiz | quiz-tweak | regenerate
 * @param {string}  model     the model actually called
 * @param {object}  usage     Anthropic usage block
 * @param {object} [opts]     { kind, status }
 * @returns {Promise<void>}   resolves when the row is written (or failed)
 */
export function recordAiUsage(req, endpoint, model, usage, opts = {}) {
  // Values are read synchronously, before returning: req.account and the usage
  // object must be captured now, not when the promise happens to run.
  let params;
  try {
    const account = req?.account || null;
    params = [
      account?.id ?? null,
      account?.role ?? null,
      endpoint,
      opts.kind ?? null,
      model,
      usage?.input_tokens || 0,
      usage?.output_tokens || 0,
      usage?.cache_read_input_tokens || 0,
      usage?.cache_creation_input_tokens || 0,
      computeCostNanoUsd(model, usage),
      PRICE_VERSION,
      opts.status || "ok",
    ];
  } catch (err) {
    console.error(`[ai-usage] failed to build ${endpoint} row:`, err.message);
    return Promise.resolve();
  }

  return pool
    .query(
      `INSERT INTO ai_usage_ledger
         (account_id, role, endpoint, kind, model,
          input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
          cost_nano_usd, price_version, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      params
    )
    .then(() => undefined)
    .catch((err) => {
      // Deliberately swallowed — see the contract above. Must be a .catch and
      // not a bare floating promise: an unhandled rejection here would crash
      // the Node process on a transient DB blip.
      console.error(`[ai-usage] failed to record ${endpoint}:`, err.message);
    });
}

export { PRICE_VERSION, PRICES_USD_PER_MTOK };
