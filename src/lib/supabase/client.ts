import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/config/env";

// null when env vars are missing, so callers can degrade to a clear
// "sign-in unavailable" state instead of crashing at import time.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
