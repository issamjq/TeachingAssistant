// Role state lives in localStorage. There's no real auth yet — the user picks
// a role from the Account page and the UI switches sidebar + content
// accordingly. When real auth lands, replace this with the auth-claim role
// and keep the same shape (`getRole()` / subscribe pattern).

const KEY = "mudir_role";
export const ROLES = ["teacher", "admin", "dev"];
export const ROLE_LABELS = {
  teacher: "Teacher",
  admin: "Admin",
  dev: "Dev",
};
export const ROLE_DESCRIPTIONS = {
  teacher: "Your full personal teaching workspace — lessons, students, schedule, quizzes, homework.",
  admin: "Manage teacher accounts and see system stats. No access to any teacher's content.",
  dev: "Read-only data inspector, feature flags, and runtime info for debugging.",
};

export const getRole = () => {
  if (typeof localStorage === "undefined") return "teacher";
  const v = localStorage.getItem(KEY);
  return ROLES.includes(v) ? v : "teacher";
};

const listeners = new Set();
export const setRole = (r) => {
  if (!ROLES.includes(r)) return;
  localStorage.setItem(KEY, r);
  listeners.forEach((fn) => fn(r));
};
export const onRoleChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
