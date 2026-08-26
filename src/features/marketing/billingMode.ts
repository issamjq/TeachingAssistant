import { supabaseUrl, supabasePublishableKey } from "@/config/env";

// Which billing mode the marketing site should describe.
//
// Read on the SERVER, not in the browser, and that is the whole point.
// The landing page is the one genuinely public, SEO-relevant page in the
// app; fetching this client-side would mean the first paint always shows
// the paid default and then swaps, so during a free period every visitor
// sees three price cards flash past before being told it is free — and
// every crawler indexes the version with the prices in it.
//
// Rendered on the server the HTML is simply correct, for people and for
// Google, with no flash and no layout shift.
//
// Plain fetch rather than the supabase client because this runs where
// there is no session and none is wanted. public_billing_mode() is the
// deliberately tiny, anon-callable read added in db/tune.sql §91: two
// facts, both of which are printed on the page anyway.

export interface BillingMode {
  /** Are plans on sale? */
  billingOn: boolean;
  /** Credits every account gets while they are not. */
  freeGrant: number;
}

/**
 * Billing on, 800 credits.
 *
 * The fallback direction matters. If this read fails — Supabase down,
 * network blip, a revoke that went too far — the page describes the paid
 * product, which is the normal state of the business and the safer thing
 * to be wrong about. Claiming "free" to the public because a request
 * timed out is a promise we would then have to keep.
 */
const DEFAULT: BillingMode = { billingOn: true, freeGrant: 800 };

export async function readBillingMode(): Promise<BillingMode> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/public_billing_mode`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      // Cached with the page. The route revalidates on its own schedule;
      // a marketing page being up to a minute behind a flip is fine, and
      // it keeps "/" served from cache instead of rendered per visitor.
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT;

    const data = (await res.json()) as { enabled?: boolean; free_grant?: number } | null;
    return {
      // `!== false` for the same reason the studio reads it that way: a
      // payload that answered with anything unexpected means billing on.
      billingOn: data?.enabled !== false,
      freeGrant: Number(data?.free_grant) || DEFAULT.freeGrant,
    };
  } catch {
    return DEFAULT;
  }
}
