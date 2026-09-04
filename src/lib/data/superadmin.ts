import { supabase } from "@/lib/supabase/client";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export type AccountRole = "teacher" | "sub_admin" | "super_admin" | "organisation";
export type AccountStatus = "pending" | "active" | "rejected";

export interface AccountRow {
  id: string;
  name: string | null;
  email: string | null;
  role: AccountRole;
  status: AccountStatus;
  institution: string | null;
  created_at: string;
}

export async function listAllAccounts(): Promise<AccountRow[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("profiles")
    .select("id, name, email, role, status, institution, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

export async function updateAccountRole(id: string, role: AccountRole): Promise<void> {
  const db = requireClient();
  const { error } = await db.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateAccountStatus(id: string, status: AccountStatus): Promise<void> {
  const db = requireClient();
  const { error } = await db.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
}

export interface StudentAdminRow {
  id: string;
  name: string;
  roll_no: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

export async function listAllStudentsAdmin(): Promise<StudentAdminRow[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("students")
    .select("id, name, roll_no, email, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentAdminRow[];
}

export interface PlatformStats {
  totalAccounts: number;
  pendingAccounts: number;
  activeAccounts: number;
  totalClasses: number;
  totalStudents: number;
  sharedMaterials: number;
}

async function countRows(
  table: string,
  filter?: [string, string | boolean],
): Promise<number> {
  const db = requireClient();
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export interface AnalyticsEventRow {
  id: string;
  owner_id: string;
  kind: "page_view" | "generation" | "client_error";
  path: string | null;
  feature: string | null;
  class_id: string | null;
  message: string | null;
  created_at: string;
}

async function listEvents(
  kind: AnalyticsEventRow["kind"],
  limit: number,
): Promise<AnalyticsEventRow[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("analytics_events")
    .select("id, owner_id, kind, path, feature, class_id, message, created_at")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AnalyticsEventRow[];
}

export function listGenerationEvents(limit = 1000): Promise<AnalyticsEventRow[]> {
  return listEvents("generation", limit);
}

export function listPageViewEvents(limit = 1000): Promise<AnalyticsEventRow[]> {
  return listEvents("page_view", limit);
}

export function listClientErrorEvents(limit = 200): Promise<AnalyticsEventRow[]> {
  return listEvents("client_error", limit);
}

export interface FeatureCostRow {
  feature: string;
  credit_cost: number;
  updated_at: string;
}

export async function listFeatureCosts(): Promise<FeatureCostRow[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("feature_costs")
    .select("feature, credit_cost, updated_at")
    .order("feature", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FeatureCostRow[];
}

export async function updateFeatureCost(feature: string, creditCost: number): Promise<void> {
  const db = requireClient();
  const { error } = await db
    .from("feature_costs")
    .update({ credit_cost: creditCost, updated_at: new Date().toISOString() })
    .eq("feature", feature);
  if (error) throw error;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [totalAccounts, pendingAccounts, activeAccounts, totalClasses, totalStudents, sharedMaterials] =
    await Promise.all([
      countRows("profiles"),
      countRows("profiles", ["status", "pending"]),
      countRows("profiles", ["status", "active"]),
      countRows("classes"),
      countRows("students"),
      countRows("materials", ["is_shared", true]),
    ]);
  return {
    totalAccounts,
    pendingAccounts,
    activeAccounts,
    totalClasses,
    totalStudents,
    sharedMaterials,
  };
}
