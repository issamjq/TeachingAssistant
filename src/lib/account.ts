"use client";

// Client-side account cache.
//
// Mirrors the signed-in account in localStorage: which provider was used,
// which plan was chosen, and the teacher's onboarding profile. Supabase is
// the real authority (see lib/supabaseAuth.js) — this is the local mirror
// the sidebar, landing nav, and onboarding read synchronously.
//
// The `getPending*` helpers hold data captured during onboarding BEFORE the
// account row exists, so closing the tab mid-flow doesn't lose typed answers.
import { useEffect, useState } from "react";
import { PLAN_IDS } from "./plans";
import { readJSON } from "../shared/lib/storage";
import type {
  Account,
  AccountProfile,
  AuthProvider,
  PendingSchool,
  PlanId,
} from "../shared/types/domain";

const KEY = "murchid.account";
const PROFILE_KEY = "murchid.profile.pending"; // captured before plan pick
// "email" covers both the email+password flow and the magic-link
// fallback. Without it here, getAccount() silently rejects every
// email-signup user — useAccount() returns null and the sidebar
// chip falls back to a bare role label with no name or staff ID.
const PROVIDERS: AuthProvider[] = ["google", "outlook", "email", "microsoft"];

// Returns null unless the stored blob is a COMPLETE account — an
// half-finished onboarding record is treated as "not signed up yet".
export const getAccount = (): Account | null => {
  try {
    const a = readJSON<Account | null>(KEY, null);
    if (
      !a ||
      !PROVIDERS.includes(a.provider) ||
      !PLAN_IDS.includes(a.plan as PlanId)
    ) {
      return null;
    }
    return a;
  } catch {
    return null;
  }
};

type AccountListener = (account: Account | null) => void;
const listeners = new Set<AccountListener>();
const emit = (a: Account | null) => listeners.forEach((fn) => fn(a));

export const setAccount = (acc: Omit<Account, "createdAt"> & { createdAt?: number }): Account => {
  const next = { createdAt: Date.now(), ...acc };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  emit(next);
  return next;
};

export const clearAccount = (): void => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
  emit(null);
};

// Merge a patch into the stored account's profile — e.g. an avatar picked
// from Settings. Reads raw storage (not getAccount, which rejects an
// incomplete account) so provider/plan survive the round-trip, then emits so
// useAccount subscribers (sidebar, landing nav) re-render with the change.
export const updateProfile = (patch: Partial<AccountProfile>): Account => {
  let cur: Partial<Account> = {};
  try { cur = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { /* ignore */ }
  const next = { ...cur, profile: { ...(cur.profile || {}), ...patch } } as Account;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  emit(next);
  return next;
};

// Profile captured during onboarding — written by the ProfileForm step
// BEFORE the plan picker, then merged into the account on plan choice.
// Stored separately so a teacher who closes the tab mid-onboarding can
// resume where they left off without losing their typed answers.
export const setPendingProfile = (profile: AccountProfile): void => {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
  catch { /* ignore */ }
};
export const getPendingProfile = (): AccountProfile | null => {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); }
  catch { return null; }
};
export const clearPendingProfile = (): void => {
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
};

// Pending student roster from onboarding's CSV-upload step. Survives
// the plan-picker step and gets POSTed to /api/students the first time
// the teacher opens My students (server-side). For
// now, lives in localStorage so the planner's My-students view can
// surface what was imported during onboarding.
const STUDENTS_KEY = "murchid.students.pending";
export const setPendingStudents = (rows: unknown[]): void => {
  try { localStorage.setItem(STUDENTS_KEY, JSON.stringify(rows || [])); }
  catch { /* ignore */ }
};
export const getPendingStudents = (): unknown[] => {
  try { return JSON.parse(localStorage.getItem(STUDENTS_KEY) || "[]"); }
  catch { return []; }
};
export const clearPendingStudents = (): void => {
  try { localStorage.removeItem(STUDENTS_KEY); } catch { /* ignore */ }
};

// Pending school selections from onboarding. Same storage pattern as
// students: persisted between the onboarding wizard and the plan picker,
// then POSTed to /api/schools/mine the first time the studio loads.
// Shape: [{ school_id: number, is_primary: boolean }, ...]
const SCHOOLS_KEY = "murchid.schools.pending";
export const setPendingSchools = (rows: PendingSchool[]): void => {
  try { localStorage.setItem(SCHOOLS_KEY, JSON.stringify(rows || [])); }
  catch { /* ignore */ }
};
export const getPendingSchools = (): PendingSchool[] => {
  try { return JSON.parse(localStorage.getItem(SCHOOLS_KEY) || "[]"); }
  catch { return []; }
};
export const clearPendingSchools = (): void => {
  try { localStorage.removeItem(SCHOOLS_KEY); } catch { /* ignore */ }
};

export const onAccountChange = (fn: AccountListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// React binding — re-renders when the mock account changes (any tab via
// `storage`, or this tab via the listener set).
export function useAccount(): Account | null {
  const [account, setState] = useState(getAccount);
  useEffect(() => {
    const sync = () => setState(getAccount());
    const off = onAccountChange(sync);
    window.addEventListener("storage", sync);
    return () => { off(); window.removeEventListener("storage", sync); };
  }, []);
  return account;
}
