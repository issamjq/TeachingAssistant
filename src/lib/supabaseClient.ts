// Supabase browser client — initialised once at module import.
// Replaces src/lib/firebase.js.
//
// Configuration comes from src/config/env.ts (NEXT_PUBLIC_SUPABASE_*).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabasePublishableKey } from "../config/env";

// Next fast-refreshes the module on save, and the legacy SPA mount can
// re-evaluate it; stash the instance on globalThis so we never end up
// with two clients racing over the same stored session.
const globalForSupabase = globalThis as unknown as {
  __murchidSupabase?: SupabaseClient;
};

export const supabase: SupabaseClient =
  globalForSupabase.__murchidSupabase ??
  createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      // Keep the session in localStorage and refresh it in the
      // background, which is what the old Firebase SDK did — the api()
      // helper can then just read the current access token per request
      // without any manual refresh bookkeeping.
      persistSession: true,
      autoRefreshToken: true,

      // PKCE is the correct flow for a browser client: the code returned
      // on the redirect is useless without the verifier held in this
      // tab's storage, so an intercepted callback URL can't be replayed.
      flowType: "pkce",

      // Finish sign-in automatically when the user lands back on the site
      // from an OAuth redirect, a magic link, or a recovery link. This is
      // what makes the redirect flow work without a dedicated callback
      // route — supabase-js spots the ?code= and exchanges it on load.
      detectSessionInUrl: true,
    },
  });

if (typeof window !== "undefined") {
  globalForSupabase.__murchidSupabase = supabase;
}
