// Feature-flag reads, cached.
//
// Before this, every AI generation opened with `SELECT enabled FROM
// feature_flags WHERE key = 'ai_studio'` — a full Neon round-trip on the
// hottest, most latency-sensitive path in the product, to read a boolean that
// changes maybe twice a month.
//
// TTL is short and the write path invalidates, so a dev flipping a flag in the
// console sees it immediately (Redis: on every instance; memory: on the
// instance that served the toggle, and within TTL_SECONDS everywhere else).
// Flags gate features, not authorisation — a flag going stale for a few
// seconds shows or hides a button, it does not grant access to anything the
// role checks wouldn't already allow. That is why this TTL can be 30s while
// the account cache's is 10.

import { pool } from "./db.js";
import { cached, cacheDel } from "./cache.js";

const TTL_SECONDS = 30;
const key = (flag) => `flag:${flag}`;

/**
 * Is this flag on? Unknown flags are OFF — a typo'd flag name must not open
 * a feature, and a flag that hasn't been seeded yet hasn't been reviewed.
 *
 * @param {string} flag
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(flag) {
  const row = await cached(key(flag), TTL_SECONDS, async () => {
    const r = await pool.query(
      "SELECT enabled FROM feature_flags WHERE key = $1",
      [flag]
    );
    // null (not undefined) so "no such flag" is cached too — otherwise a
    // misspelled flag name costs a query per request forever.
    return r.rows[0] ? { enabled: Boolean(r.rows[0].enabled) } : null;
  });
  return Boolean(row?.enabled);
}

/** Call after any write to feature_flags. */
export async function invalidateFeatureFlag(flag) {
  await cacheDel(key(flag));
}
