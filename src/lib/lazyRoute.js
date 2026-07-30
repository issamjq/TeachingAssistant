import { lazy } from "react";

// React.lazy, with one retry.
//
// Why this exists. Route-level code splitting means a screen is a network
// request, and our users are teachers on school wifi and iPads on 4G. When
// that request fails, React caches the REJECTED promise on the lazy component
// forever — so the section stays broken for the rest of the session no matter
// how many times the teacher clicks "Try again", because there is nothing left
// to retry. That is why the error card offers "Reload page" as well.
//
// Verified 2026-07-30: two chunks genuinely failed to fetch when the dev server
// restarted mid-session, and both sections were stuck behind the error card
// until a reload. The boundary did its job; the recovery was the weak part.
//
// One retry after a short pause covers the case that actually dominates —
// a momentary drop, a wifi handover between classrooms — and the teacher never
// sees it. It deliberately does NOT cover a chunk that is genuinely gone (a
// stale hashed filename after a deploy, when the browser holds an old
// index.html). Nothing but a reload fixes that, so we fail to the error card
// and let its "Reload page" button do the work.
//
// One retry, not a loop: if the file is really missing, retrying harder just
// delays the honest error the teacher needs to see.
const RETRY_DELAY_MS = 500;

/**
 * @param {() => Promise<{default: React.ComponentType}>} factory
 *   the `() => import("./views/Thing")` you would have passed to lazy()
 */
export default function lazyRoute(factory) {
  return lazy(() =>
    factory().catch(
      (firstError) =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            factory().then(resolve, () => reject(firstError));
          }, RETRY_DELAY_MS);
        })
    )
  );
}
