"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// The client-side counterpart to billingMode.ts.
//
// The landing page reads the switch on the server, because it is the SEO
// page and a flash of the wrong prices there is worth avoiding properly.
// The sign-up and sign-in funnel is neither indexed nor price-bearing —
// it carries one reassurance line — so it reads the same anon-callable
// RPC from the browser instead of having the value threaded down through
// two server routes and a 7,000-line legacy view.
//
// Starts as `true`. Billing on is the default and the honest thing to be
// wrong about for the instant before the answer lands: promising "free"
// to someone about to hand over an email, and then correcting it, is the
// failure worth designing against.

export function useBillingMode(): { billingOn: boolean; freeGrant: number } {
  const [mode, setMode] = useState({ billingOn: true, freeGrant: 800 });

  useEffect(() => {
    let off = false;
    supabase
      .rpc("public_billing_mode")
      .then(({ data, error }: { data: any; error: any }) => {
        if (off || error || !data) return;
        setMode({
          billingOn: data.enabled !== false,
          freeGrant: Number(data.free_grant) || 800,
        });
      });
    return () => {
      off = true;
    };
  }, []);

  return mode;
}
