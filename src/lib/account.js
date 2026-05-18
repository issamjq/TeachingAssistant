// Mock client-side account. There is NO real auth yet — sign-up is a
// Google/Outlook button that just records which provider was tapped and
// which plan was chosen, in localStorage. When Firebase lands, replace
// the get/set internals with the auth user + custom claims and keep this
// exact shape (`getAccount()` / subscribe / `useAccount()`), so callers
// don't change.
//
//   account = { provider: "google" | "outlook", plan: "monthly" |
//               "quarterly" | "annual", email?: string, createdAt: number }
import { useEffect, useState } from "react";
import { PLAN_IDS } from "./plans";

const KEY = "mudir.account";
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
  emit(null);
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
