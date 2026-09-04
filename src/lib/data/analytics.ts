import { supabase } from "@/lib/supabase/client";

// Fire-and-forget event logging — tracking must never break the app it's
// tracking, so every function here swallows its own errors.

export function logPageView(ownerId: string, path: string): void {
  if (!supabase) return;
  void supabase.from("analytics_events").insert({ owner_id: ownerId, kind: "page_view", path });
}

export function logGeneration(ownerId: string, feature: string, classId: string): void {
  if (!supabase) return;
  void supabase
    .from("analytics_events")
    .insert({ owner_id: ownerId, kind: "generation", feature, class_id: classId });
}

export function logClientError(ownerId: string, message: string): void {
  if (!supabase) return;
  void supabase
    .from("analytics_events")
    .insert({ owner_id: ownerId, kind: "client_error", message: message.slice(0, 2000) });
}
