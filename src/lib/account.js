// Client-side account cache, held in localStorage.
//
// NOT the authority on identity — Firebase owns the session and the server owns
// the account row; `/api/me` is the source of truth for anything that decides
// what a user may do. Role checks live in requireAuth() / requireRole() on the
// server, and nothing here is trusted for authorisation.
//
// What this holds is the parts of sign-up the UI needs before, or independently
// of, a server round-trip: which provider was used, which plan was picked, and
// the onboarding answers captured across wizard steps (`pending*` keys) before
// the account row exists to write them to.
//
// The header used to read "There is NO real auth yet — replace the internals
// when Firebase lands". Firebase landed; the shape was kept, as intended, so
// only the description was wrong (F13).
//
//   account = {
//     provider: "google" | "outlook",
//     plan: "monthly" | "quarterly" | "annual",
//     profile?: {
//       firstName, lastName, staffId, bio,
//       majors:[], languages:[], grades:[], sections:[]
//     },
//     email?: string,
//     createdAt: number,
//   }
import { useEffect, useState } from "react";
import { PLAN_IDS } from "./plans";

const KEY = "murchid.account";
const PROFILE_KEY = "murchid.profile.pending"; // captured before plan pick
// "email" covers both the email+password flow and the magic-link
// fallback. Without it here, getAccount() silently rejects every
// email-signup user — useAccount() returns null and the sidebar
// chip falls back to a bare role label with no name or staff ID.
const PROVIDERS = ["google", "outlook", "email", "microsoft"];

export const getAccount = () => {
  if (typeof localStorage === "undefined") return null;
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!a || !PROVIDERS.includes(a.provider) || !PLAN_IDS.includes(a.plan)) {
      return null;
    }
    return a;
  } catch {
    return null;
  }
};

const listeners = new Set();
const emit = (a) => listeners.forEach((fn) => fn(a));

export const setAccount = (acc) => {
  const next = { createdAt: Date.now(), ...acc };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  emit(next);
  return next;
};

export const clearAccount = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
  emit(null);
};

// Merge a patch into the stored account's profile — e.g. an avatar picked
// from Settings. Reads raw storage (not getAccount, which rejects an
// incomplete account) so provider/plan survive the round-trip, then emits so
// useAccount subscribers (sidebar, landing nav) re-render with the change.
export const updateProfile = (patch) => {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { /* ignore */ }
  const next = { ...cur, profile: { ...(cur.profile || {}), ...patch } };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  emit(next);
  return next;
};

// Profile captured during onboarding — written by the ProfileForm step
// BEFORE the plan picker, then merged into the account on plan choice.
// Stored separately so a teacher who closes the tab mid-onboarding can
// resume where they left off without losing their typed answers.
export const setPendingProfile = (profile) => {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
  catch { /* ignore */ }
};
export const getPendingProfile = () => {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); }
  catch { return null; }
};
export const clearPendingProfile = () => {
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
};

// Pending student roster from onboarding's CSV-upload step. Survives
// the plan-picker step and gets POSTed to /api/students the first time
// the teacher opens My students (once Firebase auth is wired). For
// now, lives in localStorage so the planner's My-students view can
// surface what was imported during onboarding.
const STUDENTS_KEY = "murchid.students.pending";
export const setPendingStudents = (rows) => {
  try { localStorage.setItem(STUDENTS_KEY, JSON.stringify(rows || [])); }
  catch { /* ignore */ }
};
export const getPendingStudents = () => {
  try { return JSON.parse(localStorage.getItem(STUDENTS_KEY) || "[]"); }
  catch { return []; }
};
export const clearPendingStudents = () => {
  try { localStorage.removeItem(STUDENTS_KEY); } catch { /* ignore */ }
};

// Pending school selections from onboarding. Same storage pattern as
// students: persisted between the onboarding wizard and the plan picker,
// then POSTed to /api/schools/mine the first time the studio loads.
// Shape: [{ school_id: number, is_primary: boolean }, ...]
const SCHOOLS_KEY = "murchid.schools.pending";
export const setPendingSchools = (rows) => {
  try { localStorage.setItem(SCHOOLS_KEY, JSON.stringify(rows || [])); }
  catch { /* ignore */ }
};
export const getPendingSchools = () => {
  try { return JSON.parse(localStorage.getItem(SCHOOLS_KEY) || "[]"); }
  catch { return []; }
};
export const clearPendingSchools = () => {
  try { localStorage.removeItem(SCHOOLS_KEY); } catch { /* ignore */ }
};

export const onAccountChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// React binding — re-renders when the mock account changes (any tab via
// `storage`, or this tab via the listener set).
export function useAccount() {
  const [account, setState] = useState(getAccount);
  useEffect(() => {
    const sync = () => setState(getAccount());
    const off = onAccountChange(sync);
    window.addEventListener("storage", sync);
    return () => { off(); window.removeEventListener("storage", sync); };
  }, []);
  return account;
}
