// Mock client-side account. There is NO real auth yet — sign-up is a
// Google/Outlook button that just records which provider was tapped,
// which plan was chosen, and the teacher's onboarding profile, in
// localStorage. When Firebase lands, replace the get/set internals with
// the auth user + custom claims and keep this exact shape so callers
// don't change.
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
const PROVIDERS = ["google", "outlook"];

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
